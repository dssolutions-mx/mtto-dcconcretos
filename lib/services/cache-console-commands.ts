/**
 * Comandos de consola para limpieza rápida de cache
 * Estos comandos estarán disponibles globalmente en la ventana del navegador
 * para facilitar la limpieza de cache durante desarrollo y debugging
 */

// Función para limpiar IndexedDB
async function clearIndexedDB() {
  try {
    // Borrar toda la base de datos
    const dbName = 'maintenance-checklists-offline'
    
    if ('indexedDB' in window) {
      await new Promise((resolve, reject) => {
        const deleteReq = indexedDB.deleteDatabase(dbName)
        deleteReq.onsuccess = () => {
          console.log('✅ IndexedDB eliminada exitosamente')
          resolve(true)
        }
        deleteReq.onerror = () => {
          console.error('❌ Error eliminando IndexedDB:', deleteReq.error)
          reject(deleteReq.error)
        }
        deleteReq.onblocked = () => {
          console.warn('⚠️ Eliminación de IndexedDB bloqueada. Cierra otras pestañas de la aplicación.')
          reject(new Error('Database deletion blocked'))
        }
      })
    }
  } catch (error) {
    console.error('❌ Error limpiando IndexedDB:', error)
    throw error
  }
}

// Función para limpiar localStorage relacionado con checklists
function clearChecklistLocalStorage() {
  try {
    const keys = Object.keys(localStorage)
    const checklistKeys = keys.filter(key => 
      key.includes('checklist') || 
      key.includes('offline') || 
      key.includes('maintenance') ||
      key.includes('sync') ||
      key.includes('unresolved-issues')
    )
    
    console.log(`🧹 Limpiando ${checklistKeys.length} elementos del localStorage:`)
    checklistKeys.forEach(key => {
      console.log(`  - ${key}`)
      localStorage.removeItem(key)
    })
    
    console.log('✅ localStorage de checklists limpiado')
  } catch (error) {
    console.error('❌ Error limpiando localStorage:', error)
    throw error
  }
}

// Función para limpiar sessionStorage
function clearChecklistSessionStorage() {
  try {
    const keys = Object.keys(sessionStorage)
    const checklistKeys = keys.filter(key => 
      key.includes('checklist') || 
      key.includes('offline') || 
      key.includes('maintenance') ||
      key.includes('sync')
    )
    
    console.log(`🧹 Limpiando ${checklistKeys.length} elementos del sessionStorage:`)
    checklistKeys.forEach(key => {
      console.log(`  - ${key}`)
      sessionStorage.removeItem(key)
    })
    
    console.log('✅ sessionStorage de checklists limpiado')
  } catch (error) {
    console.error('❌ Error limpiando sessionStorage:', error)
    throw error
  }
}

// Función principal de limpieza completa
async function fullChecklistCacheCleanup() {
  console.log('🚨 Iniciando limpieza completa del cache de checklists...')
  
  try {
    // 1. Limpiar IndexedDB
    await clearIndexedDB()
    
    // 2. Limpiar localStorage
    clearChecklistLocalStorage()
    
    // 3. Limpiar sessionStorage
    clearChecklistSessionStorage()
    
    // 4. Limpiar cache del service worker si existe
    if ('serviceWorker' in navigator && 'caches' in window) {
      const cacheNames = await caches.keys()
      const checklistCaches = cacheNames.filter(name => 
        name.includes('checklist') || 
        name.includes('offline') || 
        name.includes('maintenance')
      )
      
      for (const cacheName of checklistCaches) {
        await caches.delete(cacheName)
        console.log(`🗑️ Cache eliminado: ${cacheName}`)
      }
    }
    
    console.log('✅ Limpieza completa terminada exitosamente')
    console.log('💡 Recomendación: Recarga la página para aplicar los cambios')
    
    return {
      success: true,
      message: 'Cache limpiado exitosamente. Recarga la página.'
    }
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// Función para obtener estadísticas del cache
async function getChecklistCacheInfo() {
  console.log('📊 Obteniendo información del cache...')
  
  try {
    const info: any = {
      localStorage: {},
      sessionStorage: {},
      indexedDB: null,
      caches: []
    }
    
    // Analizar localStorage
    const localKeys = Object.keys(localStorage)
    const checklistLocalKeys = localKeys.filter(key => 
      key.includes('checklist') || 
      key.includes('offline') || 
      key.includes('maintenance') ||
      key.includes('sync') ||
      key.includes('unresolved-issues')
    )
    
    info.localStorage = {
      total: localKeys.length,
      checklistRelated: checklistLocalKeys.length,
      keys: checklistLocalKeys
    }
    
    // Analizar sessionStorage
    const sessionKeys = Object.keys(sessionStorage)
    const checklistSessionKeys = sessionKeys.filter(key => 
      key.includes('checklist') || 
      key.includes('offline') || 
      key.includes('maintenance') ||
      key.includes('sync')
    )
    
    info.sessionStorage = {
      total: sessionKeys.length,
      checklistRelated: checklistSessionKeys.length,
      keys: checklistSessionKeys
    }
    
    // Verificar IndexedDB
    const dbName = 'maintenance-checklists-offline'
    try {
      const dbExists = await new Promise((resolve) => {
        const openReq = indexedDB.open(dbName)
        openReq.onsuccess = () => {
          const db = openReq.result
          const storeNames = Array.from(db.objectStoreNames)
          db.close()
          resolve({ exists: true, stores: storeNames })
        }
        openReq.onerror = () => resolve({ exists: false })
        openReq.onupgradeneeded = () => {
          openReq.result.close()
          resolve({ exists: false })
        }
      })
      info.indexedDB = dbExists
    } catch (error) {
      info.indexedDB = { exists: false, error: error instanceof Error ? error.message : 'Error' }
    }
    
    // Verificar caches del service worker
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      info.caches = cacheNames.filter(name => 
        name.includes('checklist') || 
        name.includes('offline') || 
        name.includes('maintenance')
      )
    }
    
    console.log('📊 Información del cache:', info)
    return info
    
  } catch (error) {
    console.error('❌ Error obteniendo información del cache:', error)
    return { error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// Exportar funciones para uso global
export {
  clearIndexedDB,
  clearChecklistLocalStorage,
  clearChecklistSessionStorage,
  fullChecklistCacheCleanup,
  getChecklistCacheInfo
}

// Hacer funciones disponibles globalmente en el navegador
if (typeof window !== 'undefined') {
  (window as any).clearChecklistCache = fullChecklistCacheCleanup;
  (window as any).getChecklistCacheInfo = getChecklistCacheInfo;
  (window as any).clearIndexedDB = clearIndexedDB;
  (window as any).clearChecklistLocalStorage = clearChecklistLocalStorage;
  (window as any).clearChecklistSessionStorage = clearChecklistSessionStorage;
  
  // Agregar comandos de ayuda
  (window as any).helpChecklistCache = () => {
    console.log(`
🔧 COMANDOS DE CACHE DISPONIBLES:

📊 Información:
  • getChecklistCacheInfo() - Ver estadísticas del cache

🧹 Limpieza:
  • clearChecklistCache() - Limpieza completa (recomendado)
  • clearIndexedDB() - Solo limpiar IndexedDB
  • clearChecklistLocalStorage() - Solo limpiar localStorage
  • clearChecklistSessionStorage() - Solo limpiar sessionStorage

💡 Uso típico:
  1. getChecklistCacheInfo() - para ver qué hay en cache
  2. clearChecklistCache() - para limpiar todo
  3. Recargar la página

⚠️ IMPORTANTE: Recarga la página después de limpiar el cache
    `)
  }
  
  console.log(`
🔧 Cache de checklists - Comandos disponibles:
  • helpChecklistCache() - Ver ayuda completa
  • clearChecklistCache() - Limpiar cache (recomendado para problemas)
  • getChecklistCacheInfo() - Ver estadísticas
`)
} 