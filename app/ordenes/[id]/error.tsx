"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export default function WorkOrderDetailsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Work order details error:", error)
  }, [error])

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8">
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" aria-hidden />
        <h2 className="text-xl font-semibold">No se pudo cargar la orden de trabajo</h2>
        <p className="text-muted-foreground max-w-md">
          Ocurrió un error al cargar los detalles. Puedes intentar de nuevo o volver al listado.
        </p>
        <div className="flex gap-3">
          <Button onClick={reset} variant="default">
            Intentar de nuevo
          </Button>
          <Button asChild variant="outline">
            <Link href="/ordenes">Volver a órdenes</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
