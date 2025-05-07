"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Save } from "lucide-react"

export function ChecklistTemplateForm() {
  const [sections, setSections] = useState([
    {
      title: "Inspección Visual",
      items: [
        { description: "Verificar ausencia de fugas de aceite" },
        { description: "Inspeccionar estado de mangueras hidráulicas" },
      ],
    },
  ])

  const addSection = () => {
    setSections([...sections, { title: "", items: [] }])
  }

  const addItem = (sectionIndex: number) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items = [...updatedSections[sectionIndex].items, { description: "" }]
    setSections(updatedSections)
  }

  const updateSectionTitle = (sectionIndex: number, title: string) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].title = title
    setSections(updatedSections)
  }

  const updateItemDescription = (sectionIndex: number, itemIndex: number, description: string) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items[itemIndex].description = description
    setSections(updatedSections)
  }

  const removeSection = (sectionIndex: number) => {
    const updatedSections = sections.filter((_, i) => i !== sectionIndex)
    setSections(updatedSections)
  }

  const removeItem = (sectionIndex: number, itemIndex: number) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items = updatedSections[sectionIndex].items.filter((_, i) => i !== itemIndex)
    setSections(updatedSections)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información de la Plantilla</CardTitle>
          <CardDescription>Ingresa la información básica de la plantilla de checklist</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="templateName">Nombre de la Plantilla</Label>
            <Input id="templateName" placeholder="Ej: Mantenimiento Preventivo 500h" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="templateDescription">Descripción</Label>
            <Textarea id="templateDescription" placeholder="Descripción general de la plantilla" rows={3} />
          </div>
        </CardContent>
      </Card>

      {sections.map((section, sectionIndex) => (
        <Card key={sectionIndex}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sección {sectionIndex + 1}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => removeSection(sectionIndex)}>
                Eliminar Sección
              </Button>
            </div>
            <CardDescription>Define los items de esta sección</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`sectionTitle-${sectionIndex}`}>Título de la Sección</Label>
              <Input
                id={`sectionTitle-${sectionIndex}`}
                placeholder="Ej: Inspección Visual"
                value={section.title}
                onChange={(e) => updateSectionTitle(sectionIndex, e.target.value)}
              />
            </div>

            {section.items.map((item, itemIndex) => (
              <div key={itemIndex} className="flex items-center space-x-2">
                <div className="space-y-2 flex-1">
                  <Label htmlFor={`itemDescription-${sectionIndex}-${itemIndex}`}>Item {itemIndex + 1}</Label>
                  <Input
                    id={`itemDescription-${sectionIndex}-${itemIndex}`}
                    placeholder="Ej: Verificar nivel de aceite"
                    value={item.description}
                    onChange={(e) => updateItemDescription(sectionIndex, itemIndex, e.target.value)}
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeItem(sectionIndex, itemIndex)}>
                  Eliminar
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={() => addItem(sectionIndex)}>
              Agregar Item
            </Button>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addSection}>
        Agregar Sección
      </Button>

      <Card>
        <CardFooter className="flex justify-end">
          <Button>
            <Save className="mr-2 h-4 w-4" />
            Guardar Plantilla
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
