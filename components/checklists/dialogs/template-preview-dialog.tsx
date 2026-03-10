"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, AlertTriangle, X, Camera, Sparkles, Shield } from "lucide-react"

interface ChecklistItem {
  description: string
  required: boolean
  item_type?: string
  expected_value?: string
  tolerance?: string
}

interface ChecklistSection {
  title: string
  section_type?: 'checklist' | 'evidence' | 'cleanliness_bonus' | 'security_talk'
  items: ChecklistItem[]
  evidence_config?: { categories: string[] }
  cleanliness_config?: { areas: string[] }
  security_config?: unknown
}

interface ChecklistTemplate {
  name: string
  sections: ChecklistSection[]
}

interface TemplatePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: ChecklistTemplate
}

function SectionIcon({ type }: { type?: string }) {
  switch (type) {
    case 'evidence':
      return <Camera className="h-4 w-4 text-blue-600" />
    case 'cleanliness_bonus':
      return <Sparkles className="h-4 w-4 text-green-600" />
    case 'security_talk':
      return <Shield className="h-4 w-4 text-orange-600" />
    default:
      return null
  }
}

export function TemplatePreviewDialog({ open, onOpenChange, template }: TemplatePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Vista Previa - {template.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {template.sections.map((section, sectionIndex) => (
            <Card key={sectionIndex}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <SectionIcon type={section.section_type} />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {section.section_type === 'evidence' && section.evidence_config?.categories && (
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-2">Categorías de evidencia:</p>
                    <ul className="list-disc pl-4">
                      {section.evidence_config.categories.map((cat, i) => (
                        <li key={i}>{cat}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {section.section_type === 'cleanliness_bonus' && section.cleanliness_config?.areas && (
                  <div className="text-sm text-muted-foreground mb-3">
                    <p className="font-medium">Áreas: {section.cleanliness_config.areas.join(', ')}</p>
                  </div>
                )}
                {section.section_type === 'security_talk' && (
                  <p className="text-sm text-muted-foreground">Sección de charla de seguridad</p>
                )}
                {section.items?.map((item, itemIndex) => (
                  <div key={itemIndex} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{item.description}</span>
                      {item.required && <Badge variant="outline">Requerido</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Check className="h-4 w-4 mr-1" />
                        Pass
                      </Button>
                      <Button variant="outline" size="sm">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Flag
                      </Button>
                      <Button variant="outline" size="sm">
                        <X className="h-4 w-4 mr-1" />
                        Fail
                      </Button>
                    </div>
                    {(item.item_type === 'measure' || item.item_type === 'text') && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {item.expected_value && `Valor esperado: ${item.expected_value}`}
                        {item.tolerance && ` (±${item.tolerance})`}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
