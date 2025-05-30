# Plan de Implementación: Edición de Plantillas de Checklist

## 1. Resumen Ejecutivo

Este documento presenta una estrategia integral para habilitar la edición de plantillas de checklist manteniendo la integridad de los datos históricos y permitiendo la trazabilidad de cambios.

## 2. Desafíos Principales

### 2.1 Integridad de Datos Históricos
- Los checklists completados deben mantener su estructura original
- Los reportes históricos deben ser consistentes
- Las auditorías requieren datos inmutables

### 2.2 Trazabilidad de Cambios
- Necesidad de versionar las plantillas
- Rastrear qué versión se usó en cada ejecución
- Mantener historial de modificaciones

## 3. Arquitectura Propuesta

### 3.1 Sistema de Versionado de Plantillas

```sql
-- Nueva tabla para versiones de plantillas
CREATE TABLE checklist_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklists(id),
  version_number INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  model_id UUID REFERENCES equipment_models(id),
  frequency VARCHAR NOT NULL,
  interval_id UUID REFERENCES maintenance_intervals(id),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  change_summary TEXT,
  UNIQUE(template_id, version_number)
);

-- Tabla para secciones versionadas
CREATE TABLE checklist_section_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id UUID REFERENCES checklist_template_versions(id),
  title VARCHAR NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla para items versionados
CREATE TABLE checklist_item_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_version_id UUID REFERENCES checklist_section_versions(id),
  description TEXT NOT NULL,
  required BOOLEAN DEFAULT false,
  item_type VARCHAR DEFAULT 'check',
  expected_value TEXT,
  tolerance NUMERIC,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 Modificaciones a Tablas Existentes

```sql
-- Agregar referencia de versión a schedules
ALTER TABLE checklist_schedules 
ADD COLUMN template_version_id UUID REFERENCES checklist_template_versions(id);

-- Agregar referencia de versión a executions (si existe)
ALTER TABLE checklist_executions 
ADD COLUMN template_version_id UUID REFERENCES checklist_template_versions(id);
```

## 4. Estrategia de Implementación

### 4.1 Fase 1: Migración de Datos Existentes
1. **Crear tablas de versionado** con las estructuras definidas arriba
2. **Migrar plantillas existentes** como versión 1.0
3. **Actualizar referencias** en schedules y executions completados

```typescript
// Script de migración
async function migrateExistingTemplates() {
  // 1. Obtener todas las plantillas existentes
  const templates = await supabase
    .from('checklists')
    .select('*, checklist_sections(*, checklist_items(*))')

  for (const template of templates) {
    // 2. Crear versión 1.0 para cada plantilla
    const { data: version } = await supabase
      .from('checklist_template_versions')
      .insert({
        template_id: template.id,
        version_number: 1,
        name: template.name,
        description: template.description,
        model_id: template.model_id,
        frequency: template.frequency,
        interval_id: template.interval_id,
        is_active: true,
        change_summary: 'Versión inicial migrada'
      })
      .select('id')
      .single()

    // 3. Migrar secciones e items...
  }
}
```

### 4.2 Fase 2: Interfaz de Edición
1. **Crear formulario de edición** basado en el formulario de creación existente
2. **Implementar vista previa de cambios** antes de guardar
3. **Sistema de confirmación** para cambios significativos

### 4.3 Fase 3: API de Versionado
```typescript
// Endpoint para crear nueva versión
POST /api/checklists/templates/{id}/versions
{
  "changes": {
    "name": "Nuevo nombre",
    "sections": [...],
    "change_summary": "Descripción de cambios"
  }
}

// Endpoint para obtener versiones
GET /api/checklists/templates/{id}/versions

// Endpoint para activar versión específica
PUT /api/checklists/templates/{id}/versions/{version}/activate
```

## 5. Impacto en Checklists Completados

### 5.1 Principio de Inmutabilidad
- **Los checklists completados NUNCA cambian** su estructura
- Se mantiene referencia a la versión específica usada
- Los reportes históricos son consistentes

### 5.2 Estrategias de Visualización

#### Para Checklists Históricos:
```typescript
// Al mostrar un checklist completado
function renderCompletedChecklist(execution) {
  // Usar la versión específica que se ejecutó
  const templateVersion = execution.template_version_id
  
  // Mostrar advertencia si la plantilla ha cambiado
  if (!templateVersion.is_active) {
    showWarning("Esta ejecución usa una versión anterior de la plantilla")
  }
}
```

#### Para Reportes:
```typescript
// Agrupar por versión de plantilla
function generateReport(templateId, dateRange) {
  const executions = await getExecutions(templateId, dateRange)
  
  // Agrupar por versión para análisis consistente
  const groupedByVersion = groupBy(executions, 'template_version_id')
  
  return {
    summary: "Datos agregados de todas las versiones",
    versionBreakdown: groupedByVersion,
    migrations: getVersionChanges(templateId)
  }
}
```

## 6. Interfaz de Usuario

### 6.1 Editor de Plantillas
```typescript
// Componente principal de edición
function ChecklistTemplateEditor({ templateId }) {
  const [currentVersion, setCurrentVersion] = useState(null)
  const [draftChanges, setDraftChanges] = useState({})
  const [showVersionHistory, setShowVersionHistory] = useState(false)

  return (
    <div className="template-editor">
      <VersionHeader 
        currentVersion={currentVersion}
        onVersionSelect={setCurrentVersion}
        onShowHistory={() => setShowVersionHistory(true)}
      />
      
      <EditForm
        template={currentVersion}
        changes={draftChanges}
        onUpdate={setDraftChanges}
      />
      
      <PreviewChanges changes={draftChanges} />
      
      <SaveActions
        onSave={() => saveNewVersion(draftChanges)}
        onDiscard={() => setDraftChanges({})}
      />
    </div>
  )
}
```

### 6.2 Vista de Historial de Versiones
```typescript
function VersionHistory({ templateId }) {
  return (
    <div className="version-history">
      <Timeline>
        {versions.map(version => (
          <TimelineItem key={version.id}>
            <VersionCard
              version={version}
              onActivate={() => activateVersion(version.id)}
              onRevert={() => revertToVersion(version.id)}
              onCompare={() => showVersionComparison(version.id)}
            />
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  )
}
```

## 7. Consideraciones de Seguridad y Permisos

### 7.1 Control de Acceso
- Solo usuarios autorizados pueden editar plantillas
- Logs de auditoría para todos los cambios
- Aprobación requerida para cambios críticos

### 7.2 Validaciones
- Verificar que no hay ejecuciones activas antes de cambios mayores
- Prevenir eliminación de secciones/items críticos
- Validar integridad de datos antes de guardar

## 8. Plan de Migración Detallado

### 8.1 Preparación (Semana 1)
1. **Backup completo** de la base de datos
2. **Análisis de impacto** en plantillas existentes
3. **Pruebas en ambiente de desarrollo**

### 8.2 Implementación (Semana 2-3)
1. **Crear tablas de versionado** en producción
2. **Ejecutar script de migración** de datos existentes
3. **Desplegar nuevas APIs** con versionado

### 8.3 Activación (Semana 4)
1. **Habilitar interfaz de edición** para usuarios beta
2. **Monitoreo intensivo** de performance y errores
3. **Rollout gradual** a todos los usuarios

## 9. Métricas y Monitoreo

### 9.1 KPIs de Éxito
- **Tiempo de edición** de plantillas reducido en 50%
- **Cero pérdida** de datos históricos
- **100% de trazabilidad** en cambios

### 9.2 Alertas de Monitoreo
- Fallas en migración de versiones
- Inconsistencias en datos históricos
- Performance degradado en consultas

## 10. Beneficios Esperados

### 10.1 Para Usuarios
- **Flexibilidad total** para modificar plantillas
- **Visibilidad completa** del historial de cambios
- **Confianza** en la integridad de datos históricos

### 10.2 Para el Sistema
- **Escalabilidad** mejorada del sistema de checklists
- **Auditoría completa** de todos los cambios
- **Compatibilidad** con regulaciones de la industria

## 11. Riesgos y Mitigaciones

### 11.1 Riesgo: Complejidad de Consultas
- **Mitigación**: Indexes optimizados y views materialized
- **Monitoreo**: Performance continuo de queries

### 11.2 Riesgo: Confusión de Usuarios
- **Mitigación**: UI clara con indicadores de versión
- **Entrenamiento**: Documentación y sesiones de capacitación

### 11.3 Riesgo: Inconsistencia de Datos
- **Mitigación**: Validaciones estrictas y transacciones atómicas
- **Backup**: Puntos de restauración automáticos

## 12. Cronograma de Implementación

| Fase | Duración | Entregables |
|------|----------|-------------|
| Análisis y Diseño | 1 semana | Especificaciones técnicas |
| Desarrollo Backend | 2 semanas | APIs de versionado |
| Desarrollo Frontend | 2 semanas | Interfaz de edición |
| Testing y QA | 1 semana | Suite de pruebas completa |
| Migración | 1 semana | Datos migrados y validados |
| Deployment | 1 semana | Sistema en producción |

**Total estimado: 8 semanas**

## 13. Conclusiones

La implementación de edición de plantillas con versionado es crítica para la evolución del sistema de mantenimiento. Esta propuesta asegura:

1. **Flexibilidad operacional** sin comprometer datos históricos
2. **Trazabilidad completa** de todos los cambios
3. **Escalabilidad** para el crecimiento futuro del sistema

La estrategia de versionado garantiza que el sistema pueda evolucionar manteniendo la integridad de los datos existentes y proporcionando una experiencia de usuario superior. 