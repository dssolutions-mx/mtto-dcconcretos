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
import { CalendarIcon, Save, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { InsertWorkOrder, MaintenanceType, ServiceOrderPriority, WorkOrderStatus, Profile, PurchaseOrderItem } from "@/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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

export function WorkOrderForm() {
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState<Partial<InsertWorkOrder>>({
    type: MaintenanceType.Preventive,
    priority: ServiceOrderPriority.Medium,
    status: WorkOrderStatus.Pending,
    estimated_duration: 2,
  })
  
  const [assets, setAssets] = useState<AssetForSelect[]>([])
  const [technicians, setTechnicians] = useState<Profile[]>([])
  const [checklists, setChecklists] = useState<ChecklistForSelect[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)

  const [plannedDate, setPlannedDate] = useState<Date | undefined>()
  const [isFromChecklist, setIsFromChecklist] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add state for parts
  const [requiredParts, setRequiredParts] = useState<PurchaseOrderItem[]>([])
  const [newPart, setNewPart] = useState<PurchaseOrderItem>({
    name: '',
    partNumber: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0
  })

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      let fetchError = false;
      
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
          setFormData(prev => ({ ...prev, requested_by: profile.id }))
        }
      } else {
        console.log("No active user session")
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

  const handleSelectChange = (id: keyof InsertWorkOrder, value: string | null) => {
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
    if (!currentUser?.id && !formData.requested_by) {
        setError("No se pudo identificar al solicitante. Por favor, recarga la página.");
        setIsLoading(false);
        return;
    }

    try {
      const requestedBy = formData.requested_by || currentUser?.id;
      let data;
      let error;

      // If coming from a checklist, use the function to generate a corrective work order
      if (isFromChecklist && formData.checklist_id) {
        // Call the generate_corrective_work_order function
        const { data: result, error: functionError } = await supabase
          .rpc('generate_corrective_work_order', {
            p_checklist_id: formData.checklist_id
          });
          
        data = result;
        error = functionError;
        
        if (functionError) {
          console.error("Error executing generate_corrective_work_order:", functionError);
          throw functionError;
        }
        
        // If successful, get the created work order
        if (result) {
          const { data: workOrderData, error: fetchError } = await supabase
            .from("work_orders")
            .select()
            .eq("id", result)
            .single();
            
          if (fetchError) throw fetchError;
          data = workOrderData;
        }
      } 
      // If it's a preventive work order and we have a maintenance plan in the future,
      // we would use generate_preventive_work_order here
      // For now, we'll use direct insert with our trigger for ID generation
      else {
        const workOrderData = {
          asset_id: formData.asset_id,
          description: formData.description,
          type: formData.type,
          requested_by: requestedBy,
          assigned_to: formData.assigned_to,
          planned_date: formData.planned_date || null,
          estimated_duration: formData.estimated_duration ? Number(formData.estimated_duration) : null,
          priority: formData.priority || ServiceOrderPriority.Medium,
          status: WorkOrderStatus.Pending,
          checklist_id: formData.checklist_id || null,
          required_parts: requiredParts.length > 0 ? JSON.parse(JSON.stringify(requiredParts)) : null, // Convert to JSON
          estimated_cost: requiredParts.reduce((total, part) => total + part.total_price, 0).toString() // Calculate estimated cost
        };
        
        console.log("Submitting work order:", workOrderData);
        
        // Insert the work order - this will use our trigger for ID generation
        const result = await supabase
          .from("work_orders")
          .insert(workOrderData)
          .select()
          .single();
          
        data = result.data;
        error = result.error;
      }
        
      if (error) throw error;
      
      // After saving successfully, check if we need to generate a purchase order
      if (data && formData.type === MaintenanceType.Preventive && requiredParts.length > 0) {
        // In the future, we'll implement automatic purchase order generation
        console.log("Would generate purchase order for preventive maintenance with parts:", requiredParts);
      }
      
      console.log("Work order created successfully:", data);
      router.push("/ordenes");
    } catch (error: any) {
      console.error("Error creating work order:", error);
      setError(`Error al crear la orden de trabajo: ${error.message || 'Error desconocido'}`);
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
    <form onSubmit={handleSubmit} className="space-y-6 pb-16">
      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
          <CardDescription>Ingresa la información básica para la orden de trabajo</CardDescription>
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
          <CardDescription>Asigna responsables y recursos para la orden de trabajo</CardDescription>
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

          <div className="space-y-4 pt-4 border-t mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fromChecklistCheckbox"
                checked={isFromChecklist}
                onCheckedChange={(checked) => handleChecklistToggle(checked as boolean)}
              />
              <Label htmlFor="fromChecklistCheckbox">Generar a partir de un checklist</Label>
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

      {/* Add new Parts Required Card */}
      <Card>
        <CardHeader>
          <CardTitle>Repuestos Requeridos</CardTitle>
          <CardDescription>Agrega los repuestos necesarios para esta orden de trabajo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="partName">Nombre del Repuesto</Label>
              <Input 
                id="partName" 
                placeholder="Ej: Filtro de aceite" 
                value={newPart.name}
                onChange={(e) => handlePartInputChange('name', e.target.value)}
              />
            </div>
          <div className="space-y-2">
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

      {error && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </CardContent>
        </Card>
      )}

      <CardFooter className="flex justify-end space-x-2 fixed bottom-0 right-0 w-full bg-background p-4 border-t md:relative md:bg-transparent md:p-0 md:border-none">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>Cancelar</Button>
        <Button type="submit" disabled={isLoading || (isLoading && assets.length === 0 && technicians.length === 0)}>
          {isLoading ? "Guardando..." : <><Save className="mr-2 h-4 w-4" /> Guardar Orden de Trabajo</>}
        </Button>
      </CardFooter>
    </form>
  )
}

