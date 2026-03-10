"use client"

import { Suspense, use, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

function EditRedirectContent({ templateId }: { templateId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const model = searchParams?.get("model")
    const target = model
      ? `/checklists/plantillas/${templateId}/editar?model=${model}`
      : `/checklists/plantillas/${templateId}/editar`
    router.replace(target)
  }, [templateId, router, searchParams])

  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
      <span>Redirigiendo...</span>
    </div>
  )
}

export default function EditChecklistTemplateRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const templateId = resolvedParams.id

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span>Cargando...</span>
      </div>
    }>
      <EditRedirectContent templateId={templateId} />
    </Suspense>
  )
}
