"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Save, Plus, Trash2, ArrowLeft, Camera, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { UpdateWorkOrder, MaintenanceType, ServiceOrderPriority, WorkOrderStatus, Profile, PurchaseOrderItem } from "@/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EvidenceUpload, type EvidencePhoto } from "@/components/ui/evidence-upload"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import Link from "next/link"
import { PartAutocomplete, PartSuggestion } from "@/components/inventory/part-autocomplete"

// Simpler types for select dropdowns
interface AssetForSelect {
  id: string;
  name: string | null;
  asset_id: string | null;
}

interface ChecklistForSelect {
  id: string;
  name: string | null;
}

interface WorkOrderEditFormProps {
  workOrder: any; // Work order with asset relation
}

export function WorkOrderEditForm({ workOrder }: WorkOrderEditFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState<Partial<UpdateWorkOrder>>({
    type: workOrder.type,
    priority: workOrder.priority,
    status: workOrder.status,
    description: workOrder.description,
    asset_id: workOrder.asset_id,
    assigned_to: workOrder.assigned_to,
    estimated_duration: workOrder.estimated_duration,
    planned_date: workOrder.planned_date,
    checklist_id: workOrder.checklist_id,
  })
  
  const [assets, setAssets] = useState<AssetForSelect[]>([])
  const [technicians, setTechnicians] = useState<Profile[]>([])
  const [checklists, setChecklists] = useState<ChecklistForSelect[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)

  const [plannedDate, setPlannedDate] = useState<Date | undefined>(
    workOrder.planned_date ? new Date(workOrder.planned_date) : undefined
  )
  const [isFromChecklist, setIsFromChecklist] = useState(!!workOrder.checklist_id)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add state for parts - parse existing required_parts
  const [requiredParts, setRequiredParts] = useState<PurchaseOrderItem[]>(() => {
    if (workOrder.required_parts) {
      try {
        const parsed = typeof workOrder.required_parts === 'string' 
          ? JSON.parse(workOrder.required_parts)
          : workOrder.required_parts
        return Array.isArray(parsed) ? parsed.map((part: any) => ({
          ...part,
          id: part.id || crypto.randomUUID() // Ensure each part has an ID
        })) : []
      } catch {
        return []
      }
    }
    return []
  })
  
  const [newPart, setNewPart] = useState<PurchaseOrderItem>({
    name: '',
    partNumber: '',
    part_id: undefined,
    quantity: 1,
    unit_price: 0,
    total_price: 0
  })

  // Add state for evidence - parse existing creation_photos
  const [creationEvidence, setCreationEvidence] = useState<EvidencePhoto[]>(() => {
    if (workOrder.creation_photos) {
      try {
        const parsed = typeof workOrder.creation_photos === 'string' 
          ? JSON.parse(workOrder.creation_photos)
          : workOrder.creation_photos
        return Array.isArray(parsed) ? parsed.map((evidence: any) => ({
          ...evidence,
          id: evidence.id || crypto.randomUUID() // Ensure each evidence has an ID
        })) : []
      } catch {
        return []
      }
    }
    return []
  })
  
  const [showEvidenceDialog, setShowEvidenceDialog] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      let fetchError = false;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()
        if (profileError) {
            console.error("Error fetching user profile:", profileError)
            fetchError = true;
        } else if (profile) {
          setCurrentUser(profile)
        }
      }

      const { data: assetsData, error: assetsError } = await supabase
        .from("assets")
        .select("id, name, asset_id")
        .order("name")
      if (assetsError) {
        console.error("Error fetching assets:", assetsError)
        fetchError = true;
      } else setAssets(assetsData || [])

      const { data: techniciansData, error: techniciansError } = await supabase
        .from("profiles")
        .select("*")
        .order("nombre") 
      if (techniciansError) {
        console.error("Error fetching technicians:", techniciansError)
        fetchError = true;
      } else setTechnicians(techniciansData || [])
      
      const { data: checklistsData, error: checklistsError } = await supabase
        .from("checklists")
        .select("id, name")
        .order("name")
      if (checklistsError) {
        console.error("Error fetching checklists:", checklistsError)
        fetchError = true;
      } else setChecklists(checklistsData || [])
      
      if(fetchError) setError("Hubo un error al cargar datos iniciales. Intenta de nuevo.")
      setIsLoading(false)
    }
    fetchData()
  }, [supabase])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: id === 'estimated_duration' ? (value === '' ? null : Number(value)) : value }))
  }

  const handleSelectChange = (id: keyof UpdateWorkOrder, value: string | null) => {
    setFormData(prev => ({ ...prev, [id]: value }))
  }
  
  const handleRadioChange = (value: string) => {
    setFormData(prev => ({ ...prev, type: value as MaintenanceType }))
  }

  const handleDateChange = (date: Date | undefined) => {
    setPlannedDate(date)
    setFormData(prev => ({ ...prev, planned_date: date ? date.toISOString() : null }))
  }

  const handleAssetChange = (assetId: string | null) => {
    handleSelectChange('asset_id', assetId)
    if (!isFromChecklist) {
        setFormData(prev => ({ ...prev, checklist_id: null }));
    }
  }
  
  const handleChecklistToggle = (checked: boolean) => {
    setIsFromChecklist(checked)
    if (!checked) {
      setFormData(prev => ({ ...prev, checklist_id: null }))
    }
  }

  // Add function to handle adding a new part
  const handleAddPart = () => {
    if (!newPart.name) {
      setError("Por favor, ingresa el nombre del repuesto.");
      return;
    }
    
    // Calculate total price
    const totalPrice = newPart.quantity * newPart.unit_price;
    
    // Add new part to the list
    setRequiredParts([
      ...requiredParts,
      { 
        ...newPart, 
        id: crypto.randomUUID(),
        total_price: totalPrice
      }
    ]);
    
    // Reset new part form
    setNewPart({
      name: '',
      partNumber: '',
      part_id: undefined,
      quantity: 1,
      unit_price: 0,
      total_price: 0
    });
  };
  
  // Add function to handle removing a part
  const handleRemovePart = (partId: string) => {
    setRequiredParts(requiredParts.filter(part => part.id !== partId));
  };
  
  // Add function to handle changes to the new part form
  const handlePartInputChange = (field: keyof PurchaseOrderItem, value: string | number) => {
    setNewPart(prev => {
      const updated = { ...prev, [field]: value };
      
      // Recalculate total_price if quantity or unit_price changes
      if (field === 'quantity' || field === 'unit_price') {
        updated.total_price = updated.quantity * updated.unit_price;
      }
      
      return updated;
    });
  };

  // Handle part selection from autocomplete
  const handlePartSelect = (part: PartSuggestion | null) => {
    if (part) {
      setNewPart(prev => ({
        ...prev,
        name: part.name,
        partNumber: part.part_number,
        part_id: part.id,  // Save link to inventory catalog
        // Auto-fill unit price if available
        unit_price: part.default_unit_cost || prev.unit_price || 0,
        // Recalculate total
        total_price: (part.default_unit_cost || Number(prev.unit_price) || 0) * (Number(prev.quantity) || 1)
      }))
    } else {
      // Clear part info if selection cleared
      setNewPart(prev => ({
        ...prev,
        name: '',
        partNumber: '',
        part_id: undefined
      }))
    }
  }

  // Handle manual entry when part not in catalog
  const handleManualPartEntry = (text: string) => {
    // User is typing manually - update the name field
    setNewPart(prev => ({
      ...prev,
      name: text,
      // Keep partNumber if it was already set, otherwise clear it
      partNumber: prev.partNumber || '',
      // Clear part_id for manual entries (not from catalog)
      part_id: undefined
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!formData.asset_id) {
        setError("Por favor, selecciona un activo.");
        setIsLoading(false);
        return;
    }
    if (!formData.description || formData.description.trim() === "") {
        setError("Por favor, ingresa una descripción para la orden de trabajo.");
        setIsLoading(false);
        return;
    }
    if (!formData.type) {
        setError("Por favor, selecciona un tipo de orden de trabajo.");
        setIsLoading(false);
        return;
    }

    try {
      const updateData = {
        ...formData,
        required_parts: requiredParts.length > 0 ? JSON.parse(JSON.stringify(requiredParts)) : null,
        estimated_cost: requiredParts.reduce((total, part) => total + part.total_price, 0).toString(),
        creation_photos: creationEvidence.length > 0 ? creationEvidence.map(evidence => ({
          url: evidence.url,
          description: evidence.description,
          category: evidence.category,
          uploaded_at: evidence.uploaded_at,
          bucket_path: evidence.bucket_path
        })) : null
      };
      
      console.log("Updating work order:", updateData);
      
      const { data, error } = await supabase
        .from("work_orders")
        .update(updateData)
        .eq("id", workOrder.id)
        .select()
        .single();
        
      if (error) throw error;
      
      console.log("Work order updated successfully:", data);
      
      toast({
        title: "Orden actualizada",
        description: "La orden de trabajo ha sido actualizada exitosamente.",
      });
      
      router.push(`/ordenes/${workOrder.id}`);
    } catch (error: any) {
      console.error("Error updating work order:", error);
      setError(`Error al actualizar la orden de trabajo: ${error.message || 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading && assets.length === 0 && technicians.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-4 text-lg text-muted-foreground">Cargando formulario...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/ordenes/${workOrder.id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Editar Orden de Trabajo: {workOrder.order_id}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 pb-16">
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
            <CardDescription>Edita la información básica de la orden de trabajo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workOrderType">Tipo de Orden de Trabajo</Label>
                <RadioGroup
                  value={formData.type || MaintenanceType.Preventive}
                  onValueChange={handleRadioChange}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={MaintenanceType.Preventive} id="preventive" />
                    <Label htmlFor="preventive">Mantenimiento Preventivo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={MaintenanceType.Corrective} id="corrective" />
                    <Label htmlFor="corrective">Mantenimiento Correctivo</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Prioridad</Label>
                <Select 
                  value={formData.priority || ServiceOrderPriority.Medium} 
                  onValueChange={(value) => handleSelectChange('priority', value as ServiceOrderPriority)}
                >
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Seleccionar prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ServiceOrderPriority.Low}>Baja</SelectItem>
                    <SelectItem value={ServiceOrderPriority.Medium}>Media</SelectItem>
                    <SelectItem value={ServiceOrderPriority.High}>Alta</SelectItem>
                    <SelectItem value={ServiceOrderPriority.Critical}>Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción / Título <span className="text-red-500">*</span></Label>
              <Textarea 
                id="description" 
                placeholder="Describa el trabajo a realizar o ingrese un título descriptivo" 
                rows={3} 
                value={formData.description || ""}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="asset_id">Activo <span className="text-red-500">*</span></Label>
                <Select 
                  value={formData.asset_id || "none"} 
                  onValueChange={(value) => handleAssetChange(value === "none" ? null : value)}
                  name="asset_id"
                  required
                >
                  <SelectTrigger id="asset_id">
                    <SelectValue placeholder="Seleccionar activo" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name} ({asset.asset_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="planned_date">Fecha Programada</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn("w-full justify-start text-left font-normal", !plannedDate && "text-muted-foreground")}
                      id="planned_date_button"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {plannedDate ? format(plannedDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={plannedDate} onSelect={handleDateChange} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asignación y Recursos</CardTitle>
            <CardDescription>Edita responsables y recursos para la orden de trabajo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Técnico Responsable</Label>
                <Select 
                  value={formData.assigned_to || "none"}
                  onValueChange={(value) => handleSelectChange('assigned_to', value === "none" ? null : value)}
                >
                  <SelectTrigger id="assigned_to">
                    <SelectValue placeholder="Seleccionar técnico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No asignar</SelectItem> 
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.nombre && tech.apellido ? `${tech.nombre} ${tech.apellido}` : tech.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated_duration">Duración Estimada (horas)</Label>
                <Input 
                  id="estimated_duration" 
                  type="number" 
                  min="0" 
                  step="0.5" 
                  value={formData.estimated_duration === null ? "" : formData.estimated_duration}
                  onChange={handleInputChange} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select 
                value={formData.status || WorkOrderStatus.Pending} 
                onValueChange={(value) => handleSelectChange('status', value as WorkOrderStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={WorkOrderStatus.Pending}>Pendiente</SelectItem>
                  <SelectItem value={WorkOrderStatus.Quoted}>Cotizada</SelectItem>
                  <SelectItem value={WorkOrderStatus.Approved}>Aprobada</SelectItem>
                  <SelectItem value={WorkOrderStatus.InProgress}>En ejecución</SelectItem>
                  <SelectItem value={WorkOrderStatus.Completed}>Completada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 pt-4 border-t mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fromChecklistCheckbox"
                  checked={isFromChecklist}
                  onCheckedChange={(checked) => handleChecklistToggle(checked as boolean)}
                />
                <Label htmlFor="fromChecklistCheckbox">Asociado a un checklist</Label>
              </div>

              {isFromChecklist && (
                <div className="space-y-2">
                  <Label htmlFor="checklist_id">Checklist</Label>
                  <Select 
                      value={formData.checklist_id || "none"}
                      onValueChange={(value) => handleSelectChange('checklist_id', value === "none" ? null : value)}
                      disabled={!isFromChecklist || checklists.length === 0}
                  >
                    <SelectTrigger id="checklist_id">
                      <SelectValue placeholder={checklists.length === 0 ? "No hay checklists disponibles" : "Seleccionar checklist"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Remover checklist</SelectItem>
                      {checklists.map((checklist) => (
                        <SelectItem key={checklist.id} value={checklist.id}>
                          {checklist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parts Required Card */}
        <Card>
          <CardHeader>
            <CardTitle>Repuestos Requeridos</CardTitle>
            <CardDescription>Edita los repuestos necesarios para esta orden de trabajo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partName">Buscar Parte del Catálogo</Label>
                <PartAutocomplete
                  value={newPart.name || ""}
                  onSelect={handlePartSelect}
                  onManualEntry={handleManualPartEntry}
                  placeholder="Buscar por nombre o número de parte..."
                  showPartNumber={true}
                  allowManualEntry={true}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Busca en el catálogo de inventario o escribe manualmente
                </p>
              </div>
          <div className="hidden">
                <Label htmlFor="partNumber">Número de Parte</Label>
                <Input 
                  id="partNumber" 
                  placeholder="Ej: FIL-123" 
                  value={newPart.partNumber || ''}
                  onChange={(e) => handlePartInputChange('partNumber', e.target.value)} 
                />
          </div>
            <div className="space-y-2">
                <Label htmlFor="quantity">Cantidad</Label>
                <Input 
                  id="quantity" 
                  type="number" 
                  min="1" 
                  value={newPart.quantity}
                  onChange={(e) => handlePartInputChange('quantity', parseInt(e.target.value) || 1)} 
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="unitPrice">Precio Unitario</Label>
                <Input 
                  id="unitPrice" 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={newPart.unit_price}
                  onChange={(e) => handlePartInputChange('unit_price', parseFloat(e.target.value) || 0)} 
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                type="button" 
                onClick={handleAddPart}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-2" /> Agregar Repuesto
              </Button>
            </div>

            {requiredParts.length > 0 && (
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Número de Parte</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead className="text-right">Precio Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requiredParts.map((part) => (
                      <TableRow key={part.id}>
                        <TableCell>{part.name}</TableCell>
                        <TableCell>{part.partNumber || 'N/A'}</TableCell>
                        <TableCell>{part.quantity}</TableCell>
                        <TableCell className="text-right">${part.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${part.total_price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleRemovePart(part.id!)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-medium">Total Estimado:</TableCell>
                      <TableCell className="text-right font-bold">
                        ${requiredParts.reduce((total, part) => total + part.total_price, 0).toFixed(2)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evidence Section */}
        <Card>
          <CardHeader>
            <CardTitle>Evidencia de Creación</CardTitle>
            <CardDescription>
              Modifica las fotografías que documentan el estado inicial del equipo y el problema identificado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Incluya fotos del problema, estado del equipo, herramientas necesarias, etc.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEvidenceDialog(true)}
                className="flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Gestionar Evidencia
              </Button>
            </div>

            {creationEvidence.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {creationEvidence.map((evidence) => (
                  <Card key={evidence.id} className="overflow-hidden">
                    <div className="aspect-video relative bg-muted">
                      {evidence.url.includes('image') || evidence.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                        <img
                          src={evidence.url}
                          alt={evidence.description}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <Badge 
                        variant="secondary" 
                        className="absolute top-2 left-2 text-xs"
                      >
                        {evidence.category}
                      </Badge>
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate">
                        {evidence.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(evidence.uploaded_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {creationEvidence.length === 0 && (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No hay evidencia de creación
                </p>
                <p className="text-xs text-muted-foreground">
                  Opcional: Agregue fotos para documentar el estado inicial
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-500 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </CardContent>
          </Card>
        )}

        <EvidenceUpload
          open={showEvidenceDialog}
          onOpenChange={setShowEvidenceDialog}
          evidence={creationEvidence}
          setEvidence={setCreationEvidence}
          context="creation"
          workOrderId={workOrder.id}
          assetId={formData.asset_id || undefined}
          title="Evidencia de Creación"
          description="Suba fotografías del problema identificado, estado del equipo y cualquier documentación relevante"
        />

        <CardFooter className="flex justify-end space-x-2 fixed bottom-0 right-0 w-full bg-background p-4 border-t md:relative md:bg-transparent md:p-0 md:border-none">
          <Button type="button" variant="outline" asChild disabled={isLoading}>
            <Link href={`/ordenes/${workOrder.id}`}>Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Guardando..." : <><Save className="mr-2 h-4 w-4" /> Guardar Cambios</>}
          </Button>
        </CardFooter>
      </form>
    </div>
  )
} 