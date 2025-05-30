'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Save, Eye, History, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TemplateEditor } from '@/components/checklists/template-editor'
import { toast } from 'sonner'

interface ChecklistItem {
  id?: string
  description: string
  required: boolean
  order_index: number
  item_type: 'check' | 'measure' | 'text'
  expected_value?: string
  tolerance?: string
}

interface ChecklistSection {
  id?: string
  title: string
  order_index: number
  items: ChecklistItem[]
}

interface ChecklistTemplate {
  id?: string
  name: string
  description: string
  model_id: string
  frequency: string
  hours_interval?: number
  sections: ChecklistSection[]
}

// Database template interface for loading
interface DatabaseTemplate {
  id: string
  name: string
  description: string | null
  frequency: string | null
  hours_interval: number | null
  model_id: string | null
  created_at: string
  updated_at: string | null
  checklist_sections: Array<{
    id: string
    title: string
    order_index: number
    checklist_items: Array<{
      id: string
      description: string
      required: boolean
      order_index: number
      item_type: string
      expected_value: string | null
      tolerance: string | null
    }>
  }>
}

export default function EditChecklistTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const templateId = resolvedParams.id
  const router = useRouter()
  const [template, setTemplate] = useState<DatabaseTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        
        const { data, error } = await supabase
          .from('checklists')
          .select(`
            *,
            checklist_sections (
              id,
              title,
              order_index,
              checklist_items (
                id,
                description,
                required,
                order_index,
                item_type,
                expected_value,
                tolerance
              )
            )
          `)
          .eq('id', templateId)
          .single()

        if (error) throw error
        setTemplate(data as unknown as DatabaseTemplate)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (templateId) {
      fetchTemplate()
    }
  }, [templateId])

  const handleSaveTemplate = (updatedTemplate: ChecklistTemplate) => {
    // The TemplateEditor handles the saving internally
    // We just need to handle the success case
    setHasUnsavedChanges(false)
    toast.success('✅ Plantilla guardada exitosamente')
    
    // Redirect to template details after a short delay
    setTimeout(() => {
      router.push(`/checklists/${templateId}?tab=versions`)
    }, 1000)
  }

  const handlePreviewTemplate = () => {
    router.push(`/checklists/${templateId}`)
  }

  const handleTemplateChange = () => {
    setHasUnsavedChanges(true)
  }

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Cargando editor..."
          text="Preparando el editor de plantillas"
        >
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </DashboardHeader>
        <div className="flex justify-center items-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Cargando plantilla...</p>
          </div>
        </div>
      </DashboardShell>
    )
  }

  if (error || !template) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Error"
          text="No se pudo cargar la plantilla para editar"
        >
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </DashboardHeader>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || "Plantilla no encontrada"}</AlertDescription>
        </Alert>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Editando: ${template.name}`}
        text="Realiza cambios a la plantilla. Los cambios se guardarán como una nueva versión."
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <Button variant="outline" onClick={handlePreviewTemplate}>
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
          onSave={handleSaveTemplate}
          onCancel={() => router.back()}
        />
      </div>
    </DashboardShell>
  )
} 