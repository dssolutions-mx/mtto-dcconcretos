"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Camera, Check, Clock, FileText, Flag, Loader2, Save, Upload, X } from "lucide-react"
import { SignatureCanvas } from "@/components/checklists/signature-canvas"
import { toast } from "sonner"
import { createBrowserClient } from '@supabase/ssr'

interface ChecklistExecutionProps {
  id: string
}

export function ChecklistExecution({ id }: ChecklistExecutionProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [checklist, setChecklist] = useState<any>(null)
  
  const [itemStatus, setItemStatus] = useState<Record<string, "pass" | "flag" | "fail" | null>>({})
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({})
  const [itemPhotos, setItemPhotos] = useState<Record<string, string | null>>({})
  const [notes, setNotes] = useState('')
  const [technician, setTechnician] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [showCorrective, setShowCorrective] = useState(false)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  
  useEffect(() => {
    const fetchChecklistData = async () => {
      try {
        setLoading(true)
        
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        
        const { data, error } = await supabase
          .from('checklist_schedules')
          .select(`
            *,
            checklists (
              *,
              checklist_sections (
                *,
                checklist_items(*)
              ),
              equipment_models (
                id, 
                name, 
                manufacturer
              )
            ),
            assets (
              id,
              name,
              asset_id,
              location
            )
          `)
          .eq('id', id)
          .single()
        
        if (error) throw error
        
        if (!data) throw new Error('Checklist no encontrado')
        
        // Formatear los datos del checklist para usar en el componente
        const formattedData = {
          id: data.id,
          name: data.checklists.name,
          assetId: data.assets.id,
          asset: data.assets.name,
          modelId: data.checklists.model_id,
          model: data.checklists.equipment_models?.name || 'N/A',
          manufacturer: data.checklists.equipment_models?.manufacturer || 'N/A',
          frequency: data.checklists.frequency,
          sections: data.checklists.checklist_sections.map((section: any) => ({
            id: section.id,
            title: section.title,
            items: section.checklist_items.map((item: any) => ({
              id: item.id,
              description: item.description,
              required: item.required,
              item_type: item.item_type || 'check',
              expected_value: item.expected_value,
              tolerance: item.tolerance
            }))
          })),
          scheduledDate: new Date(data.scheduled_date).toLocaleDateString(),
          technicianId: data.assigned_to,
          technician: ''
        }
        
        // Fetch technician info separately 
        if (data.assigned_to) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('nombre, apellido')
            .eq('id', data.assigned_to)
            .single()
            
          if (profileData) {
            formattedData.technician = `${profileData.nombre || ''} ${profileData.apellido || ''}`.trim() || 'Técnico asignado'
          }
        }
        
        setChecklist(formattedData)
        setTechnician(formattedData.technician)
      } catch (error: any) {
        console.error('Error loading checklist:', error)
        toast.error(`Error al cargar el checklist: ${error.message}`)
      } finally {
        setLoading(false)
      }
    }
    
    if (id) {
      fetchChecklistData()
    }
  }, [id])

  const handleStatusChange = (itemId: string, status: "pass" | "flag" | "fail") => {
    setItemStatus((prev) => ({ ...prev, [itemId]: status }))

    // Si el estado es flag o fail, mostrar el diálogo para agregar foto y notas
    if (status === "flag" || status === "fail") {
      setSelectedItem(itemId)
    }
  }

  const handlePhotoUpload = async (itemId: string, file: File) => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const fileName = `checklist_${id}_item_${itemId}_${Date.now()}.${file.name.split('.').pop()}`
      
      const { data, error } = await supabase.storage
        .from('checklist-photos')
        .upload(fileName, file)
      
      if (error) throw error
      
      const { data: urlData } = supabase.storage
        .from('checklist-photos')
        .getPublicUrl(fileName)
      
      setItemPhotos((prev) => ({ 
        ...prev, 
        [itemId]: urlData.publicUrl 
      }))
      
      toast.success('Foto subida exitosamente')
    } catch (error: any) {
      console.error('Error uploading photo:', error)
      toast.error(`Error al subir la foto: ${error.message}`)
    }
  }

  const prepareCompletedItems = () => {
    const completedItems = []
    
    if (!checklist) return []
    
    for (const section of checklist.sections) {
      for (const item of section.items) {
        if (itemStatus[item.id]) {
          completedItems.push({
            id: crypto.randomUUID(),
            item_id: item.id,
            status: itemStatus[item.id],
            notes: itemNotes[item.id] || null,
            photo_url: itemPhotos[item.id] || null
          })
        }
      }
    }
    
    return completedItems
  }
  
  const handleSubmit = async () => {
    if (!isChecklistComplete()) {
      toast.error('Por favor complete todos los campos requeridos')
      return
    }
    
    setSubmitting(true)
    
    try {
      const completedItems = prepareCompletedItems()
      
      // En una implementación real, llamaríamos a la API para guardar el checklist completado
      const response = await fetch('/api/checklists/execution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule_id: id,
          completed_items: completedItems,
          technician: checklist.technician || 'Técnico',
          notes: notes,
          signature: signature
        }),
      })
      
      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      // Verificar si hay algún item con estado flag o fail
      const hasIssues = Object.values(itemStatus).some((status) => status === "flag" || status === "fail")
  
      if (hasIssues) {
        setShowCorrective(true)
      } else {
        toast.success('Checklist completado exitosamente')
        
        // Redirigir a la página de checklists según la frecuencia
        let redirectPath = '/checklists/diarios'
        
        if (checklist.frequency === 'semanal') {
          redirectPath = '/checklists/semanales'
        } else if (checklist.frequency === 'mensual') {
          redirectPath = '/checklists/mensuales'
        }
        
        router.push(redirectPath)
      }
    } catch (error: any) {
      console.error('Error submitting checklist:', error)
      toast.error(`Error al guardar el checklist: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const createCorrectiveAction = async () => {
    try {
      // Crear una orden de trabajo correctiva basada en los items con flag o fail
      const itemsWithIssues = Object.entries(itemStatus)
        .filter(([_, status]) => status === "flag" || status === "fail")
        .map(([itemId]) => {
          const sectionAndItem = findSectionAndItemById(itemId)
          return {
            id: itemId,
            description: sectionAndItem?.item?.description || '',
            notes: itemNotes[itemId] || '',
            photo: itemPhotos[itemId] || null,
            status: itemStatus[itemId]
          }
        })
      
      // Llamar a la función mejorada que crea la orden de trabajo Y las incidencias
      const response = await fetch('/api/checklists/generate-corrective-work-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checklist_id: id,
          items_with_issues: itemsWithIssues
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Error al crear orden de trabajo correctiva')
      }
      
      toast.success(`Orden de trabajo correctiva creada exitosamente. También se registraron ${result.incidents_created || 0} incidencia(s) en el historial del activo.`)
      
      // Redirigir a la página de órdenes de trabajo
      router.push(`/ordenes/${result.work_order_id}`)
    } catch (error: any) {
      console.error('Error creating corrective action:', error)
      toast.error(`Error al crear acción correctiva: ${error.message}`)
    }
  }
  
  const findSectionAndItemById = (itemId: string) => {
    if (!checklist) return null
    
    for (const section of checklist.sections) {
      for (const item of section.items) {
        if (item.id === itemId) {
          return { section, item }
        }
      }
    }
    
    return null
  }

  const getTotalItems = () => {
    if (!checklist) return 0
    
    let total = 0
    checklist.sections.forEach((section: any) => {
      total += section.items.length
    })
    return total
  }

  const getCompletedItems = () => {
    return Object.values(itemStatus).filter(Boolean).length
  }

  const isChecklistComplete = () => {
    if (!checklist) return false
    
    // Verificar si todos los items requeridos tienen un estado
    let complete = true
    checklist.sections.forEach((section: any) => {
      section.items.forEach((item: any) => {
        if (item.required && !itemStatus[item.id]) {
          complete = false
        }
      })
    })
    return complete && technician.trim() !== "" && signature !== null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-muted-foreground">Cargando checklist...</p>
        </div>
      </div>
    )
  }
  
  if (!checklist) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Checklist no encontrado</p>
          <p className="text-muted-foreground mb-4">No se pudo encontrar el checklist solicitado</p>
          <Button onClick={() => router.back()}>Volver</Button>
        </div>
      </div>
    )
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
              <span className="text-sm text-muted-foreground">Fecha: {checklist.scheduledDate}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Completado: {getCompletedItems()}/{getTotalItems()}
            </div>
          </div>

          {checklist.sections.map((section: any, sectionIndex: number) => (
            <div key={sectionIndex} className="mb-8">
              <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
              <div className="space-y-6">
                {section.items.map((item: any) => (
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
                                  Eliminar
                                </Button>
                              </div>
                            ) : (
                              <div className="border-2 border-dashed border-muted-foreground/50 rounded-md p-8 text-center">
                                <Label
                                  htmlFor={`photo-upload-${item.id}`}
                                  className="flex flex-col items-center gap-2 cursor-pointer"
                                >
                                  <Camera className="h-8 w-8 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Agregar Foto</span>
                                  <input
                                    id={`photo-upload-${item.id}`}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handlePhotoUpload(item.id, e.target.files[0])
                                      }
                                    }}
                                  />
                                </Label>
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

          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notas Generales</Label>
              <Textarea
                id="notes"
                placeholder="Agregue notas generales sobre el mantenimiento realizado"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="technician">Técnico Responsable</Label>
              <Input id="technician" value={technician} readOnly />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signature">Firma</Label>
              <SignatureCanvas onSave={setSignature} />
              {signature && <p className="text-sm text-green-600 mt-1">Firma guardada</p>}
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isChecklistComplete() || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Completar Checklist
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={showCorrective} onOpenChange={setShowCorrective}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Crear Acción Correctiva</AlertDialogTitle>
            <AlertDialogDescription>
              Se han detectado problemas en este checklist. ¿Desea crear una Orden de Trabajo correctiva para solucionar
              estos problemas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, solo guardar</AlertDialogCancel>
            <AlertDialogAction onClick={createCorrectiveAction}>Sí, crear orden correctiva</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
