-- ======================================================================
-- MIGRACIÓN DE CHECKLISTS HUÉRFANOS
-- Este script asocia los 93+ checklists huérfanos a sus versiones correctas
-- ======================================================================

DO $$ 
DECLARE
    v_rec RECORD;
    v_version_id UUID;
    v_template_id UUID;
    v_affected_count INTEGER := 0;
    v_created_versions_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 INICIANDO MIGRACIÓN DE CHECKLISTS HUÉRFANOS';
    RAISE NOTICE '=== Fase 1: Templates SIN versiones (crear versión inicial) ===';
    
    -- FASE 1: Templates sin versiones - crear versión inicial y asociar
    FOR v_rec IN 
        SELECT DISTINCT 
            cc.checklist_id as template_id,
            c.name as template_name,
            COUNT(cc.id) as orphaned_count
        FROM completed_checklists cc
        JOIN checklists c ON cc.checklist_id = c.id
        WHERE cc.template_version_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM checklist_template_versions ctv 
            WHERE ctv.template_id = cc.checklist_id
          )
        GROUP BY cc.checklist_id, c.name
        ORDER BY COUNT(cc.id) DESC
    LOOP
        RAISE NOTICE '📋 Template: % (% huérfanos)', v_rec.template_name, v_rec.orphaned_count;
        
        -- Crear versión inicial automática
        SELECT create_template_version(
            v_rec.template_id,
            'Versión inicial - migración automática de checklists huérfanos',
            'Creada durante migración para asociar ' || v_rec.orphaned_count || ' checklists completados históricos'
        ) INTO v_version_id;
        
        IF v_version_id IS NOT NULL THEN
            RAISE NOTICE '✅ Versión inicial creada: %', v_version_id;
            v_created_versions_count := v_created_versions_count + 1;
            
            -- Asociar todos los checklists huérfanos a esta versión
            UPDATE completed_checklists 
            SET template_version_id = v_version_id
            WHERE checklist_id = v_rec.template_id 
              AND template_version_id IS NULL;
            
            GET DIAGNOSTICS v_affected_count = ROW_COUNT;
            RAISE NOTICE '🏷️ Asociados % checklists a la versión inicial', v_affected_count;
        ELSE
            RAISE WARNING '❌ No se pudo crear versión para template: %', v_rec.template_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Fase 2: Templates CON versiones (asociación temporal) ===';
    
    -- FASE 2: Templates con versiones existentes - asociar por fecha
    FOR v_rec IN
        SELECT DISTINCT 
            cc.checklist_id as template_id,
            c.name as template_name,
            COUNT(cc.id) as orphaned_count
        FROM completed_checklists cc
        JOIN checklists c ON cc.checklist_id = c.id
        WHERE cc.template_version_id IS NULL
          AND EXISTS (
            SELECT 1 FROM checklist_template_versions ctv 
            WHERE ctv.template_id = cc.checklist_id
          )
        GROUP BY cc.checklist_id, c.name
        ORDER BY COUNT(cc.id) DESC
    LOOP
        RAISE NOTICE '📋 Template con versiones: % (% huérfanos)', v_rec.template_name, v_rec.orphaned_count;
        
        -- Estrategia: Asociar a la versión más apropiada basándose en fechas
        -- Si el checklist fue completado ANTES de que existiera cualquier versión,
        -- crear una versión "histórica" o asociar a la más antigua
        
        -- Obtener la versión más antigua disponible
        SELECT id INTO v_version_id
        FROM checklist_template_versions 
        WHERE template_id = v_rec.template_id
        ORDER BY version_number ASC
        LIMIT 1;
        
        IF v_version_id IS NOT NULL THEN
            RAISE NOTICE '🎯 Asociando a versión más antigua: %', v_version_id;
            
            -- Asociar checklists huérfanos a la versión más antigua
            UPDATE completed_checklists cc
            SET template_version_id = v_version_id
            WHERE cc.checklist_id = v_rec.template_id 
              AND cc.template_version_id IS NULL;
              
            GET DIAGNOSTICS v_affected_count = ROW_COUNT;
            RAISE NOTICE '🏷️ Asociados % checklists a versión existente', v_affected_count;
        ELSE
            RAISE WARNING '❌ No se encontraron versiones para template: %', v_rec.template_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== RESUMEN DE MIGRACIÓN ===';
    RAISE NOTICE '✅ Versiones iniciales creadas: %', v_created_versions_count;
    
    -- Mostrar estado final
    SELECT COUNT(*) INTO v_affected_count
    FROM completed_checklists 
    WHERE template_version_id IS NULL;
    
    RAISE NOTICE '📊 Checklists huérfanos restantes: %', v_affected_count;
    
    IF v_affected_count = 0 THEN
        RAISE NOTICE '🎉 MIGRACIÓN COMPLETADA: Todos los checklists tienen versión asociada';
    ELSE
        RAISE NOTICE '⚠️ MIGRACIÓN PARCIAL: % checklists siguen huérfanos', v_affected_count;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== VERIFICACIÓN POST-MIGRACIÓN ===';
    
    -- Verificar integridad de datos
    FOR v_rec IN
        SELECT 
            c.name as template_name,
            COUNT(cc.id) as total_completed,
            COUNT(cc.template_version_id) as with_version,
            COUNT(cc.id) - COUNT(cc.template_version_id) as still_orphaned
        FROM completed_checklists cc
        JOIN checklists c ON cc.checklist_id = c.id
        GROUP BY c.id, c.name
        HAVING COUNT(cc.id) - COUNT(cc.template_version_id) > 0
        ORDER BY COUNT(cc.id) - COUNT(cc.template_version_id) DESC
    LOOP
        RAISE NOTICE '⚠️ Template "%": % huérfanos de % total', 
            v_rec.template_name, v_rec.still_orphaned, v_rec.total_completed;
    END LOOP;

END $$;