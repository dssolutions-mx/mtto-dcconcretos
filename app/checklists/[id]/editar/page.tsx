'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Eye, History, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { TemplateEditor } from '@/components/checklists/template-editor'
import { toast } from 'sonner'

export default function EditChecklistTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const templateId = resolvedParams.id
  const router = useRouter()
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Editando plantilla"
        text="Realiza cambios a la plantilla. Los cambios se guardarán como una nueva versión."
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <Button variant="outline" onClick={() => router.push(`/checklists/${templateId}`)}>
            <Eye className="mr-2 h-4 w-4" />
            Vista Previa
          </Button>
          <Button asChild variant="outline">
            <Link href={`/checklists/${templateId}?tab=versions`}>
              <History className="mr-2 h-4 w-4" />
              Versiones
            </Link>
          </Button>
        </div>
      </DashboardHeader>

      {hasUnsavedChanges && (
        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            Tienes cambios sin guardar. Asegúrate de guardar tu trabajo antes de salir.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <TemplateEditor
          templateId={templateId}
          onSave={() => {
            setHasUnsavedChanges(false)
            toast.success('Plantilla guardada exitosamente')
            setTimeout(() => {
              router.push(`/checklists/${templateId}?tab=versions`)
            }, 1000)
          }}
          onCancel={() => router.back()}
          onDirtyChange={setHasUnsavedChanges}
        />
      </div>
    </DashboardShell>
  )
}
