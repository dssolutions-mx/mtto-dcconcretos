import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useChecklistTemplates } from '@/hooks/useChecklists'

interface ChecklistTemplateListProps {
  modelId?: string
}

export default function ChecklistTemplateList({ modelId }: ChecklistTemplateListProps) {
  const { templates, loading, error, fetchTemplates } = useChecklistTemplates()

  useEffect(() => {
    fetchTemplates(modelId)
  }, [fetchTemplates, modelId])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-4">
        <p className="font-medium">Error al cargar las plantillas</p>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-4 mb-4">
        <p className="font-medium">No hay plantillas de checklist</p>
        <p className="text-sm">
          No se encontraron plantillas de checklist para este modelo.
          <Link href="/checklists/crear" className="text-primary font-medium hover:underline ml-1">
            Crear una plantilla
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => (
        <Card key={template.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <CardDescription className="text-sm mt-1">
                  {template.description || 'Sin descripción'}
                </CardDescription>
              </div>
              <FrequencyBadge frequency={template.frequency} />
            </div>
          </CardHeader>
          <CardContent className="text-sm pb-2">
            <div className="space-y-1">
              <p>
                <span className="font-medium">Modelo:</span>{' '}
                {template.equipment_models?.name || 'No especificado'}
              </p>
              <p>
                <span className="font-medium">Secciones:</span>{' '}
                {template.checklist_sections?.length || 0}
              </p>
              <p>
                <span className="font-medium">Items de verificación:</span>{' '}
                {countItems(template)}
              </p>
            </div>
          </CardContent>
          <CardFooter className="pt-2 flex justify-between">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/checklists/plantillas/${template.id}`}>
                Ver detalles
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/checklists/programar?template=${template.id}`}>
                Programar
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

function FrequencyBadge({ frequency }: { frequency: string }) {
  const colorMap: Record<string, string> = {
    diario: 'bg-blue-100 text-blue-800 border-blue-200',
    semanal: 'bg-green-100 text-green-800 border-green-200',
    mensual: 'bg-purple-100 text-purple-800 border-purple-200',
    trimestral: 'bg-amber-100 text-amber-800 border-amber-200',
    personalizado: 'bg-gray-100 text-gray-800 border-gray-200',
  }

  const color = colorMap[frequency] || colorMap.personalizado
  const label = frequency.charAt(0).toUpperCase() + frequency.slice(1)

  return (
    <Badge className={`ml-2 ${color}`} variant="outline">
      {label}
    </Badge>
  )
}

function countItems(template: any) {
  let count = 0
  if (template.checklist_sections) {
    for (const section of template.checklist_sections) {
      count += section.checklist_items?.length || 0
    }
  }
  return count
} 