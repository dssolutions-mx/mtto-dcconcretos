# 📊 Estado de las Configuraciones del Sistema

## ✅ Configuraciones Existentes en la Base de Datos

### 1. **Feature Flags (Nuevos)**
| Key | Valor Actual | Estado | Uso |
|-----|--------------|--------|-----|
| `enable_onboarding_tour` | `false` | ✅ **Activo** | Controla si el tour de onboarding se muestra |
| `enable_policy_acknowledgment` | `false` | ✅ **Activo** | Controla si el modal de políticas aparece |

### 2. **Configuraciones de Cumplimiento**
| Key | Valor Actual | Estado | Uso |
|-----|--------------|--------|-----|
| `enforce_asset_blocking` | `false` | ✅ **Activo** | Usado en `can_asset_operate()` y `enforce_checklist_before_operation()` |
| `asset_grace_period_days` | `7` | ✅ **Activo** | Usado en `refresh_asset_accountability()` para excluir activos nuevos |

### 3. **Thresholds de Cumplimiento** ⚠️
| Key | Valor Actual | Estado | Uso |
|-----|--------------|--------|-----|
| `compliance_warning_threshold_days` | `7` | ⚠️ **Creado pero NO usado** | Valores hardcodeados en el código |
| `compliance_critical_threshold_days` | `14` | ⚠️ **Creado pero NO usado** | Valores hardcodeados en el código |
| `compliance_emergency_threshold_days` | `30` | ⚠️ **Creado pero NO usado** | Valores hardcodeados en el código |

---

## 🔍 Análisis Detallado

### ✅ **Configuraciones Activas y Funcionales**

#### 1. `enforce_asset_blocking`
- **Ubicación en código:** `archive/legacy-db-migrations/sql/20251220_compliance_functions.sql`
- **Función:** `can_asset_operate()` y `enforce_checklist_before_operation()`
- **Uso:** Controla si se bloquea hard (true) o solo se advierte (false) cuando un activo opera sin checklist
- **Estado:** ✅ **FUNCIONAL**

#### 2. `asset_grace_period_days`
- **Ubicación en código:** `archive/legacy-db-migrations/sql/20251220_compliance_functions.sql`
- **Función:** `refresh_asset_accountability()`
- **Uso:** Días que un activo nuevo está excluido de las verificaciones de cumplimiento
- **Estado:** ✅ **FUNCIONAL**

#### 3. `enable_onboarding_tour`
- **Ubicación en código:** `components/onboarding/ProductTour.tsx`
- **Uso:** Controla si el tour interactivo se inicia automáticamente
- **Estado:** ✅ **FUNCIONAL** (recién implementado)

#### 4. `enable_policy_acknowledgment`
- **Ubicación en código:** `components/onboarding/onboarding-provider.tsx`
- **Uso:** Controla si el modal de aceptación de políticas aparece
- **Estado:** ✅ **FUNCIONAL** (recién implementado)

---

### ⚠️ **Configuraciones Creadas pero NO Usadas**

#### 1. `compliance_warning_threshold_days`
- **Valor en DB:** `7`
- **Valor hardcodeado en código:** `7` (línea 116 de `refresh_asset_accountability()`)
- **Problema:** El código usa valores hardcodeados en lugar de leer de `system_settings`
- **Impacto:** Cambiar este valor en la UI no tiene efecto

#### 2. `compliance_critical_threshold_days`
- **Valor en DB:** `14`
- **Valor hardcodeado en código:** `14` (línea 114 de `refresh_asset_accountability()`)
- **Problema:** El código usa valores hardcodeados en lugar de leer de `system_settings`
- **Impacto:** Cambiar este valor en la UI no tiene efecto

#### 3. `compliance_emergency_threshold_days`
- **Valor en DB:** `30`
- **Valor hardcodeado en código:** `30` (línea 112 de `refresh_asset_accountability()`)
- **Problema:** El código usa valores hardcodeados en lugar de leer de `system_settings`
- **Impacto:** Cambiar este valor en la UI no tiene efecto

---

## 🔧 Código Actual (Hardcoded)

```sql
-- En refresh_asset_accountability() - líneas 112-116
IF v_days_without_checklist >= 30 THEN
  v_alert_level := 'emergency';
ELSIF v_days_without_checklist >= 14 THEN
  v_alert_level := 'critical';
ELSIF v_days_without_checklist >= 7 OR (v_pending_count > 0 AND v_oldest_pending_date < CURRENT_DATE) THEN
  v_alert_level := 'warning';
```

**Debería ser:**
```sql
-- Leer thresholds desde system_settings
SELECT (value::text)::integer INTO v_emergency_threshold FROM system_settings WHERE key = 'compliance_emergency_threshold_days';
SELECT (value::text)::integer INTO v_critical_threshold FROM system_settings WHERE key = 'compliance_critical_threshold_days';
SELECT (value::text)::integer INTO v_warning_threshold FROM system_settings WHERE key = 'compliance_warning_threshold_days';

-- Usar los valores leídos
IF v_days_without_checklist >= COALESCE(v_emergency_threshold, 30) THEN
  v_alert_level := 'emergency';
ELSIF v_days_without_checklist >= COALESCE(v_critical_threshold, 14) THEN
  v_alert_level := 'critical';
ELSIF v_days_without_checklist >= COALESCE(v_warning_threshold, 7) OR ...
```

---

## 📋 Resumen

### ✅ **Configuraciones Funcionales (5)**
1. `enforce_asset_blocking` - ✅ Usado
2. `asset_grace_period_days` - ✅ Usado
3. `enable_onboarding_tour` - ✅ Usado (nuevo)
4. `enable_policy_acknowledgment` - ✅ Usado (nuevo)

### ⚠️ **Configuraciones NO Funcionales (3)**
1. `compliance_warning_threshold_days` - ⚠️ Creado pero valores hardcodeados
2. `compliance_critical_threshold_days` - ⚠️ Creado pero valores hardcodeados
3. `compliance_emergency_threshold_days` - ⚠️ Creado pero valores hardcodeados

---

## 🎯 Recomendación

### Opción 1: Arreglar los Thresholds (Recomendado)
- Modificar `refresh_asset_accountability()` para leer los valores de `system_settings`
- Hacer que los thresholds sean configurables desde la UI
- Tiempo estimado: 15-20 minutos

### Opción 2: Dejar como está
- Los valores hardcodeados funcionan correctamente
- Los settings en la UI son "placeholders" pero no tienen efecto
- Si necesitas cambiar thresholds, hay que modificar el código SQL

---

## ✅ Conclusión

**Las configuraciones SÍ son reales** y están en la base de datos, pero:
- **5 de 7** están siendo usadas correctamente
- **3 de 7** (los thresholds) están creados pero no se usan porque el código tiene valores hardcodeados

¿Quieres que arregle los thresholds para que sean configurables desde la UI?
