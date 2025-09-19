"use client"

import { useEffect } from "react"

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Ocurrió un error cargando Inventario Diesel</h2>
      <button className="px-4 py-2 rounded bg-primary text-primary-foreground" onClick={() => reset()}>
        Reintentar
      </button>
    </div>
  )
}


