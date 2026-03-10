"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Eye, History, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { TemplateEditor } from "@/components/checklists/template-editor"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { BreadcrumbSetter } from "@/components/navigation/breadcrumb-setter"

export default function EditChecklistTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const templateId = resolvedParams.id
  const router = useRouter()
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const detailUrl = `/checklists/plantillas/${templateId}`
  const versionsUrl = `${detailUrl}?tab=versions`
  const backUrl = detailUrl

  const handleSave = () => {
    setHasUnsavedChanges(false)
    toast.success("Plantilla guardada exitosamente")
    setTimeout(() => {
      router.push(versionsUrl)
    }, 1000)
  }

  return (
    <>
      <BreadcrumbSetter
        items={[
          { label: "Operaciones", href: "#" },
          { label: "Checklists", href: "/checklists" },
          { label: "Plantillas", href: "/checklists/plantillas" },
          { label: "Plantilla", href: detailUrl },
          { label: "Editar" },
        ]}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Editando plantilla</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Realiza cambios a la plantilla. Los cambios se guardarán como una nueva versión.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" asChild>
                <Link href={backUrl}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={detailUrl}>
                  <Eye className="mr-2 h-4 w-4" />
                  Vista Previa
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={versionsUrl}>
                  <History className="mr-2 h-4 w-4" />
                  Versiones
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {hasUnsavedChanges && (
            <Alert className="border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/20">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                Tienes cambios sin guardar. Asegúrate de guardar tu trabajo antes de salir.
              </AlertDescription>
            </Alert>
          )}

          <TemplateEditor
            templateId={templateId}
            onSave={handleSave}
            onCancel={() => router.push(backUrl)}
            onDirtyChange={setHasUnsavedChanges}
          />
        </CardContent>
      </Card>
    </>
  )
}
