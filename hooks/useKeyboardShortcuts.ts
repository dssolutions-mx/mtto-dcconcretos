'use client'

import { useEffect } from 'react'

export function useKeyboardShortcuts(handlers: {
  onToggleExpandAll?: () => void
  onFocusFilter?: () => void
  onFocusMode?: () => void
  onCommandPalette?: () => void
  onHelp?: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'k') {
        e.preventDefault()
        handlers.onCommandPalette?.()
      }
      if (e.key === '?' && !mod) {
        e.preventDefault()
        handlers.onHelp?.()
      }
      if (e.key === '/' && !mod && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        handlers.onFocusFilter?.()
      }
      if (e.key === 'f' && !mod && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        handlers.onFocusMode?.()
      }
      if (mod && (e.key === '[' || e.key === ']')) {
        e.preventDefault()
        handlers.onToggleExpandAll?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers])
}
