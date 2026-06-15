'use client'

import { useEffect } from 'react'

export function CacheConsoleLoader() {
  useEffect(() => {
    // Solo en el navegador y en desarrollo/debugging
    if (typeof window !== 'undefined') {
      // Importar dinámicamente los comandos de cache
      import('@/lib/services/cache-console-commands').then(() => {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔧 Comandos de cache de checklists cargados')
          console.log('💡 Escribe helpChecklistCache() para ver los comandos disponibles')
        }
      }).catch(error => {
        console.warn('⚠️ Error cargando comandos de cache:', error)
      })
    }
  }, [])

  // Este componente no renderiza nada
  return null
} 