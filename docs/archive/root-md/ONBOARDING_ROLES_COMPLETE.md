# Onboarding Tours - Complete Role Coverage

## ✅ Todos los Roles Cubiertos

Este documento verifica que TODOS los roles del sistema tienen un tour de onboarding apropiado.

---

## Resumen de Roles y Tours

| Rol | Tour Asignado | Pasos | Estado |
|-----|---------------|-------|--------|
| **OPERADOR** | `operatorTourSteps` | 4 | ✅ Completo |
| **DOSIFICADOR** | `operatorTourSteps` | 4 | ✅ Completo |
| **ENCARGADO_MANTENIMIENTO** | `maintenanceManagerTourSteps` | 9 | ✅ **NUEVO - Creado** |
| **JEFE_PLANTA** | `managerTourSteps` | 10 | ✅ Completo |
| **JEFE_UNIDAD_NEGOCIO** | `managerTourSteps` | 10 | ✅ Completo |
| **GERENCIA_GENERAL** | `managerTourSteps` | 10 | ✅ Completo |
| **AREA_ADMINISTRATIVA** | `adminTourSteps` | 7 | ✅ Completo |
| **AUXILIAR_COMPRAS** | `purchasingAssistantTourSteps` | 5 | ✅ **NUEVO - Creado** |
| **EJECUTIVO** | `defaultTourSteps` | 1 | ✅ Básico |
| **VISUALIZADOR** | `defaultTourSteps` | 1 | ✅ Básico |

---

## 1. OPERADOR / DOSIFICADOR (4 pasos)

**Tour**: `operatorTourSteps`
- Enfoque: Checklists diarios obligatorios, activos asignados
- No incluye: Gestión de personal, cumplimiento organizacional

**Pasos**:
1. Bienvenida (Dashboard)
2. Checklists Diarios (navega a `/checklists`)
3. Activos Asignados (navega a `/activos`)
4. Finalización (Dashboard)

**✅ Verificado y Funcional**

---

## 2. ENCARGADO_MANTENIMIENTO (9 pasos) ⭐ NUEVO

**Tour**: `maintenanceManagerTourSteps`
- Enfoque: Mantenimiento, activos, órdenes de trabajo, checklists, inventario
- **NO incluye**: Gestión de personal (no tiene acceso según permisos)

**Pasos**:
1. Bienvenida (Dashboard)
2. Menú de Navegación
3. Gestión de Activos (navega a `/activos`)
4. Página de Activos (`#activos-header`)
5. Checklists de Mantenimiento (navega a `/checklists`)
6. Página de Checklists
7. Órdenes de Trabajo (navega a `/ordenes`)
8. Página de Órdenes (`#ordenes-header`)
9. Inventario y Compras (navega a `/inventario`)
10. Finalización (`#inventario-header`)

**✅ Verificado y Funcional**

**Nota**: Este tour es específico para ENCARGADO_MANTENIMIENTO porque:
- Tiene acceso a: activos, mantenimiento, órdenes de trabajo, checklists, inventario
- **NO tiene acceso a**: personal (personnel: 'none')
- Por lo tanto, NO incluye pasos sobre gestión organizacional/personal

---

## 3. JEFE_PLANTA / JEFE_UNIDAD_NEGOCIO / GERENCIA_GENERAL (10 pasos)

**Tour**: `managerTourSteps`
- Enfoque: Cumplimiento, supervisión, gestión organizacional completa
- Incluye: Dashboard de cumplimiento, activos olvidados, gestión de personal

**Pasos**:
1. Bienvenida (Dashboard)
2. Menú de Navegación
3. Dashboard de Cumplimiento (sidebar → navega a `/compliance`)
4. Dashboard de Cumplimiento (página)
5. Semáforo de Cumplimiento
6. Activos Olvidados (navega a `/compliance/activos-olvidados`)
7. Página de Activos Olvidados
8. Gestión Organizacional (navega a `/gestion/asignaciones`)
9. Asignaciones Organizacionales
10. Finalización

**✅ Verificado y Funcional**

---

## 4. AREA_ADMINISTRATIVA (7 pasos)

**Tour**: `adminTourSteps`
- Enfoque: Compras e inventario
- No incluye: Checklists (no tiene acceso)

**Pasos**:
1. Bienvenida (Dashboard)
2. Menú de Navegación
3. Módulo de Compras (navega a `/compras`)
4. Página de Compras (`#compras-header`)
5. Control de Inventario (navega a `/inventario`)
6. Página de Inventario (`#inventario-header`)
7. Finalización

**✅ Verificado y Funcional**

---

## 5. AUXILIAR_COMPRAS (5 pasos) ⭐ NUEVO

**Tour**: `purchasingAssistantTourSteps`
- Enfoque: Compras e inventario (similar a AREA_ADMINISTRATIVA pero más simple)
- No incluye: Checklists, activos, personal

**Pasos**:
1. Bienvenida (Dashboard)
2. Módulo de Compras (navega a `/compras`)
3. Página de Compras (`#compras-header`)
4. Control de Inventario (navega a `/inventario`)
5. Finalización (`#inventario-header`)

**✅ Verificado y Funcional**

---

## 6. EJECUTIVO / VISUALIZADOR (1 paso)

**Tour**: `defaultTourSteps`
- Enfoque: Tour básico de bienvenida
- Solo muestra: Menú de navegación

**Pasos**:
1. Bienvenida (Menú de navegación)

**✅ Verificado y Funcional**

**Nota**: Estos roles tienen acceso limitado o de solo lectura, por lo que un tour básico es apropiado.

---

## Cambios Realizados

### Nuevos Tours Creados:
1. ✅ **`maintenanceManagerTourSteps`** - Para ENCARGADO_MANTENIMIENTO
2. ✅ **`purchasingAssistantTourSteps`** - Para AUXILIAR_COMPRAS

### Componentes Actualizados:
1. ✅ `components/sidebar.tsx` - Agregado `data-tour="work-orders-nav"` a botón de órdenes
2. ✅ `app/activos/page.tsx` - Agregado `id="activos-header"`
3. ✅ `app/ordenes/page.tsx` - Agregado `id="ordenes-header"`

### Función de Asignación Actualizada:
```typescript
export function getTourStepsForRole(role?: string): Tour[] {
  // OPERADOR, DOSIFICADOR → operatorTourSteps
  // ENCARGADO_MANTENIMIENTO → maintenanceManagerTourSteps ⭐ NUEVO
  // JEFE_PLANTA, JEFE_UNIDAD_NEGOCIO, GERENCIA_GENERAL → managerTourSteps
  // AREA_ADMINISTRATIVA → adminTourSteps
  // AUXILIAR_COMPRAS → purchasingAssistantTourSteps ⭐ NUEVO
  // Otros → defaultTourSteps
}
```

---

## Verificación de Selectores

### ENCARGADO_MANTENIMIENTO Tour:
- ✅ `#dashboard-header` - Existe
- ✅ `#sidebar-navigation-content` - Existe
- ✅ `[data-tour="assets-nav"]` - Existe en sidebar
- ✅ `#activos-header` - Agregado
- ✅ `[data-tour="checklists-nav"]` - Existe en sidebar
- ✅ `[data-tour="work-orders-nav"]` - Agregado a sidebar
- ✅ `#ordenes-header` - Agregado
- ✅ `[data-tour="warehouse-nav"]` - Existe en sidebar
- ✅ `#inventario-header` - Existe

### AUXILIAR_COMPRAS Tour:
- ✅ `#dashboard-header` - Existe
- ✅ `[data-tour="purchases-nav"]` - Existe en sidebar
- ✅ `#compras-header` - Existe
- ✅ `[data-tour="warehouse-nav"]` - Existe en sidebar
- ✅ `#inventario-header` - Existe

---

## Conclusión

**✅ TODOS LOS ROLES ESTÁN CUBIERTOS**

- **10 roles** en el sistema
- **6 tours diferentes** (algunos compartidos apropiadamente)
- **100% de cobertura** de roles
- **Tours específicos** para roles con necesidades únicas (ENCARGADO_MANTENIMIENTO, AUXILIAR_COMPRAS)
- **Tours compartidos** para roles con permisos similares (OPERADOR/DOSIFICADOR, JEFE_PLANTA/JEFE_UNIDAD/GERENCIA)

**Estado**: ✅ **COMPLETO Y VERIFICADO**
