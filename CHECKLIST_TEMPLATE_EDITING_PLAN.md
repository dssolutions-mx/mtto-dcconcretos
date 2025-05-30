# Plan de Implementación: Edición de Plantillas de Checklist

## 1. Análisis de la Infraestructura Actual

### 1.1 Estado Actual del Sistema
- **1 plantilla de checklist** en desarrollo
- **6 checklists completados** (datos de desarrollo)
- **0 incidentes** registrados desde checklists
- Sistema principal en producción, módulo de checklists en desarrollo

### 1.2 Arquitectura de Base de Datos Analizada

#### Tablas Principales
- `checklists` - Plantillas de checklist (1 registro)
- `checklist_sections` - Secciones de las plantillas
- `checklist_items` - Ítems individuales de verificación
- `checklist_schedules` - Programaciones de ejecución
- `completed_checklists` - Registros de ejecución (6 registros)
- `checklist_issues` - Problemas detectados durante ejecución

#### Funciones Críticas Identificadas
1. **`mark_checklist_as_completed`** - Procesa completado de checklist
2. **`generate_corrective_work_order_enhanced`** - Genera órdenes correctivas
3. **`create_incident_from_checklist_issue`** - Crea incidentes desde problemas
4. **`schedule_checklists_for_model`** - Programa checklists automáticamente
5. **`reschedule_completed_checklist`** - Reprograma checklists recurrentes

#### Triggers Activos
1. **`trigger_schedule_checklists_for_model`** - Auto-programa para nuevos modelos
2. **`trigger_schedule_checklists_for_new_asset`** - Auto-programa para nuevos activos
3. **`trigger_reschedule_completed_checklist`** - Reprogramación automática
4. **`after_checklist_issue_created`** - Notificaciones de problemas

## 2. Propuesta de Implementación: Sistema de Versionado

### 2.1 Arquitectura de Versionado

```sql
-- Nueva tabla para versiones de plantillas
CREATE TABLE checklist_template_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES checklists(id),
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  model_id UUID REFERENCES equipment_models(id),
  frequency TEXT,
  hours_interval INTEGER,
  sections JSONB NOT NULL, -- Snapshot completo de secciones e ítems
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  change_summary TEXT, -- Resumen de cambios
  migration_notes TEXT, -- Notas para migración
  
  UNIQUE(template_id, version_number)
);

-- Tabla para rastrear qué versión se usó en cada ejecución
ALTER TABLE completed_checklists 
ADD COLUMN template_version_id UUID REFERENCES checklist_template_versions(id);

-- Índices para performance
CREATE INDEX idx_template_versions_template_id ON checklist_template_versions(template_id);
CREATE INDEX idx_template_versions_active ON checklist_template_versions(template_id, is_active) WHERE is_active = true;
```

### 2.2 Funciones de Migración y Versionado

```sql
-- Función para crear nueva versión de plantilla
CREATE OR REPLACE FUNCTION create_template_version(
  p_template_id UUID,
  p_change_summary TEXT DEFAULT 'Cambios en plantilla',
  p_migration_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_version_id UUID;
  v_next_version INTEGER;
  v_template RECORD;
  v_sections JSONB;
BEGIN
  -- Obtener siguiente número de versión
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO v_next_version 
  FROM checklist_template_versions 
  WHERE template_id = p_template_id;
  
  -- Obtener datos actuales de la plantilla
  SELECT * INTO v_template FROM checklists WHERE id = p_template_id;
  
  -- Crear snapshot de secciones e ítems
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'order_index', s.order_index,
      'items', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'description', i.description,
            'required', i.required,
            'order_index', i.order_index,
            'item_type', i.item_type,
            'expected_value', i.expected_value,
            'tolerance', i.tolerance
          ) ORDER BY i.order_index
        )
        FROM checklist_items i 
        WHERE i.section_id = s.id
      )
    ) ORDER BY s.order_index
  ) INTO v_sections
  FROM checklist_sections s 
  WHERE s.checklist_id = p_template_id;
  
  -- Desactivar versión anterior
  UPDATE checklist_template_versions 
  SET is_active = FALSE 
  WHERE template_id = p_template_id;
  
  -- Crear nueva versión
  INSERT INTO checklist_template_versions (
    template_id,
    version_number,
    name,
    description,
    model_id,
    frequency,
    hours_interval,
    sections,
    is_active,
    change_summary,
    migration_notes,
    created_by
  ) VALUES (
    p_template_id,
    v_next_version,
    v_template.name,
    v_template.description,
    v_template.model_id,
    v_template.frequency,
    v_template.hours_interval,
    v_sections,
    TRUE,
    p_change_summary,
    p_migration_notes,
    (SELECT auth.uid())
  ) RETURNING id INTO v_version_id;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql;

-- Función para restaurar versión específica
CREATE OR REPLACE FUNCTION restore_template_version(
  p_version_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_version RECORD;
  v_section JSONB;
  v_item JSONB;
  v_section_id UUID;
BEGIN
  -- Obtener datos de la versión
  SELECT * INTO v_version FROM checklist_template_versions WHERE id = p_version_id;
  
  -- Actualizar plantilla principal
  UPDATE checklists SET
    name = v_version.name,
    description = v_version.description,
    model_id = v_version.model_id,
    frequency = v_version.frequency,
    hours_interval = v_version.hours_interval,
    updated_at = NOW(),
    updated_by = (SELECT auth.uid())
  WHERE id = v_version.template_id;
  
  -- Eliminar secciones e ítems actuales
  DELETE FROM checklist_items WHERE section_id IN (
    SELECT id FROM checklist_sections WHERE checklist_id = v_version.template_id
  );
  DELETE FROM checklist_sections WHERE checklist_id = v_version.template_id;
  
  -- Recrear secciones e ítems desde la versión
  FOR v_section IN SELECT jsonb_array_elements(v_version.sections)
  LOOP
    INSERT INTO checklist_sections (
      checklist_id, title, order_index, created_by
    ) VALUES (
      v_version.template_id,
      v_section->>'title',
      (v_section->>'order_index')::INTEGER,
      (SELECT auth.uid())
    ) RETURNING id INTO v_section_id;
    
    FOR v_item IN SELECT jsonb_array_elements(v_section->'items')
    LOOP
      INSERT INTO checklist_items (
        section_id,
        description,
        required,
        order_index,
        item_type,
        expected_value,
        tolerance,
        created_by
      ) VALUES (
        v_section_id,
        v_item->>'description',
        COALESCE((v_item->>'required')::BOOLEAN, TRUE),
        (v_item->>'order_index')::INTEGER,
        COALESCE(v_item->>'item_type', 'check'),
        v_item->>'expected_value',
        v_item->>'tolerance',
        (SELECT auth.uid())
      );
    END LOOP;
  END LOOP;
  
  -- Marcar esta versión como activa
  UPDATE checklist_template_versions 
  SET is_active = FALSE 
  WHERE template_id = v_version.template_id;
  
  UPDATE checklist_template_versions 
  SET is_active = TRUE 
  WHERE id = p_version_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

### 2.3 Modificación de Funciones Existentes

```sql
-- Actualizar función de completado para referenciar versión
CREATE OR REPLACE FUNCTION mark_checklist_as_completed_versioned(
  p_schedule_id UUID,
  p_completed_items JSONB,
  p_technician TEXT,
  p_notes TEXT DEFAULT NULL,
  p_signature_data TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_checklist_id UUID;
  v_asset_id UUID;
  v_template_version_id UUID;
  v_status TEXT := 'Completado';
  v_item JSONB;
  v_completed_id UUID;
  v_has_issues BOOLEAN := FALSE;
BEGIN
  -- Obtener información de la programación
  SELECT template_id, asset_id 
  INTO v_checklist_id, v_asset_id
  FROM checklist_schedules
  WHERE id = p_schedule_id;
  
  -- Obtener versión activa de la plantilla
  SELECT id INTO v_template_version_id
  FROM checklist_template_versions
  WHERE template_id = v_checklist_id AND is_active = TRUE;
  
  -- Verificar si hay problemas
  FOR v_item IN SELECT jsonb_array_elements(p_completed_items)
  LOOP
    IF v_item->>'status' = 'flag' OR v_item->>'status' = 'fail' THEN
      v_has_issues := TRUE;
      v_status := 'Con Problemas';
    END IF;
  END LOOP;
  
  -- Registrar el checklist completado con referencia a versión
  INSERT INTO completed_checklists (
    checklist_id,
    template_version_id, -- Nueva columna
    asset_id,
    completed_items,
    technician,
    completion_date,
    notes,
    status,
    signature_data
  ) VALUES (
    v_checklist_id,
    v_template_version_id,
    v_asset_id,
    p_completed_items,
    p_technician,
    NOW(),
    p_notes,
    v_status,
    p_signature_data
  ) RETURNING id INTO v_completed_id;
  
  -- Resto de la lógica existente...
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'completed_id', v_completed_id,
    'template_version_id', v_template_version_id,
    'has_issues', v_has_issues
  );
END;
$$ LANGUAGE plpgsql;
```

## 3. Estrategia de Migración

### 3.1 Migración de Datos Existentes

```sql
-- Script de migración para datos existentes
DO $$
DECLARE
  v_template RECORD;
  v_version_id UUID;
BEGIN
  -- Para cada plantilla existente, crear versión inicial
  FOR v_template IN SELECT * FROM checklists
  LOOP
    SELECT create_template_version(
      v_template.id,
      'Versión inicial - migración automática',
      'Creada durante migración del sistema de versionado'
    ) INTO v_version_id;
    
    -- Asociar checklists completados existentes con esta versión
    UPDATE completed_checklists 
    SET template_version_id = v_version_id
    WHERE checklist_id = v_template.id
      AND template_version_id IS NULL;
  END LOOP;
END;
$$;
```

### 3.2 Actualización de Triggers

```sql
-- Actualizar trigger de programación para considerar versiones
CREATE OR REPLACE FUNCTION schedule_checklists_for_model_versioned()
RETURNS TRIGGER AS $$
DECLARE
  v_asset RECORD;
  v_next_date TIMESTAMP WITH TIME ZONE;
  v_interval_days INTEGER;
  v_active_version_id UUID;
BEGIN
  -- Solo proceder si el checklist tiene un modelo asociado y una frecuencia definida
  IF NEW.model_id IS NOT NULL AND NEW.frequency IS NOT NULL THEN
    -- Crear versión inicial si no existe
    SELECT id INTO v_active_version_id
    FROM checklist_template_versions
    WHERE template_id = NEW.id AND is_active = TRUE;
    
    IF v_active_version_id IS NULL THEN
      SELECT create_template_version(NEW.id, 'Versión inicial') INTO v_active_version_id;
    END IF;
    
    -- Resto de la lógica existente...
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## 4. Impacto en Checklists Completados

### 4.1 Preservación de Integridad Histórica

#### ✅ Ventajas del Sistema de Versionado
- **Inmutabilidad**: Los checklists completados mantienen referencia a la versión exacta utilizada
- **Trazabilidad**: Capacidad de auditar qué cambios se hicieron y cuándo
- **Consistencia**: Los reportes históricos son coherentes con la versión utilizada
- **Flexibilidad**: Permite evolución de plantillas sin afectar datos históricos

#### ✅ Casos de Uso Protegidos
1. **Auditorías**: Los auditores pueden ver exactamente qué se verificó en cada fecha
2. **Análisis de Tendencias**: Las métricas históricas mantienen su contexto original
3. **Investigación de Incidentes**: Se puede reproducir el checklist exacto que detectó un problema
4. **Cumplimiento Normativo**: Los registros históricos son inmutables y verificables

### 4.2 Estrategias de Migración de Plantillas

#### Para Cambios Menores (Agregado de ítems)
```sql
-- Los nuevos ítems no afectan checklists pasados
-- Se pueden agregar sin crear nueva versión mayor
```

#### Para Cambios Significativos (Eliminación/Modificación)
```sql
-- Crear nueva versión
-- Migrar programaciones futuras a nueva versión
-- Mantener programaciones en curso con versión anterior
```

#### Para Cambios Críticos (Restructuración)
```sql
-- Crear nueva plantilla
-- Deprecar plantilla anterior (no eliminar)
-- Migrar activos gradualmente
```

## 5. Implementación por Fases

### Fase 1: Infraestructura de Versionado (1-2 semanas)
- [x] Crear tablas de versionado
- [ ] Implementar funciones de versionado
- [ ] Migrar datos existentes
- [ ] Actualizar triggers existentes

### Fase 2: Interface de Edición (2-3 semanas)
- [ ] Crear componente de edición de plantillas
- [ ] Implementar previsualizador de cambios
- [ ] Agregar sistema de comentarios/changelog
- [ ] Implementar validaciones de negocio

### Fase 3: Gestión de Versiones (1-2 semanas)
- [ ] Interface de historial de versiones
- [ ] Funcionalidad de comparación entre versiones
- [ ] Sistema de restauración de versiones anteriores
- [ ] Herramientas de migración de datos

### Fase 4: Reportes y Análisis (1 semana)
- [ ] Adaptar reportes para considerar versiones
- [ ] Dashboard de impacto de cambios
- [ ] Métricas de uso por versión
- [ ] Alertas de inconsistencias

## 6. Validaciones y Reglas de Negocio

### 6.1 Reglas de Modificación
- ❌ **No permitir**: Eliminar ítems críticos de seguridad
- ❌ **No permitir**: Cambios retroactivos en plantillas con ejecuciones activas
- ✅ **Permitir**: Agregar nuevos ítems opcionales
- ✅ **Permitir**: Modificar descripciones para clarificación
- ✅ **Permitir**: Reordenar secciones/ítems

### 6.2 Validaciones Automáticas
```sql
-- Trigger de validación antes de crear versión
CREATE OR REPLACE FUNCTION validate_template_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar que no se eliminen ítems críticos
  -- Validar que los cambios no rompan programaciones activas
  -- Etc.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## 7. Métricas y Monitoreo

### 7.1 KPIs del Sistema de Versionado
- Frecuencia de cambios por plantilla
- Impacto de cambios en detección de problemas
- Tiempo promedio entre versiones
- Adopción de nuevas versiones

### 7.2 Alertas Automáticas
- Plantillas con más de X versiones en Y período
- Versiones con baja adopción
- Inconsistencias en programaciones
- Problemas de migración de datos

## 8. Consideraciones de Performance

### 8.1 Optimizaciones
- Índices específicos para consultas de versiones
- Cache de versiones activas
- Particionado por fecha de versiones antiguas
- Compresión de snapshots JSON grandes

### 8.2 Limpieza de Datos
- Política de retención de versiones antiguas
- Archivado de versiones no utilizadas
- Compactación de snapshots redundantes

## 9. Plan de Rollback

### 9.1 Estrategia de Reversión
- Mantener funciones originales como fallback
- Script de rollback de migraciones
- Backup completo antes de migración
- Procedimiento de restauración de datos

## 10. Conclusiones

Este plan aprovecha que el sistema de checklists está en desarrollo para implementar un sistema de versionado robusto que:

- **Protege la integridad** de los datos históricos existentes (6 registros)
- **Habilita la evolución** de plantillas sin romper funcionabilidad existente
- **Mantiene la trazabilidad** completa de cambios
- **Preserva las integraciones** existentes con el sistema de órdenes de trabajo e incidentes
- **Escala eficientemente** para el crecimiento futuro del sistema

La implementación gradual permite validar cada fase antes de continuar, minimizando riesgos y asegurando estabilidad del sistema productivo.