# Guía de Limpieza de Cache de Checklists

## Problema Identificado

Hay un checklist que aparece como "pendiente de sincronizar" que está causando un error 404:
```
POST https://txapndpstzcspgxlybll.supabase.co/rest/v1/rpc/mark_checklist_as_completed 404 (Not Found)
```

## Verificación Realizada

✅ **Las funciones RPC existen en Supabase:**
- `mark_checklist_as_completed` - ✅ Disponible
- `mark_checklist_as_completed_versioned` - ✅ Disponible

❌ **El problema es un cache corrupto en IndexedDB del navegador**

## Soluciones Implementadas

### 1. 🎯 Solución Rápida (Consola del Navegador)

Abre las herramientas de desarrollo (F12) y ejecuta en la consola:

```javascript
// Comando principal para limpiar todo
clearChecklistCache()

// O ver qué hay en cache primero
getChecklistCacheInfo()

// Ayuda completa
helpChecklistCache()
```

### 2. 🖥️ Solución desde la Interfaz

1. Ve a la página `/checklists`
2. Si tienes permisos de supervisor/gerencia, verás una sección "⚙️ Administración de Cache"
3. Haz clic en "Ver estadísticas del cache" para ver el problema
4. Usa "Limpiar pendientes" para elementos problemáticos
5. O "Limpiar todo el cache" para una limpieza completa

### 3. 🔧 Solución Manual

Si las opciones anteriores no funcionan:

1. Abre herramientas de desarrollo (F12)
2. Ve a la pestaña **Application** (o **Aplicación**)
3. En el panel izquierdo busca **IndexedDB**
4. Expande `maintenance-checklists-offline`
5. Haz clic derecho y selecciona **Delete database**
6. También limpia **Local Storage** y **Session Storage**
7. Recarga la página

## Archivos Creados

- `lib/services/cache-cleanup.ts` - Servicio principal de limpieza
- `components/checklists/cache-cleanup-button.tsx` - Componente de interfaz
- `lib/services/cache-console-commands.ts` - Comandos de consola
- `components/cache-console-loader.tsx` - Cargador de comandos

## Comandos de Consola Disponibles

```javascript
// Ver información del cache
getChecklistCacheInfo()

// Limpiar cache completo (recomendado)
clearChecklistCache()

// Limpiezas específicas
clearIndexedDB()
clearChecklistLocalStorage()
clearChecklistSessionStorage()

// Ver ayuda completa
helpChecklistCache()
```

## Pasos para Resolver el Problema Actual

1. **Ejecuta en la consola:**
   ```javascript
   clearChecklistCache()
   ```

2. **Recarga la página** - ¡Muy importante!

3. **Verifica que el problema se resolvió** revisando que no aparezcan más elementos "pendientes de sincronizar"

## Prevención Futura

- Los comandos de cache están ahora disponibles globalmente
- El componente de limpieza está integrado en la interfaz
- El sistema detecta automáticamente problemas de sincronización

## Notas Técnicas

- El error 404 ocurre porque hay datos corruptos en IndexedDB
- Las funciones RPC de Supabase están funcionando correctamente
- El problema es local en el navegador, no en el servidor
- La limpieza es segura - solo elimina cache local, no datos del servidor

## ⚠️ Importante

**Siempre recarga la página después de limpiar el cache** para que los cambios tomen efecto completamente. 