# 📱 Guía de Funcionalidad Offline para Checklists

## 🎯 Respuesta al Escenario del Usuario

**Escenario:** Tienes internet → accedes a página de checklist → pierdes internet → ¿puedes abrir checklist pendiente?

**Respuesta:** ¡SÍ! Con la implementación actual funciona perfectamente. Aquí está el flujo completo:

## 🔄 Flujo de Funcionamiento Offline

### 1. **Con Internet (Preparación)**
```
Usuario accede a /checklists
     ↓
Se cargan schedules y templates desde Supabase
     ↓
AUTO-CACHE: Datos se guardan automáticamente en IndexedDB
     ↓
Usuario ve lista completa + botón "Preparar Offline"
```

### 2. **Sin Internet (Ejecución)**
```
Usuario pierde conexión
     ↓
Página detecta modo offline automáticamente
     ↓
Tab "General" cambia a "Offline"
     ↓
Se muestran SOLO checklists disponibles offline
     ↓
Usuario puede ejecutar checklists cacheados
     ↓
Datos se guardan localmente
```

### 3. **Reconexión (Sincronización)**
```
Usuario recupera conexión
     ↓
Auto-sync cada 2 minutos
     ↓
Notificación de sincronización exitosa
     ↓
Datos locales se envían a servidor
```

## 🚀 Funcionalidades Implementadas

### ✅ **Cache Automático**
- **Lista de Schedules**: Se cachea automáticamente al cargar `/checklists`
- **Templates**: Se guardan automáticamente para referencia
- **Checklists Individuales**: Se cachean al acceder por primera vez
- **Cache Proactivo**: Botón para descargar todos los checklists pendientes

### ✅ **Detección Inteligente**
- **Estado de Conexión**: Detecta online/offline en tiempo real
- **Auto-sync**: Sincronización automática cada 2 minutos cuando hay conexión
- **Sync en Foco**: Se sincroniza cuando la página regana el foco
- **Throttling**: Evita spam de sincronización (mínimo 30s entre intentos)

### ✅ **Interfaz Adaptiva**
- **Tabs Dinámicos**: Tab "General" se convierte en "Offline" sin conexión
- **Componente Offline**: Lista específica de checklists disponibles offline
- **Estados Visuales**: Indicadores claros de conexión y sync
- **Notificaciones**: Toast messages informativos

### ✅ **Persistencia Robusta**
- **IndexedDB**: Almacenamiento persistente en el navegador
- **Auto-save**: Guardado automático cada 30 segundos
- **Recovery**: Recuperación de drafts al reabrir
- **Versioning**: Control de versiones de cache (máx 2-4 horas)

## 🛠️ Componentes Clave

### 1. **OfflineChecklistService** (`lib/services/offline-checklist-service.ts`)
```typescript
// Funciones principales
- cacheChecklistSchedules(schedules, filters)
- getCachedChecklistSchedules(filters)  
- proactivelyCacheChecklist(scheduleId)
- massiveCachePreparation()
- getAvailableOfflineChecklists()
- isChecklistAvailableOffline(scheduleId)
```

### 2. **OfflineStatus Component** (`components/checklists/offline-status.tsx`)
```typescript
// Modos de visualización
- Compacto: Para header móvil
- Detallado: Para desktop
- Responsive: Se adapta automáticamente
```

### 3. **OfflineChecklistList** (`components/checklists/offline-checklist-list.tsx`)
```typescript
// Características
- Lista filtrada de checklists offline
- Indicadores de frescura de datos
- Enlaces directos a ejecución
- Consejos de uso
```

### 4. **ChecklistExecution** (Mejorado)
```typescript
// Nuevas capacidades
- Cache proactivo al cargar
- Fallback a cache en errores
- Auto-save con indicador visual
- Recovery de drafts mejorado
```

## 📝 Procedimiento Paso a Paso

### **Escenario A: Preparación Normal**
1. Usuario accede a `/checklists` con internet
2. Sistema carga y cachea automáticamente los schedules
3. Usuario hace clic en "Preparar Offline" (opcional)
4. Sistema descarga detalles de hasta 20 checklists pendientes
5. ✅ **Listo para usar offline**

### **Escenario B: Uso Offline Inmediato**
1. Usuario accede a `/checklists` con internet
2. Usuario hace clic en un checklist específico
3. Sistema cachea ese checklist automáticamente
4. Usuario pierde conexión
5. Usuario regresa a `/checklists` → ve tab "Offline"
6. ✅ **Ese checklist específico estará disponible**

### **Escenario C: Sin Preparación Previa**
1. Usuario pierde conexión sin haber accedido antes
2. Sistema muestra mensaje educativo
3. Lista vacía con instrucciones claras
4. ✅ **Usuario sabe qué hacer para la próxima vez**

## 🎯 Casos de Uso Cubiertos

| Situación | Resultado | Acción del Usuario |
|-----------|-----------|-------------------|
| **Internet + Primera visita** | ✅ Cache automático | Navegar normalmente |
| **Internet + Click en checklist** | ✅ Cache individual | Usar checklist normalmente |
| **Internet + "Preparar Offline"** | ✅ Cache masivo | Trabajar offline después |
| **Sin internet + Cache previo** | ✅ Lista offline | Seleccionar de lista offline |
| **Sin internet + Sin cache** | ⚠️ Lista vacía | Instrucciones claras |
| **Reconexión automática** | ✅ Auto-sync | Sin acción requerida |

## 🔧 Configuraciones Técnicas

### **Tiempos de Cache**
- **Schedules**: 2 horas máximo
- **Templates**: 4 horas máximo  
- **Checklists individuales**: 24 horas máximo
- **Auto-cleanup**: 30 días

### **Sync Automático**
- **Intervalo**: Cada 2 minutos
- **Throttling**: Mínimo 30 segundos entre intentos
- **Reintentos**: Máximo 5 por checklist
- **Backoff**: Espera 10 segundos entre reintentos

### **Almacenamiento**
- **Motor**: IndexedDB
- **Stores**: 4 tablas especializadas
- **Versionado**: Automático con migración
- **Límites**: Sin límite definido (depende del navegador)

## 🚨 Limitaciones y Consideraciones

### **Limitaciones Actuales**
- Solo funciona en navegadores con IndexedDB
- Dependiente de storage local del navegador
- Cache puede perderse si usuario limpia datos del navegador
- Fotos no se cachean (solo URLs)

### **Recomendaciones de Uso**
1. **Preparación**: Usar "Preparar Offline" antes de ir a campo
2. **Visitas**: Abrir checklists importantes mientras hay internet
3. **Frecuencia**: Sincronizar regularmente para mantener datos frescos
4. **Storage**: No limpiar datos del navegador en dispositivos de campo

## 🎉 Resultado Final

**Para tu escenario específico:**
- ✅ Accedes a `/checklists` con internet
- ✅ Schedules se cachean automáticamente  
- ✅ Pierdes internet
- ✅ Tab cambia a "Offline"
- ✅ Ves lista de checklists disponibles offline
- ✅ Puedes ejecutar cualquier checklist que hayas visitado antes
- ✅ Al reconectarte, todo se sincroniza automáticamente

**¡El sistema está completamente funcional para trabajo offline!** 🎯 