"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckSquare, Camera, Sparkles, Shield, Plus } from "lucide-react"
import { CollapsibleSectionCard } from "./collapsible-section-card"
import { SectionEditorBody } from "./section-editor-body"
import type { ChecklistTemplate, ChecklistSection, ChecklistItem } from "./types"

const SECTION_TYPES = [
  {
    type: "checklist" as const,
    label: "Checklist",
    description: "Lista de verificación con ítems a completar",
    icon: CheckSquare,
    className: "",
  },
  {
    type: "evidence" as const,
    label: "Evidencia Fotográfica",
    description: "Captura de fotos por categoría",
    icon: Camera,
    className: "border-blue-200 bg-blue-50/50 hover:bg-blue-100/50",
  },
  {
    type: "cleanliness_bonus" as const,
    label: "Verificación de Limpieza",
    description: "Checklist + evidencia fotográfica de limpieza",
    icon: Sparkles,
    className: "border-green-200 bg-green-50/50 hover:bg-green-100/50",
  },
  {
    type: "security_talk" as const,
    label: "Charla de Seguridad",
    description: "Registro de charla de seguridad",
    icon: Shield,
    className: "border-orange-200 bg-orange-50/50 hover:bg-orange-100/50",
  },
]

function createSectionForType(
  type: "checklist" | "evidence" | "cleanliness_bonus" | "security_talk",
  orderIndex: number,
  existingSections: ChecklistSection[]
): ChecklistSection {
  const count = existingSections.filter((s) => s.section_type === type).length
  const baseTitle =
    type === "checklist"
      ? `Nueva Sección ${existingSections.length + 1}`
      : type === "evidence"
        ? `Evidencia Fotográfica ${count + 1}`
        : type === "security_talk"
          ? `Charla de Seguridad ${count + 1}`
          : `Verificación de Limpieza ${count + 1}`

  if (type === "checklist") {
    return {
      title: baseTitle,
      order_index: orderIndex,
      section_type: "checklist",
      items: [
        {
          description: "Nuevo Item",
          required: true,
          order_index: 0,
          item_type: "check",
        },
      ],
    }
  }
  if (type === "evidence") {
    return {
      title: baseTitle,
      order_index: orderIndex,
      section_type: "evidence",
      evidence_config: {
        min_photos: 1,
        max_photos: 5,
        categories: ["Estado General", "Detalles Específicos"],
        descriptions: {
          "Estado General": "Capturar vista general del equipo",
          "Detalles Específicos": "Fotografiar detalles relevantes",
        },
      },
      items: [],
    }
  }
  if (type === "security_talk") {
    return {
      title: baseTitle,
      order_index: orderIndex,
      section_type: "security_talk",
      security_config: {
        mode: "plant_manager",
        require_attendance: true,
        require_topic: true,
        require_reflection: true,
        allow_evidence: false,
      },
      items: [],
    }
  }
  return {
    title: baseTitle,
    order_index: orderIndex,
    section_type: "cleanliness_bonus",
    cleanliness_config: {
      min_photos: 2,
      max_photos: 4,
      areas: ["Interior", "Exterior"],
      descriptions: {
        Interior: "Fotografiar evidencia del estado de limpieza interior",
        Exterior: "Fotografiar evidencia del estado de limpieza exterior",
      },
    },
    items: [
      {
        description: "Interior está limpio",
        required: true,
        order_index: 0,
        item_type: "check",
      },
      {
        description: "Exterior está limpio",
        required: true,
        order_index: 1,
        item_type: "check",
      },
    ],
  }
}

interface SectionsStepProps {
  template: ChecklistTemplate
  setTemplate: React.Dispatch<React.SetStateAction<ChecklistTemplate>>
  expandedSectionIndex: number | null
  onExpandedChange: (index: number | null) => void
}

export function SectionsStep({
  template,
  setTemplate,
  expandedSectionIndex,
  onExpandedChange,
}: SectionsStepProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const sections = template.sections || []

  const addSection = (type: "checklist" | "evidence" | "cleanliness_bonus" | "security_talk") => {
    const newSection = createSectionForType(type, sections.length, sections)
    setTemplate((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }))
    setShowAddDialog(false)
    onExpandedChange(sections.length)
  }

  const updateSection = (sectionIndex: number, updates: Partial<ChecklistSection>) => {
    setTemplate((prev) => {
      const newSections = [...prev.sections]
      newSections[sectionIndex] = { ...newSections[sectionIndex], ...updates }
      return { ...prev, sections: newSections }
    })
  }

  const deleteSection = (sectionIndex: number) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== sectionIndex),
    }))
    const newExpanded =
      expandedSectionIndex === sectionIndex
        ? null
        : expandedSectionIndex !== null && expandedSectionIndex > sectionIndex
          ? expandedSectionIndex - 1
          : expandedSectionIndex
    onExpandedChange(newExpanded)
  }

  const moveSectionUp = (sectionIndex: number) => {
    if (sectionIndex === 0) return
    setTemplate((prev) => {
      const newSections = [...prev.sections]
      ;[newSections[sectionIndex - 1], newSections[sectionIndex]] = [
        newSections[sectionIndex],
        newSections[sectionIndex - 1],
      ]
      return { ...prev, sections: newSections }
    })
    onExpandedChange(sectionIndex - 1)
  }

  const moveSectionDown = (sectionIndex: number) => {
    if (sectionIndex >= sections.length - 1) return
    setTemplate((prev) => {
      const newSections = [...prev.sections]
      ;[newSections[sectionIndex], newSections[sectionIndex + 1]] = [
        newSections[sectionIndex + 1],
        newSections[sectionIndex],
      ]
      return { ...prev, sections: newSections }
    })
    onExpandedChange(sectionIndex + 1)
  }

  const addItem = (sectionIndex: number) => {
    const section = sections[sectionIndex]
    if (!section) return
    const newItem: ChecklistItem = {
      description: "Nuevo Item",
      required: true,
      order_index: section.items.length,
      item_type: "check",
    }
    updateSection(sectionIndex, {
      items: [...section.items, newItem],
    })
  }

  const deleteItem = (sectionIndex: number, itemIndex: number) => {
    const section = sections[sectionIndex]
    if (!section) return
    const updatedItems = section.items.filter((_, i) => i !== itemIndex)
    updateSection(sectionIndex, { items: updatedItems })
  }

  const updateItem = (
    sectionIndex: number,
    itemIndex: number,
    updates: Partial<ChecklistItem>
  ) => {
    const section = sections[sectionIndex]
    if (!section) return
    const updatedItems = section.items.map((item, i) =>
      i === itemIndex ? { ...item, ...updates } : item
    )
    updateSection(sectionIndex, { items: updatedItems })
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Paso 2 de 3: Secciones</p>
      <p className="text-sm text-muted-foreground">
        Agrega y edita las secciones de tu plantilla.
      </p>

      <div className="space-y-4">
        {sections.map((section, sectionIndex) => (
          <CollapsibleSectionCard
            key={sectionIndex}
            section={section}
            sectionIndex={sectionIndex}
            totalSections={sections.length}
            expanded={expandedSectionIndex === sectionIndex}
            onToggle={(open) =>
              onExpandedChange(open ? sectionIndex : null)
            }
            onDelete={() => deleteSection(sectionIndex)}
            onMoveUp={() => moveSectionUp(sectionIndex)}
            onMoveDown={() => moveSectionDown(sectionIndex)}
          >
            <SectionEditorBody
              section={section}
              sectionIndex={sectionIndex}
              onTitleChange={(title) =>
                updateSection(sectionIndex, { title })
              }
              onAddItem={() => addItem(sectionIndex)}
              onDeleteItem={(itemIndex) => deleteItem(sectionIndex, itemIndex)}
              onUpdateItem={(itemIndex, updates) =>
                updateItem(sectionIndex, itemIndex, updates)
              }
            />
          </CollapsibleSectionCard>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={() => setShowAddDialog(true)}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Agregar sección
      </Button>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar sección</DialogTitle>
            <DialogDescription>
              Elige el tipo de sección que deseas agregar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4 sm:grid-cols-2">
            {SECTION_TYPES.map(({ type, label, description, icon: Icon, className }) => (
              <Card
                key={type}
                className={`cursor-pointer transition-colors hover:border-primary/50 ${className}`}
                onClick={() => addSection(type)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <CardTitle className="text-base">{label}</CardTitle>
                  </div>
                  <CardDescription className="text-sm">
                    {description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
