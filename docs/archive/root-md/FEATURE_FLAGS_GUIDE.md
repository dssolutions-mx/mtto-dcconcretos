# 🚩 Feature Flags Guide - Onboarding & Policies

## 📋 Resumen

Este documento explica cómo usar los feature flags para controlar las nuevas funcionalidades de onboarding y políticas sin necesidad de hacer deploy cuando quieras activarlas o desactivarlas.

---

## ✅ Implementación Completada

### 1. **Migración SQL Creada**
- Archivo: `archive/legacy-db-migrations/sql/20251220_add_onboarding_feature_flags.sql`
- Agrega dos feature flags a la tabla `system_settings`:
  - `enable_onboarding_tour` (default: `false` = deshabilitado)
  - `enable_policy_acknowledgment` (default: `false` = deshabilitado)

### 2. **Hook Creado**
- Archivo: `hooks/use-system-settings.ts`
- Hook React que lee los feature flags desde la base de datos
- Cache de 1 minuto para evitar queries repetidas
- Valores por defecto seguros (todos `false` si hay error)

### 3. **Componentes Actualizados**
- `components/onboarding/onboarding-provider.tsx` - Verifica `enable_policy_acknowledgment`
- `components/onboarding/ProductTour.tsx` - Verifica `enable_onboarding_tour`

---

## 🔧 Cómo Aplicar la Migración

### Opción 1: Usando Supabase MCP (Recomendado)

```bash
# Validar la migración primero
# Luego aplicar usando Supabase MCP
```

### Opción 2: Manualmente en Supabase Dashboard

1. Ve a tu proyecto en Supabase Dashboard
2. Abre el SQL Editor
3. Copia y pega el contenido de `archive/legacy-db-migrations/sql/20251220_add_onboarding_feature_flags.sql`
4. Ejecuta la migración

---

## 📝 Estado Actual (Después del Commit)

### ✅ **Puedes Hacer Commit Ahora**

**Estado de los Feature Flags:**
- `enable_onboarding_tour`: **`false`** (deshabilitado)
- `enable_policy_acknowledgment`: **`false`** (deshabilitado)

**Resultado:**
- ✅ El código está en el repositorio
- ✅ Las funcionalidades NO se activarán automáticamente
- ✅ Los usuarios NO verán el tour ni el modal de políticas
- ✅ Puedes hacer deploy sin preocupaciones

---

## 🚀 Cómo Activar las Funcionalidades (Cuando Estés Listo)

### Paso 1: Aplicar la Migración SQL

Si aún no has aplicado la migración, hazlo primero usando Supabase MCP o manualmente.

### Paso 2: Activar los Feature Flags

1. **Inicia sesión como administrador** (GERENCIA_GENERAL o AREA_ADMINISTRATIVA)

2. **Ve a Configuración del Sistema:**
   - Navega a `/compliance/configuracion`
   - O usa el menú lateral → Cumplimiento → Configuración del Sistema

3. **Habilita los Feature Flags:**
   - Busca `enable_onboarding_tour`
   - Cambia el valor de `false` a `true`
   - Guarda con una razón (ej: "Activando tour de onboarding para nuevos usuarios")
   
   - Busca `enable_policy_acknowledgment`
   - Cambia el valor de `false` a `true`
   - Guarda con una razón (ej: "Activando modal de políticas después de firmar")

4. **Verifica:**
   - Los cambios se guardan inmediatamente
   - No necesitas hacer deploy
   - Los usuarios verán las funcionalidades en su próximo login

---

## 🔄 Cómo Desactivar (Si Hay Problemas)

Si necesitas desactivar rápidamente:

1. Ve a `/compliance/configuracion`
2. Cambia los valores de vuelta a `false`
3. Guarda con razón (ej: "Desactivando temporalmente por problemas reportados")

**Resultado inmediato:**
- El tour no aparecerá
- El modal de políticas no aparecerá
- Sin necesidad de deploy

---

## 📊 Feature Flags Disponibles

| Flag | Descripción | Default | Ubicación |
|------|-------------|---------|-----------|
| `enable_onboarding_tour` | Activa el tour interactivo de onboarding | `false` | `/compliance/configuracion` |
| `enable_policy_acknowledgment` | Activa el modal de aceptación de políticas | `false` | `/compliance/configuracion` |
| `enable_compliance_system` | Activa el sistema completo de cumplimiento | `false` | `/compliance/configuracion` |

---

## 🧪 Verificación

### Verificar que los Flags Están Deshabilitados

1. **En la Base de Datos:**
   ```sql
   SELECT key, value FROM system_settings 
   WHERE key IN ('enable_onboarding_tour', 'enable_policy_acknowledgment');
   ```
   
   Deberías ver:
   ```
   enable_onboarding_tour        | "false"
   enable_policy_acknowledgment  | "false"
   ```

2. **En el Código:**
   - Abre la consola del navegador
   - Busca logs que digan `⏸️ Auto-start: Skipping tour`
   - Deberías ver `isOnboardingTourEnabled: false`

### Verificar que los Flags Están Habilitados

1. **En la Base de Datos:**
   ```sql
   SELECT key, value FROM system_settings 
   WHERE key IN ('enable_onboarding_tour', 'enable_policy_acknowledgment');
   ```
   
   Deberías ver:
   ```
   enable_onboarding_tour        | "true"
   enable_policy_acknowledgment  | "true"
   ```

2. **En el Código:**
   - Abre la consola del navegador
   - Busca logs que digan `🚀 Calling startNextStep`
   - El tour debería iniciarse automáticamente

---

## 📚 Archivos Modificados

### Nuevos Archivos
- ✅ `archive/legacy-db-migrations/sql/20251220_add_onboarding_feature_flags.sql`
- ✅ `hooks/use-system-settings.ts`
- ✅ `FEATURE_FLAGS_GUIDE.md` (este archivo)

### Archivos Modificados
- ✅ `components/onboarding/onboarding-provider.tsx`
- ✅ `components/onboarding/ProductTour.tsx`

---

## 🎯 Flujo de Trabajo Recomendado

### 1. **Ahora (Commit Sin Activar)**
```bash
# 1. Aplicar migración SQL (si no está aplicada)
# 2. Verificar que los flags están en false
# 3. Hacer commit y push
git add .
git commit -m "feat: Add feature flags for onboarding and policies (disabled by default)"
git push
```

### 2. **Cuando Estés Listo (Activar Sin Deploy)**
1. Aplicar migración SQL (si no está aplicada)
2. Ir a `/compliance/configuracion`
3. Cambiar flags a `true`
4. Guardar
5. Verificar funcionamiento

### 3. **Si Hay Problemas (Desactivar Rápido)**
1. Ir a `/compliance/configuracion`
2. Cambiar flags a `false`
3. Guardar
4. Problema resuelto sin deploy

---

## ⚠️ Notas Importantes

1. **Valores por Defecto Seguros:**
   - Si hay error al leer los settings, los valores por defecto son `false` (deshabilitado)
   - Esto asegura que las funcionalidades no se activen accidentalmente

2. **Cache:**
   - Los settings se cachean por 1 minuto
   - Si cambias un flag, puede tardar hasta 1 minuto en reflejarse
   - Para cambios inmediatos, refresca la página después de cambiar el flag

3. **Permisos:**
   - Solo administradores pueden cambiar los feature flags
   - Roles permitidos: `GERENCIA_GENERAL`, `AREA_ADMINISTRATIVA`

4. **Auditoría:**
   - Todos los cambios a feature flags se registran en `system_settings_audit_log`
   - Incluye quién hizo el cambio, cuándo y por qué

---

## ✅ Checklist Pre-Deploy

- [ ] Migración SQL aplicada (o lista para aplicar)
- [ ] Feature flags verificados como `false` en la base de datos
- [ ] Código compila sin errores
- [ ] Tests pasan (si aplica)
- [ ] Documentación actualizada

---

## 🎉 Ventajas de Este Enfoque

1. **✅ Commit Seguro:** Puedes hacer commit sin activar funcionalidades
2. **✅ Activación Instantánea:** Activa cuando quieras sin deploy
3. **✅ Rollback Rápido:** Desactiva inmediatamente si hay problemas
4. **✅ Control Granular:** Activa/desactiva cada feature independientemente
5. **✅ Auditoría Completa:** Todos los cambios quedan registrados

---

**Fecha de Implementación:** 20 de Diciembre, 2025

**Estado:** ✅ Listo para Commit y Deploy
