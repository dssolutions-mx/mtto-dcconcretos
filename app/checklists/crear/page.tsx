"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

function CreateRedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const model = searchParams?.get("model")
    const target = model
      ? `/checklists/plantillas/crear?model=${model}`
      : `/checklists/plantillas/crear`
    router.replace(target)
  }, [router, searchParams])

  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
      <span>Redirigiendo...</span>
    </div>
  )
}

export default function CreateChecklistTemplateRedirect() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span>Cargando...</span>
      </div>
    }>
      <CreateRedirectContent />
    </Suspense>
  )
}
