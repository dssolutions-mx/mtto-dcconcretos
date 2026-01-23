-- =====================================================
-- Compliance & Governance System - Database Functions
-- Migration: 20251220_compliance_functions
-- Description: PL/PGSQL functions for asset accountability, compliance tracking, and soft-block enforcement
-- =====================================================

-- =====================================================
-- 1. REFRESH ASSET ACCOUNTABILITY (Main Health Check Function)
-- =====================================================
CREATE OR REPLACE FUNCTION refresh_asset_accountability()
RETURNS void AS $$
DECLARE
  v_asset RECORD;
  v_primary_responsible UUID;
  v_secondary_responsible UUID;
  v_days_without_checklist INTEGER;
  v_days_without_operator INTEGER;
  v_alert_level TEXT;
  v_has_recent_checklist BOOLEAN;
  v_has_pending_schedules BOOLEAN;
  v_last_checklist_date TIMESTAMPTZ;
  v_oldest_pending_date TIMESTAMPTZ;
  v_pending_count INTEGER;
  v_grace_period_days INTEGER;
  v_asset_age_days INTEGER;
BEGIN
  -- Get grace period setting
  SELECT (value::text)::integer INTO v_grace_period_days
  FROM system_settings
  WHERE key = 'asset_grace_period_days'
  LIMIT 1;
  
  -- Default to 7 days if not set
  IF v_grace_period_days IS NULL THEN
    v_grace_period_days := 7;
  END IF;

  FOR v_asset IN 
    SELECT 
      a.id as asset_id,
      a.plant_id,
      a.status as asset_status,
      a.created_at as asset_created_at,
      -- Operator assignment
      ao.operator_id,
      ao.start_date as operator_assigned_since,
      -- Plant management
      p.plant_manager_id as jefe_planta_id,
      p.business_unit_id,
      bu.manager_id as jefe_unidad_id
    FROM assets a
    LEFT JOIN asset_operators ao ON ao.asset_id = a.id 
      AND ao.end_date IS NULL 
      AND ao.assignment_type = 'primary'
      AND ao.status = 'active'
    LEFT JOIN plants p ON p.id = a.plant_id
    LEFT JOIN business_units bu ON bu.id = p.business_unit_id
    WHERE a.status NOT IN ('maintenance', 'repair', 'out_of_service', 'scrapped', 'inactive', 'retired')
  LOOP
    -- Skip assets in maintenance status
    IF v_asset.asset_status IN ('maintenance', 'repair', 'out_of_service', 'scrapped') THEN
      CONTINUE;
    END IF;
    
    -- Calculate asset age
    v_asset_age_days := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_asset.asset_created_at)) / 86400;
    
    -- Skip new assets within grace period
    IF v_asset_age_days < v_grace_period_days THEN
      CONTINUE;
    END IF;
    
    -- Get last checklist date
    SELECT MAX(cc.completion_date), COUNT(*)
    INTO v_last_checklist_date, v_pending_count
    FROM completed_checklists cc
    WHERE cc.asset_id = v_asset.asset_id;
    
    -- Get pending schedules info
    SELECT 
      COUNT(*),
      MIN(cs.scheduled_date)
    INTO v_pending_count, v_oldest_pending_date
    FROM checklist_schedules cs
    WHERE cs.asset_id = v_asset.asset_id
      AND cs.status = 'pendiente'
      AND cs.scheduled_date < CURRENT_DATE;
    
    -- Calculate days without checklist
    IF v_last_checklist_date IS NULL THEN
      v_days_without_checklist := 999; -- Never had checklist
      v_has_recent_checklist := false;
    ELSE
      v_days_without_checklist := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_last_checklist_date)) / 86400;
      v_has_recent_checklist := v_days_without_checklist <= 7;
    END IF;
    
    -- Calculate days without operator
    IF v_asset.operator_id IS NULL THEN
      v_days_without_operator := 999; -- No operator assigned
    ELSE
      v_days_without_operator := 0;
    END IF;
    
    -- Determine primary responsible (Operator if assigned, else Plant Manager)
    v_primary_responsible := COALESCE(v_asset.operator_id, v_asset.jefe_planta_id);
    v_secondary_responsible := COALESCE(v_asset.jefe_planta_id, v_asset.jefe_unidad_id);
    
    -- Determine alert level based on thresholds
    IF v_asset.operator_id IS NULL THEN
      v_alert_level := 'critical'; -- No operator = critical
    ELSIF v_days_without_checklist >= 30 THEN
      v_alert_level := 'emergency';
    ELSIF v_days_without_checklist >= 14 THEN
      v_alert_level := 'critical';
    ELSIF v_days_without_checklist >= 7 OR (v_pending_count > 0 AND v_oldest_pending_date < CURRENT_DATE) THEN
      v_alert_level := 'warning';
    ELSE
      v_alert_level := 'ok';
    END IF;
    
    -- Upsert tracking record
    INSERT INTO asset_accountability_tracking (
      asset_id,
      has_operator,
      has_recent_checklist,
      has_pending_schedules,
      primary_responsible_user_id,
      secondary_responsible_user_id,
      alert_level,
      days_without_checklist,
      days_without_operator,
      last_checklist_date,
      oldest_pending_schedule_date,
      pending_schedules_count,
      last_updated_at
    ) VALUES (
      v_asset.asset_id,
      v_asset.operator_id IS NOT NULL,
      v_has_recent_checklist,
      v_pending_count > 0,
      v_primary_responsible,
      v_secondary_responsible,
      v_alert_level,
      v_days_without_checklist::integer,
      v_days_without_operator::integer,
      v_last_checklist_date,
      v_oldest_pending_date,
      v_pending_count,
      NOW()
    )
    ON CONFLICT (asset_id) DO UPDATE SET
      has_operator = EXCLUDED.has_operator,
      has_recent_checklist = EXCLUDED.has_recent_checklist,
      has_pending_schedules = EXCLUDED.has_pending_schedules,
      primary_responsible_user_id = EXCLUDED.primary_responsible_user_id,
      secondary_responsible_user_id = EXCLUDED.secondary_responsible_user_id,
      alert_level = EXCLUDED.alert_level,
      days_without_checklist = EXCLUDED.days_without_checklist,
      days_without_operator = EXCLUDED.days_without_operator,
      last_checklist_date = EXCLUDED.last_checklist_date,
      oldest_pending_schedule_date = EXCLUDED.oldest_pending_schedule_date,
      pending_schedules_count = EXCLUDED.pending_schedules_count,
      last_updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION refresh_asset_accountability() IS 'Refreshes asset accountability tracking - calculates health status for all active assets';

-- =====================================================
-- 2. ESCALATE FORGOTTEN ASSETS (Notification Function)
-- =====================================================
CREATE OR REPLACE FUNCTION escalate_forgotten_assets()
RETURNS void AS $$
DECLARE
  v_tracking RECORD;
  v_asset RECORD;
  v_title TEXT;
  v_message TEXT;
  v_priority TEXT;
BEGIN
  FOR v_tracking IN
    SELECT 
      aat.*,
      a.name as asset_name,
      a.asset_id as asset_code,
      p.name as plant_name,
      bu.name as business_unit_name
    FROM asset_accountability_tracking aat
    JOIN assets a ON a.id = aat.asset_id
    LEFT JOIN plants p ON p.id = a.plant_id
    LEFT JOIN business_units bu ON bu.id = p.business_unit_id
    WHERE aat.alert_level IN ('warning', 'critical', 'emergency')
      AND (
        aat.last_notified_at IS NULL 
        OR aat.last_notified_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
      )
    ORDER BY 
      CASE aat.alert_level 
        WHEN 'emergency' THEN 1
        WHEN 'critical' THEN 2
        WHEN 'warning' THEN 3
      END,
      aat.days_without_checklist DESC
  LOOP
    -- Determine notification message based on alert level
    CASE v_tracking.alert_level
      WHEN 'emergency' THEN
        v_title := '🚨 EMERGENCIA: Activo abandonado ' || v_tracking.days_without_checklist || ' días';
        v_message := v_tracking.asset_name || ' (' || v_tracking.asset_code || ') en ' || COALESCE(v_tracking.plant_name, 'Sin planta') || 
                    ' lleva ' || v_tracking.days_without_checklist || ' días sin checklist. ' ||
                    CASE WHEN v_tracking.has_operator THEN 'Operador asignado pero no cumple.' 
                         ELSE 'SIN OPERADOR ASIGNADO - REQUIERE ASIGNACIÓN URGENTE.' END;
        v_priority := 'critical';
        
      WHEN 'critical' THEN
        v_title := '⚠️ CRÍTICO: Activo requiere atención';
        v_message := v_tracking.asset_name || ' necesita checklist urgente. ' ||
                    CASE WHEN NOT v_tracking.has_operator THEN 'PRIMERO ASIGNAR OPERADOR.' 
                         ELSE 'Último checklist hace ' || v_tracking.days_without_checklist || ' días.' END;
        v_priority := 'high';
        
      WHEN 'warning' THEN
        v_title := '⏰ Recordatorio: Checklist pendiente';
        v_message := v_tracking.asset_name || ' tiene checklists atrasados';
        v_priority := 'medium';
    END CASE;
    
    -- Notify primary responsible
    IF v_tracking.primary_responsible_user_id IS NOT NULL THEN
      INSERT INTO compliance_notifications (
        user_id,
        title,
        message,
        type,
        priority,
        entity_id,
        entity_type,
        action_url,
        action_label
      ) VALUES (
        v_tracking.primary_responsible_user_id,
        v_title,
        v_message,
        CASE 
          WHEN NOT v_tracking.has_operator THEN 'forgotten_asset'
          ELSE 'overdue_checklist'
        END,
        v_priority,
        v_tracking.asset_id,
        'asset',
        '/checklists/assets/' || v_tracking.asset_id,
        CASE WHEN NOT v_tracking.has_operator THEN 'Asignar Operador' ELSE 'Completar Checklist' END
      )
      ON CONFLICT DO NOTHING; -- Prevent duplicates
    END IF;
    
    -- If emergency or critical for 48+ hours, also notify secondary
    IF v_tracking.alert_level IN ('emergency', 'critical') 
       AND v_tracking.last_notified_at IS NOT NULL
       AND v_tracking.last_notified_at < CURRENT_TIMESTAMP - INTERVAL '48 hours'
       AND v_tracking.secondary_responsible_user_id IS NOT NULL THEN
      
      INSERT INTO compliance_notifications (
        user_id,
        title,
        message,
        type,
        priority,
        entity_id,
        entity_type,
        action_url,
        action_label
      ) VALUES (
        v_tracking.secondary_responsible_user_id,
        '⬆️ ESCALADO: ' || v_title,
        '[ESCALADO] ' || v_message || ' - El responsable primario no ha respondido en 48 horas.',
        'compliance_critical',
        'critical',
        v_tracking.asset_id,
        'asset',
        '/compliance/activos-olvidados',
        'Revisar Activo'
      )
      ON CONFLICT DO NOTHING;
      
      UPDATE asset_accountability_tracking
      SET 
        last_escalated_at = NOW(),
        escalation_count = escalation_count + 1
      WHERE id = v_tracking.id;
    END IF;
    
    -- Update tracking
    UPDATE asset_accountability_tracking
    SET 
      last_notified_at = NOW(),
      notification_count = notification_count + 1
    WHERE id = v_tracking.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION escalate_forgotten_assets() IS 'Creates compliance notifications for forgotten assets and escalates if no response';

-- =====================================================
-- 3. PREVENT ASSET ORPHANING (Trigger Function)
-- =====================================================
CREATE OR REPLACE FUNCTION prevent_asset_orphaning()
RETURNS TRIGGER AS $$
DECLARE
  v_operator_in_new_plant BOOLEAN;
  v_jefe_planta_id UUID;
  v_asset_name TEXT;
BEGIN
  -- Detect plant change
  IF OLD.plant_id IS DISTINCT FROM NEW.plant_id AND NEW.plant_id IS NOT NULL THEN
    
    -- Check if current operator can access new plant
    SELECT EXISTS (
      SELECT 1 FROM asset_operators ao
      JOIN profiles p ON p.id = ao.operator_id
      WHERE ao.asset_id = NEW.id 
        AND ao.end_date IS NULL
        AND ao.status = 'active'
        AND ao.assignment_type = 'primary'
        AND p.plant_id = NEW.plant_id
    ) INTO v_operator_in_new_plant;
    
    -- Get asset and plant info
    SELECT NEW.name, p.plant_manager_id
    INTO v_asset_name, v_jefe_planta_id
    FROM plants p
    WHERE p.id = NEW.plant_id;
    
    -- If operator can't access new plant, create alert
    IF NOT v_operator_in_new_plant AND v_jefe_planta_id IS NOT NULL THEN
      
      -- Create urgent notification
      INSERT INTO compliance_notifications (
        user_id,
        title,
        message,
        type,
        priority,
        entity_id,
        entity_type,
        action_url,
        action_label
      ) VALUES (
        v_jefe_planta_id,
        '🚨 ACCIÓN REQUERIDA: Activo movido sin operador',
        'El activo ' || v_asset_name || ' fue movido a tu planta pero NO TIENE operador asignado válido. ' ||
        'ASIGNAR OPERADOR INMEDIATAMENTE para cumplir política de mantenimiento.',
        'asset_moved_orphaned',
        'critical',
        NEW.id,
        'asset',
        '/activos/' || NEW.id || '/asignar-operador',
        'Asignar Operador'
      )
      ON CONFLICT DO NOTHING;
      
      -- Trigger accountability refresh
      PERFORM refresh_asset_accountability();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION prevent_asset_orphaning() IS 'Detects when assets move to new plants without valid operators and creates alerts';

-- =====================================================
-- 4. DETECT OPERATOR UNASSIGNMENT (Trigger Function)
-- =====================================================
CREATE OR REPLACE FUNCTION detect_operator_unassignment()
RETURNS TRIGGER AS $$
DECLARE
  v_asset_name TEXT;
  v_jefe_planta_id UUID;
BEGIN
  -- When primary operator assignment is ended
  IF NEW.end_date IS NOT NULL AND OLD.end_date IS NULL AND NEW.assignment_type = 'primary' THEN
    
    -- Get asset info
    SELECT a.name, p.plant_manager_id
    INTO v_asset_name, v_jefe_planta_id
    FROM assets a
    JOIN plants p ON p.id = a.plant_id
    WHERE a.id = NEW.asset_id;
    
    -- Check if there's another primary operator
    IF NOT EXISTS (
      SELECT 1 FROM asset_operators
      WHERE asset_id = NEW.asset_id
        AND assignment_type = 'primary'
        AND end_date IS NULL
        AND status = 'active'
        AND id != NEW.id
    ) AND v_jefe_planta_id IS NOT NULL THEN
      -- Create alert for plant manager
      INSERT INTO compliance_notifications (
        user_id,
        title,
        message,
        type,
        priority,
        entity_id,
        entity_type,
        action_url,
        action_label
      ) VALUES (
        v_jefe_planta_id,
        '⚠️ Activo quedó sin operador',
        'El activo ' || v_asset_name || ' ya no tiene operador primario asignado. ' ||
        'Asignar nuevo operador para evitar incumplimiento de checklists.',
        'asset_operator_removed',
        'high',
        NEW.asset_id,
        'asset',
        '/activos/' || NEW.asset_id || '/asignar-operador',
        'Asignar Operador'
      )
      ON CONFLICT DO NOTHING;
      
      -- Refresh accountability
      PERFORM refresh_asset_accountability();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION detect_operator_unassignment() IS 'Detects when primary operator assignment ends and creates alerts if no replacement';

-- =====================================================
-- 5. CAN ASSET OPERATE (Compliance Check Function)
-- =====================================================
CREATE OR REPLACE FUNCTION can_asset_operate(p_asset_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_asset RECORD;
  v_has_todays_checklist BOOLEAN;
  v_enforce_blocking BOOLEAN;
BEGIN
  -- Get asset requirements
  SELECT 
    a.status,
    a.plant_id
  INTO v_asset
  FROM assets a
  WHERE a.id = p_asset_id;
  
  -- If asset doesn't exist, deny
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- If asset is in maintenance, allow (maintenance is valid reason)
  IF v_asset.status IN ('maintenance', 'repair', 'out_of_service') THEN
    RETURN true;
  END IF;
  
  -- Check enforcement setting
  SELECT (value::text)::boolean INTO v_enforce_blocking
  FROM system_settings
  WHERE key = 'enforce_asset_blocking'
  LIMIT 1;
  
  -- If enforcement is disabled, allow
  IF v_enforce_blocking IS NULL OR v_enforce_blocking = false THEN
    RETURN true;
  END IF;
  
  -- Check if today's daily checklist exists
  SELECT EXISTS (
    SELECT 1 FROM completed_checklists cc
    JOIN checklists c ON c.id = cc.checklist_id
    WHERE cc.asset_id = p_asset_id
      AND c.frequency = 'diario'
      AND DATE(cc.completion_date) = CURRENT_DATE
  ) INTO v_has_todays_checklist;
  
  RETURN v_has_todays_checklist;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION can_asset_operate(UUID) IS 'Checks if asset can perform operations (fuel loading, etc.) based on compliance status and enforcement settings';

GRANT EXECUTE ON FUNCTION can_asset_operate(UUID) TO authenticated;

-- =====================================================
-- 6. ENFORCE CHECKLIST BEFORE OPERATION (Trigger Function - Soft Block)
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_checklist_before_operation()
RETURNS TRIGGER AS $$
DECLARE
  v_can_operate BOOLEAN;
  v_asset_name TEXT;
  v_enforce_blocking BOOLEAN;
BEGIN
  -- Only check consumption transactions
  IF NEW.transaction_type != 'consumption' OR NEW.asset_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if asset can operate
  SELECT can_asset_operate(NEW.asset_id) INTO v_can_operate;
  
  -- Get enforcement setting
  SELECT (value::text)::boolean INTO v_enforce_blocking
  FROM system_settings
  WHERE key = 'enforce_asset_blocking'
  LIMIT 1;
  
  -- Get asset name
  SELECT name INTO v_asset_name FROM assets WHERE id = NEW.asset_id;
  
  IF NOT v_can_operate THEN
    -- If hard blocking enabled, raise exception
    IF v_enforce_blocking = true THEN
      RAISE EXCEPTION 'OPERACIÓN BLOQUEADA: % no puede cargar combustible sin completar checklist diario (Política 3.3 + 3.6)',
        v_asset_name
      USING HINT = 'Complete el checklist diario antes de operar el equipo';
    ELSE
      -- Soft block: Create warning notification but allow transaction
      INSERT INTO compliance_notifications (
        user_id,
        title,
        message,
        type,
        priority,
        entity_id,
        entity_type,
        action_url,
        action_label
      )
      SELECT 
        ao.operator_id,
        '⚠️ ADVERTENCIA: Operación sin checklist',
        'El activo ' || v_asset_name || ' está siendo usado sin completar el checklist diario. ' ||
        'Complete el checklist para evitar sanciones futuras.',
        'compliance_warning',
        'high',
        NEW.asset_id,
        'asset',
        '/checklists/assets/' || NEW.asset_id,
        'Completar Checklist'
      FROM asset_operators ao
      WHERE ao.asset_id = NEW.asset_id
        AND ao.end_date IS NULL
        AND ao.status = 'active'
        AND ao.assignment_type = 'primary'
      LIMIT 1
      ON CONFLICT DO NOTHING;
      
      -- Allow transaction to proceed (soft block)
      RETURN NEW;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION enforce_checklist_before_operation() IS 'Enforces checklist completion before operations (respects soft block toggle)';

-- =====================================================
-- 7. CREATE TRIGGERS
-- =====================================================

-- Trigger on asset plant changes
DROP TRIGGER IF EXISTS prevent_asset_orphaning_trigger ON assets;
CREATE TRIGGER prevent_asset_orphaning_trigger
AFTER UPDATE OF plant_id ON assets
FOR EACH ROW
WHEN (OLD.plant_id IS DISTINCT FROM NEW.plant_id)
EXECUTE FUNCTION prevent_asset_orphaning();

-- Trigger on operator unassignment
DROP TRIGGER IF EXISTS detect_operator_unassignment_trigger ON asset_operators;
CREATE TRIGGER detect_operator_unassignment_trigger
AFTER UPDATE OF end_date ON asset_operators
FOR EACH ROW
EXECUTE FUNCTION detect_operator_unassignment();

-- Trigger on diesel transactions (if diesel_transactions table exists)
-- Note: This will only be created if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'diesel_transactions') THEN
    DROP TRIGGER IF EXISTS enforce_checklist_before_fuel_trigger ON diesel_transactions;
    CREATE TRIGGER enforce_checklist_before_fuel_trigger
    BEFORE INSERT ON diesel_transactions
    FOR EACH ROW
    WHEN (NEW.asset_id IS NOT NULL AND NEW.transaction_type = 'consumption')
    EXECUTE FUNCTION enforce_checklist_before_operation();
  END IF;
END $$;

-- =====================================================
-- 8. INITIAL DATA POPULATION
-- =====================================================
-- Run initial refresh to populate asset_accountability_tracking
SELECT refresh_asset_accountability();

-- =====================================================
-- Functions Complete
-- =====================================================
-- Summary:
-- ✅ refresh_asset_accountability(): Main health check (run every 6 hours)
-- ✅ escalate_forgotten_assets(): Creates notifications (run daily)
-- ✅ prevent_asset_orphaning(): Trigger on asset plant changes
-- ✅ detect_operator_unassignment(): Trigger on operator end_date
-- ✅ can_asset_operate(): Compliance check function
-- ✅ enforce_checklist_before_operation(): Soft block trigger
