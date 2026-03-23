# 🧪 OPERATOR SIDEBAR TEST GUIDE

## 📋 **OBJETIVO DEL TEST**

Verificar que la simplificación del sidebar para operadores funciona correctamente en ambos estados (colapsado y expandido) sin afectar la funcionalidad general del sistema.

## 🎯 **CASOS DE PRUEBA**

### **1. TEST DE SIDEBAR EXPANDIDO PARA OPERADORES**

#### **1.1 Verificación de Navegación Simplificada**
- [ ] **Acceso**: Login como operador (`OPERADOR` o `DOSIFICADOR`)
- [ ] **Dashboard**: Redirige a `/dashboard/operator` automáticamente
- [ ] **Sidebar Expandido**: Solo muestra sección "Mis Checklists"
- [ ] **Sin Otras Secciones**: No aparecen equipos, compras, organización, etc.

#### **1.2 Verificación de Enlaces**
- [ ] **Dashboard**: Enlace a `/dashboard/operator`
- [ ] **Todos mis Checklists**: Enlace a `/checklists`
- [ ] **Vista por Activos**: Enlace a `/checklists/assets`
- [ ] **Problemas Pendientes**: Enlace a `/checklists/problemas-pendientes`

#### **1.3 Verificación de Estados Activos**
- [ ] **Dashboard Activo**: Cuando estás en `/dashboard/operator`
- [ ] **Checklists Activo**: Cuando estás en `/checklists`
- [ ] **Vista por Activos Activo**: Cuando estás en `/checklists/assets`
- [ ] **Problemas Pendientes Activo**: Cuando estás en `/checklists/problemas-pendientes`

### **2. TEST DE SIDEBAR COLAPSADO PARA OPERADORES**

#### **2.1 Verificación de Navegación Simplificada**
- [ ] **Acceso**: Login como operador y colapsar sidebar
- [ ] **Solo Checklists**: Solo aparece icono de checklists
- [ ] **Sin Otros Iconos**: No aparecen iconos de equipos, compras, etc.
- [ ] **Tooltip Correcto**: Al hacer hover muestra "Mis Checklists"

#### **2.2 Verificación de Tooltip Expandido**
- [ ] **Click en Icono**: Expande tooltip con opciones
- [ ] **Opciones Mostradas**:
  - [ ] "Todos mis Checklists" → `/checklists`
  - [ ] "Vista por Activos" → `/checklists/assets`
  - [ ] "Problemas Pendientes" → `/checklists/problemas-pendientes`
- [ ] **Navegación Funcional**: Click en opciones navega correctamente
- [ ] **Cierre de Tooltip**: Se cierra al hacer click fuera o ESC

### **3. TEST DE COMPATIBILIDAD CON OTROS ROLES**

#### **3.1 Verificación de Roles No-Operadores**
- [ ] **AREA_ADMINISTRATIVA**: Sidebar completo sin cambios
- [ ] **GERENCIA_GENERAL**: Sidebar completo sin cambios
- [ ] **SUPERVISOR**: Sidebar completo sin cambios
- [ ] **TECNICO**: Sidebar completo sin cambios

#### **3.2 Verificación de Estados Mixtos**
- [ ] **Cambio de Rol**: Cambiar de operador a otro rol
- [ ] **Sidebar Se Actualiza**: Muestra navegación completa
- [ ] **Cambio Inverso**: Cambiar de otro rol a operador
- [ ] **Sidebar Se Simplifica**: Muestra solo checklists

### **4. TEST DE FUNCIONALIDAD GENERAL**

#### **4.1 Verificación de Toggle Sidebar**
- [ ] **Expandir**: Click en logo para expandir sidebar
- [ ] **Colapsar**: Click en logo para colapsar sidebar
- [ ] **Estados Correctos**: Ambos estados funcionan para operadores
- [ ] **Persistencia**: Estado se mantiene al navegar

#### **4.2 Verificación de Responsive**
- [ ] **Mobile**: Sidebar se comporta correctamente en móvil
- [ ] **Tablet**: Sidebar se comporta correctamente en tablet
- [ ] **Desktop**: Sidebar se comporta correctamente en desktop

## 🚀 **INSTRUCCIONES DE EJECUCIÓN**

### **Paso 1: Preparación**
```bash
# Asegurar que el proyecto está corriendo
npm run dev
```

### **Paso 2: Test de Operador**
1. **Login como Operador**:
   - Usuario con rol `OPERADOR` o `DOSIFICADOR`
   - Verificar redirección a `/dashboard/operator`

2. **Test Sidebar Expandido**:
   - Verificar que solo aparece "Mis Checklists"
   - Probar todos los enlaces
   - Verificar estados activos

3. **Test Sidebar Colapsado**:
   - Click en logo para colapsar
   - Verificar que solo aparece icono de checklists
   - Probar tooltip expandido
   - Verificar navegación desde tooltip

### **Paso 3: Test de Compatibilidad**
1. **Login como Otro Rol**:
   - Usuario con rol `AREA_ADMINISTRATIVA`
   - Verificar sidebar completo
   - Probar toggle expandir/colapsar

2. **Cambio de Rol**:
   - Cambiar de operador a otro rol
   - Verificar actualización de sidebar
   - Cambiar de otro rol a operador
   - Verificar simplificación de sidebar

## ✅ **CRITERIOS DE ÉXITO**

### **Para Operadores:**
- [ ] Solo ven sección de checklists en sidebar
- [ ] Dashboard redirige a `/dashboard/operator`
- [ ] Todos los enlaces funcionan correctamente
- [ ] Estados activos se muestran correctamente
- [ ] Tooltips funcionan en modo colapsado

### **Para Otros Roles:**
- [ ] Sidebar completo sin cambios
- [ ] Todas las secciones disponibles
- [ ] Funcionalidad original intacta

### **General:**
- [ ] No errores en consola
- [ ] No errores de build
- [ ] Navegación fluida
- [ ] Estados persistentes
- [ ] Responsive design funciona

## 🐛 **PROBLEMAS CONOCIDOS Y SOLUCIONES**

### **Problema 1: Sidebar no se actualiza al cambiar rol**
**Solución**: Verificar que `useAuthZustand` está actualizando el estado correctamente

### **Problema 2: Tooltip no se cierra**
**Solución**: Verificar que `onPointerDownOutside` y `onEscapeKeyDown` están configurados

### **Problema 3: Estados activos incorrectos**
**Solución**: Verificar que `isPathActive` está funcionando correctamente

## 📊 **MÉTRICAS DE ÉXITO**

- [ ] **100% de casos de prueba pasan**
- [ ] **0 errores en consola**
- [ ] **Tiempo de carga < 2 segundos**
- [ ] **Navegación fluida sin lag**
- [ ] **Estados persistentes correctos**

## 🔄 **PROCESO DE VERIFICACIÓN CONTINUA**

1. **Después de cada cambio**: Ejecutar tests básicos
2. **Antes de deploy**: Ejecutar tests completos
3. **Monitoreo**: Verificar logs de errores
4. **Feedback**: Recopilar feedback de usuarios operadores

---

**Nota**: Este test debe ejecutarse cada vez que se modifique la lógica del sidebar para asegurar que la funcionalidad de operadores no se vea afectada. 