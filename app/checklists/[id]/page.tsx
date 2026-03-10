"use client"

import { Suspense, use, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

function TemplateRedirectContent({
  templateId,
}: {
  templateId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const tab = searchParams?.get("tab")
    const model = searchParams?.get("model")
    const params = new URLSearchParams()
    if (tab) params.set("tab", tab)
    if (model) params.set("model", model)
    const qs = params.toString()
    const target = `/checklists/plantillas/${templateId}${qs ? `?${qs}` : ""}`
    router.replace(target)
  }, [templateId, router, searchParams])

  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
      <span>Redirigiendo...</span>
    </div>
  )
}

export default function ChecklistTemplateRedirect({
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
      <TemplateRedirectContent templateId={templateId} />
    </Suspense>
  )
}
