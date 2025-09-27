"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CheckSquare, FileText, Save, Wrench, Loader2, Trash } from "lucide-react"
import { createClient } from "@/lib/supabase"

// Datos de ejemplo para el checklist
const checklistData = {
  id: "CL001",
  name: "Mantenimiento Preventivo 1000h - Mezcladora CR-15",
  assetId: "A007",
  asset: "Mezcladora de Concreto CR-15",
  maintenanceId: "PM001",
  sections: [
    {
      title: "Inspección Visual",
      items: [
        { id: "1.1", description: "Verificar ausencia de fugas de aceite", required: true },
        { id: "1.2", description: "Inspeccionar estado de mangueras hidráulicas", required: true },
        { id: "1.3", description: "Comprobar estado de correas y poleas", required: true },
        { id: "1.4", description: "Verificar estado de tambor mezclador", required: true },
        { id: "1.5", description: "Inspeccionar estructura por grietas o deformaciones", required: true },
      ],
    },
    {
      title: "Sistema Hidráulico",
      items: [
        { id: "2.1", description: "Cambiar filtros de aceite hidráulico", required: true },
        { id: "2.2", description: "Cambiar aceite hidráulico", required: true },
        { id: "2.3", description: "Verificar presión del sistema hidráulico", required: true },
        { id: "2.4", description: "Comprobar funcionamiento de válvulas", required: true },
        { id: "2.5", description: "Inspeccionar cilindros hidráulicos", required: true },
      ],
    },
    {
      title: "Sistema de Transmisión",
      items: [
        { id: "3.1", description: "Verificar estado de engranajes", required: true },
        { id: "3.2", description: "Comprobar alineación de ejes", required: true },
        { id: "3.3", description: "Lubricar rodamientos", required: true },
        { id: "3.4", description: "Verificar tensión de cadenas", required: true },
        { id: "3.5", description: "Comprobar estado de acoplamientos", required: true },
      ],
    },
    {
      title: "Sistema Eléctrico",
      items: [
        { id: "4.1", description: "Verificar conexiones eléctricas", required: true },
        { id: "4.2", description: "Comprobar funcionamiento de sensores", required: true },
        { id: "4.3", description: "Verificar sistema de iluminación", required: false },
        { id: "4.4", description: "Comprobar funcionamiento de alarmas", required: true },
        { id: "4.5", description: "Verificar panel de control", required: true },
      ],
    },
    {
      title: "Pruebas Funcionales",
      items: [
        { id: "5.1", description: "Realizar prueba de carga", required: true },
        { id: "5.2", description: "Verificar tiempos de ciclo", required: true },
        { id: "5.3", description: "Comprobar sistema de descarga", required: true },
        { id: "5.4", description: "Verificar sistema de agua", required: true },
        { id: "5.5", description: "Realizar prueba de ruido y vibraciones", required: true },
      ],
    },
  ],
  notes: "",
  technician: "",
  completionDate: "",
  status: "Pendiente", // Pendiente, En progreso, Completado
}

interface MaintenanceChecklistProps {
  id: string
}

export function MaintenanceChecklist({ id }: MaintenanceChecklistProps) {
  const router = useRouter()
  // En una aplicación real, buscaríamos los datos del checklist por su ID
  // const checklist = getChecklistById(id);
  const checklist = checklistData // Usamos datos de ejemplo

  const [checklistState, setChecklistState] = useState(() => {
    // Inicializar el estado con los items del checklist
    const initialState: Record<string, boolean> = {}
    checklist.sections.forEach((section) => {
      section.items.forEach((item) => {
        initialState[item.id] = false
      })
    })
    return initialState
  })

  const [notes, setNotes] = useState(checklist.notes)
  const [technician, setTechnician] = useState(checklist.technician)
  const [completionDate, setCompletionDate] = useState(checklist.completionDate)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [generatedOrderId, setGeneratedOrderId] = useState("")
  const [usedParts, setUsedParts] = useState<{ id: string; name: string; quantity: number; cost: string }[]>([])
  const [showPartsDialog, setShowPartsDialog] = useState(false)
  const [newPart, setNewPart] = useState({ id: "", name: "", quantity: 1, cost: "" })

  const handleCheckItem = (itemId: string, checked: boolean) => {
    setChecklistState((prev) => ({
      ...prev,
      [itemId]: checked,
    }))
  }

  const getTotalItems = () => {
    let total = 0
    checklist.sections.forEach((section) => {
      total += section.items.length
    })
    return total
  }

  const getCompletedItems = () => {
    return Object.values(checklistState).filter(Boolean).length
  }

  const getCompletionPercentage = () => {
    const total = getTotalItems()
    if (total === 0) return 0
    return Math.round((getCompletedItems() / total) * 100)
  }

  const isChecklistComplete = () => {
    // Verificar si todos los items requeridos están marcados
    let complete = true
    checklist.sections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.required && !checklistState[item.id]) {
          complete = false
        }
      })
    })
    return complete && technician.trim() !== ""
  }

  const handleAddPart = () => {
    if (newPart.name && newPart.quantity > 0) {
      setUsedParts([
        ...usedParts,
        {
          id: `part-${Date.now()}`,
          name: newPart.name,
          quantity: newPart.quantity,
          cost: newPart.cost,
        },
      ])
      setNewPart({ id: "", name: "", quantity: 1, cost: "" })
      setShowPartsDialog(false)
    }
  }

  const handleRemovePart = (partId: string) => {
    setUsedParts(usedParts.filter((part) => part.id !== partId))
  }

  const handleCompleteChecklist = async () => {
    if (!isChecklistComplete()) return

    setIsSubmitting(true)

    try {
      // 1. Guardar el checklist completado
      const checklistCompletionData = {
        checklistId: checklist.id,
        assetId: checklist.assetId,
        completedItems: checklistState,
        technician,
        completionDate: completionDate || new Date().toISOString(),
        notes,
        status: "Completado",
      }

      console.log("Guardando checklist completado:", checklistCompletionData)

      // 2. Generar automáticamente una orden de servicio
      const serviceOrderData = {
        assetId: checklist.assetId,
        asset: checklist.asset,
        type: "Preventivo",
        priority: "Media",
        status: "Completado",
        date: completionDate || new Date().toISOString(),
        technician,
        description: `Mantenimiento preventivo completado: ${checklist.name}`,
        notes,
        parts: usedParts,
        checklistId: checklist.id,
        totalCost: usedParts
          .reduce((total, part) => {
            const partCost = Number.parseFloat(part.cost) || 0
            return total + partCost * part.quantity
          }, 0)
          .toFixed(2),
      }

      console.log("Generando orden de servicio:", serviceOrderData)

      // En una aplicación real, guardaríamos en la base de datos
      const supabase = createClient()

      // Guardar la orden de servicio en Supabase
      const { data, error } = await supabase
        .from("service_orders")
        .insert([
          {
            asset_id: serviceOrderData.assetId,
            asset_name: serviceOrderData.asset,
            type: serviceOrderData.type,
            priority: serviceOrderData.priority,
            status: serviceOrderData.status,
            date: serviceOrderData.date,
            technician: serviceOrderData.technician,
            description: serviceOrderData.description,
            notes: serviceOrderData.notes,
            parts: serviceOrderData.parts,
            checklist_id: serviceOrderData.checklistId,
            total_cost: serviceOrderData.totalCost,
            created_at: new Date().toISOString(),
          },
        ])
        .select()

      if (error) {
        console.error("Error al guardar la orden de servicio:", error)
        throw new Error("No se pudo generar la orden de servicio")
      }

      // Guardar el checklist completado
      const { error: checklistError } = await supabase.from("completed_checklists").insert([
        {
          checklist_id: checklistCompletionData.checklistId,
          asset_id: checklistCompletionData.assetId,
          completed_items: checklistCompletionData.completedItems,
          technician: checklistCompletionData.technician,
          completion_date: checklistCompletionData.completionDate,
          notes: checklistCompletionData.notes,
          status: checklistCompletionData.status,
          // service_order_id can be linked later if needed
          created_at: new Date().toISOString(),
        },
      ])

      if (checklistError) {
        console.error("Error al guardar el checklist completado:", checklistError)
      }

      // Actualizar el estado del activo
      const { error: assetError } = await supabase
        .from("assets")
        .update({
          last_maintenance_date: new Date().toISOString(),
          status: "operational",
        })
        .eq("asset_id", checklist.assetId)

      if (assetError) {
        console.error("Error al actualizar el estado del activo:", assetError)
      }

      // Mostrar diálogo de éxito
      setGeneratedOrderId((data && data[0] && (data[0] as any).order_id) || "")
      setShowSuccessDialog(true)
    } catch (error) {
      console.error("Error al completar el checklist:", error)
      alert("Ocurrió un error al completar el checklist. Por favor, inténtelo de nuevo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{checklist.name}</CardTitle>
              <CardDescription>Checklist para mantenimiento preventivo de {checklist.asset}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">
                Completado: {getCompletedItems()}/{getTotalItems()} ({getCompletionPercentage()}%)
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {checklist.sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-3">
              <h3 className="text-lg font-semibold">{section.title}</h3>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div key={item.id} className="flex items-start space-x-2">
                    <Checkbox
                      id={item.id}
                      checked={checklistState[item.id]}
                      onCheckedChange={(checked) => handleCheckItem(item.id, checked === true)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor={item.id}
                        className={`text-sm ${item.required ? "font-medium" : "text-muted-foreground"}`}
                      >
                        {item.description}
                        {item.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
              {sectionIndex < checklist.sections.length - 1 && <Separator />}
            </div>
          ))}

          <div className="space-y-4 pt-4">
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
              <Label htmlFor="completionDate">Fecha de Realización</Label>
              <Input
                id="completionDate"
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="parts">Repuestos Utilizados</Label>
                <Button variant="outline" size="sm" onClick={() => setShowPartsDialog(true)}>
                  Agregar Repuesto
                </Button>
              </div>

              {usedParts.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2 text-xs font-medium">Repuesto</th>
                        <th className="text-center p-2 text-xs font-medium">Cantidad</th>
                        <th className="text-right p-2 text-xs font-medium">Costo</th>
                        <th className="w-10 p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {usedParts.map((part) => (
                        <tr key={part.id} className="border-t">
                          <td className="p-2 text-sm">{part.name}</td>
                          <td className="p-2 text-sm text-center">{part.quantity}</td>
                          <td className="p-2 text-sm text-right">{part.cost ? `$${part.cost}` : "-"}</td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500"
                              onClick={() => handleRemovePart(part.id)}
                            >
                              <Trash className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-4 border rounded-md text-sm text-muted-foreground">
                  No se han registrado repuestos utilizados
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observaciones</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ingrese observaciones o comentarios adicionales"
                rows={4}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline">
            <Save className="mr-2 h-4 w-4" />
            Guardar Progreso
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!isChecklistComplete() || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Completar Checklist
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Confirmar finalización del checklist?</AlertDialogTitle>
                <AlertDialogDescription>
                  Al completar este checklist, se generará automáticamente una orden de trabajo para el mantenimiento
                  preventivo. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleCompleteChecklist}>
                  <div className="flex items-center">
                    <Wrench className="mr-2 h-4 w-4" />
                    Completar y Generar OT
                  </div>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instrucciones para Completar el Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Antes de Comenzar</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Asegúrese de tener todas las herramientas y repuestos necesarios.</li>
              <li>Verifique que el equipo esté apagado y desconectado.</li>
              <li>Use el equipo de protección personal adecuado.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Durante la Inspección</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Marque cada ítem solo después de completarlo satisfactoriamente.</li>
              <li>Si encuentra algún problema, anótelo en las observaciones.</li>
              <li>
                Los ítems marcados con <span className="text-red-500">*</span> son obligatorios.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Al Finalizar</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Complete todos los campos requeridos.</li>
              <li>Al hacer clic en "Completar Checklist", se generará automáticamente una orden de trabajo.</li>
              <li>Asegúrese de guardar su progreso si necesita interrumpir la inspección.</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full">
            <FileText className="mr-2 h-4 w-4" />
            Descargar Checklist en PDF
          </Button>
        </CardFooter>
      </Card>

      {/* Diálogo para agregar repuestos */}
      <Dialog open={showPartsDialog} onOpenChange={setShowPartsDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Agregar Repuesto Utilizado</DialogTitle>
            <DialogDescription>Ingrese los detalles del repuesto utilizado durante el mantenimiento</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="partName">Nombre del Repuesto</Label>
              <Input
                id="partName"
                placeholder="Ej: Filtro de aceite"
                value={newPart.name}
                onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partQuantity">Cantidad</Label>
                <Input
                  id="partQuantity"
                  type="number"
                  min="1"
                  value={newPart.quantity}
                  onChange={(e) => setNewPart({ ...newPart, quantity: Number.parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partCost">Costo Unitario</Label>
                <Input
                  id="partCost"
                  placeholder="Ej: 25.50"
                  value={newPart.cost}
                  onChange={(e) => setNewPart({ ...newPart, cost: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPartsDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddPart} disabled={!newPart.name || newPart.quantity < 1}>
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de éxito */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-green-600">Checklist Completado Exitosamente</DialogTitle>
            <DialogDescription>
              El checklist ha sido completado y se ha generado automáticamente una orden de servicio.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 border rounded-md bg-green-50">
              <h4 className="font-medium text-green-800 mb-2">Orden de Servicio Generada</h4>
              <p className="text-sm text-green-700">ID: {generatedOrderId}</p>
              <p className="text-sm text-green-700">Activo: {checklist.asset}</p>
              <p className="text-sm text-green-700">Técnico: {technician}</p>
              <p className="text-sm text-green-700">Fecha: {completionDate || new Date().toLocaleDateString()}</p>
              {usedParts.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-green-800">Repuestos utilizados: {usedParts.length}</p>
                  <p className="text-sm text-green-700">
                    Costo total: $
                    {usedParts
                      .reduce((total, part) => {
                        const partCost = Number.parseFloat(part.cost) || 0
                        return total + partCost * part.quantity
                      }, 0)
                      .toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => router.push("/activos/" + checklist.assetId)}>
              Ver Activo
            </Button>
            <Button onClick={() => router.push("/ordenes/" + generatedOrderId)} disabled={!generatedOrderId}>Ver Orden de Servicio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
