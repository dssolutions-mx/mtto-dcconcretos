"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Camera, Check, Clock, FileText, Flag, Save, Upload, X } from "lucide-react"
import { SignatureCanvas } from "@/components/checklists/signature-canvas"

// Datos de ejemplo para el checklist
const checklistData = {
  id: "CL001",
  name: "Mantenimiento Mensual HVAC",
  assetId: "A003",
  asset: "Sistema HVAC Planta 2",
  modelId: "MOD003",
  model: "PG-5000",
  manufacturer: "PowerGen",
  frequency: "monthly",
  sections: [
    {
      title: "Inspección Visual",
      items: [
        { id: "1.1", description: "Limpiar filtros de entrada de campana exterior", required: true },
        { id: "1.2", description: "Inspeccionar estado de conductos", required: true },
        { id: "1.3", description: "Verificar ausencia de fugas", required: true },
        { id: "1.4", description: "Comprobar estado de aislamiento", required: true },
      ],
    },
    {
      title: "Sistema de Refrigeración",
      items: [
        { id: "2.1", description: "Verificar nivel de refrigerante", required: true },
        { id: "2.2", description: "Comprobar presión del sistema", required: true },
        { id: "2.3", description: "Inspeccionar condensador", required: true },
        { id: "2.4", description: "Verificar funcionamiento de ventiladores", required: true },
      ],
    },
    {
      title: "Sistema Eléctrico",
      items: [
        { id: "3.1", description: "Verificar conexiones eléctricas", required: true },
        { id: "3.2", description: "Comprobar consumo eléctrico", required: true },
        { id: "3.3", description: "Inspeccionar termostatos", required: true },
        { id: "3.4", description: "Verificar sistema de control", required: true },
      ],
    },
  ],
  technician: "",
  completionDate: new Date().toISOString().split("T")[0],
  notes: "",
}

interface ChecklistExecutionProps {
  id: string
}

export function ChecklistExecution({ id }: ChecklistExecutionProps) {
  // En una aplicación real, buscaríamos los datos del checklist por su ID
  // const checklist = getChecklistById(id);
  const checklist = checklistData // Usamos datos de ejemplo

  const [itemStatus, setItemStatus] = useState<Record<string, "pass" | "flag" | "fail" | null>>({})
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({})
  const [itemPhotos, setItemPhotos] = useState<Record<string, string | null>>({})
  const [notes, setNotes] = useState(checklist.notes)
  const [technician, setTechnician] = useState(checklist.technician)
  const [signature, setSignature] = useState<string | null>(null)
  const [showCorrective, setShowCorrective] = useState(false)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)

  const handleStatusChange = (itemId: string, status: "pass" | "flag" | "fail") => {
    setItemStatus((prev) => ({ ...prev, [itemId]: status }))

    // Si el estado es flag o fail, mostrar el diálogo para agregar foto y notas
    if (status === "flag" || status === "fail") {
      setSelectedItem(itemId)
    }
  }

  const handlePhotoUpload = (itemId: string, file: File) => {
    // En una aplicación real, subiríamos la foto a un servidor
    // Aquí simplemente simulamos la URL de la foto
    const photoUrl = URL.createObjectURL(file)
    setItemPhotos((prev) => ({ ...prev, [itemId]: photoUrl }))
  }

  const handleSubmit = () => {
    // Verificar si hay algún item con estado flag o fail
    const hasIssues = Object.values(itemStatus).some((status) => status === "flag" || status === "fail")

    if (hasIssues) {
      setShowCorrective(true)
    } else {
      // Enviar el checklist completado
      console.log("Checklist completado:", {
        id: checklist.id,
        itemStatus,
        itemNotes,
        itemPhotos,
        notes,
        technician,
        signature,
        completionDate: checklist.completionDate,
      })

      // Redirigir a la página de checklists
      // router.push("/checklists");
    }
  }

  const createCorrectiveAction = () => {
    // Crear una acción correctiva basada en los items con flag o fail
    console.log(
      "Creando acción correctiva para los items:",
      Object.entries(itemStatus)
        .filter(([_, status]) => status === "flag" || status === "fail")
        .map(([itemId]) => itemId),
    )

    // Redirigir a la página de órdenes de trabajo
    // router.push("/ordenes/crear?type=corrective");
  }

  const getTotalItems = () => {
    let total = 0
    checklist.sections.forEach((section) => {
      total += section.items.length
    })
    return total
  }

  const getCompletedItems = () => {
    return Object.values(itemStatus).filter(Boolean).length
  }

  const isChecklistComplete = () => {
    // Verificar si todos los items requeridos tienen un estado
    let complete = true
    checklist.sections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.required && !itemStatus[item.id]) {
          complete = false
        }
      })
    })
    return complete && technician.trim() !== "" && signature !== null
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="bg-blue-500 text-white">
          <CardTitle className="text-2xl">{checklist.name}</CardTitle>
          <CardDescription className="text-white/90">
            {checklist.asset} - {checklist.manufacturer} {checklist.model}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Fecha: {new Date().toLocaleDateString()}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Completado: {getCompletedItems()}/{getTotalItems()}
            </div>
          </div>

          {checklist.sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="mb-8">
              <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
              <div className="space-y-6">
                {section.items.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">{item.description}</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={itemStatus[item.id] === "pass" ? "default" : "outline"}
                          className={`h-12 ${itemStatus[item.id] === "pass" ? "bg-green-500 hover:bg-green-600" : ""}`}
                          onClick={() => handleStatusChange(item.id, "pass")}
                        >
                          <Check
                            className={`mr-2 h-5 w-5 ${itemStatus[item.id] === "pass" ? "text-white" : "text-green-500"}`}
                          />
                          <span className={itemStatus[item.id] === "pass" ? "text-white" : "text-green-500"}>Pass</span>
                        </Button>
                        <Button
                          variant={itemStatus[item.id] === "flag" ? "default" : "outline"}
                          className={`h-12 ${itemStatus[item.id] === "flag" ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                          onClick={() => handleStatusChange(item.id, "flag")}
                        >
                          <Flag
                            className={`mr-2 h-5 w-5 ${itemStatus[item.id] === "flag" ? "text-white" : "text-amber-500"}`}
                          />
                          <span className={itemStatus[item.id] === "flag" ? "text-white" : "text-amber-500"}>Flag</span>
                        </Button>
                        <Button
                          variant={itemStatus[item.id] === "fail" ? "default" : "outline"}
                          className={`h-12 ${itemStatus[item.id] === "fail" ? "bg-red-500 hover:bg-red-600" : ""}`}
                          onClick={() => handleStatusChange(item.id, "fail")}
                        >
                          <X
                            className={`mr-2 h-5 w-5 ${itemStatus[item.id] === "fail" ? "text-white" : "text-red-500"}`}
                          />
                          <span className={itemStatus[item.id] === "fail" ? "text-white" : "text-red-500"}>Fail</span>
                        </Button>
                      </div>

                      {(itemStatus[item.id] === "flag" || itemStatus[item.id] === "fail") && (
                        <div className="mt-4 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor={`notes-${item.id}`}>Notas</Label>
                            <Textarea
                              id={`notes-${item.id}`}
                              placeholder="Describa el problema encontrado"
                              value={itemNotes[item.id] || ""}
                              onChange={(e) => setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Fotografía</Label>
                            {itemPhotos[item.id] ? (
                              <div className="relative">
                                <img
                                  src={itemPhotos[item.id] || ""}
                                  alt="Foto del problema"
                                  className="w-full h-48 object-cover rounded-md"
                                />
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-2 right-2"
                                  onClick={() => setItemPhotos((prev) => ({ ...prev, [item.id]: null }))}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="border-2 border-dashed border-muted-foreground/25 rounded-md p-8 text-center">
                                <div className="flex flex-col items-center gap-2">
                                  <Camera className="h-8 w-8 text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">Sube una foto del problema</p>
                                  <Label
                                    htmlFor={`photo-${item.id}`}
                                    className="cursor-pointer bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
                                  >
                                    <Upload className="h-4 w-4 inline mr-2" />
                                    Subir foto
                                  </Label>
                                  <Input
                                    id={`photo-${item.id}`}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handlePhotoUpload(item.id, e.target.files[0])
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          <Separator className="my-6" />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notas Generales</Label>
              <Textarea
                id="notes"
                placeholder="Ingrese observaciones o comentarios adicionales"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="technician">
                Técnico Responsable <span className="text-red-500">*</span>
              </Label>
              <Input
                id="technician"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                placeholder="Nombre del técnico"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Firma Digital <span className="text-red-500">*</span>
              </Label>
              <div className="border rounded-md p-2">
                <SignatureCanvas onSave={setSignature} />
              </div>
              {signature && (
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => setSignature(null)}>
                    Borrar firma
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline">
            <Save className="mr-2 h-4 w-4" />
            Guardar Borrador
          </Button>
          <Button disabled={!isChecklistComplete()} onClick={handleSubmit}>
            <FileText className="mr-2 h-4 w-4" />
            Completar Checklist
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={showCorrective} onOpenChange={setShowCorrective}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Acción Correctiva</AlertDialogTitle>
            <AlertDialogDescription>
              Se han detectado problemas en este checklist. ¿Desea crear una acción correctiva?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={createCorrectiveAction}>Sí</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
