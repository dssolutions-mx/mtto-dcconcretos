"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { CalendarIcon, Save, Plus, Trash2, Camera, FileText, CheckCircle, Package, AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { InsertWorkOrder, MaintenanceType, ServiceOrderPriority, WorkOrderStatus, Profile, PurchaseOrderItem } from "@/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EvidenceUpload, type EvidencePhoto } from "@/components/ui/evidence-upload"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SupplierSuggestionPanel } from "./SupplierSuggestionPanel"
import { SupplierSuggestionPanelMobile } from "./SupplierSuggestionPanelMobile"
import { Supplier } from "@/types/suppliers"
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

export function WorkOrderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [formData, setFormData] = useState<Partial<InsertWorkOrder>>({
    type: MaintenanceType.Preventive,
    priority: ServiceOrderPriority.Medium,
    status: WorkOrderStatus.Pending,
    estimated_duration: 2,
  })

  // Supplier management
  const [assignedSupplier, setAssignedSupplier] = useState<Supplier | null>(null)
  const [supplierNotes, setSupplierNotes] = useState("")
  
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
    part_id: undefined,
    quantity: 1,
    unit_price: 0,
    total_price: 0
  })

  // Add state for inventory availability
  const [partsAvailability, setPartsAvailability] = useState<Map<string, {
    total_available: number
    sufficient: boolean
    available_by_warehouse: Array<{
      warehouse_id: string
      warehouse_name: string
      available_quantity: number
    }>
  }>>(new Map())
  const [checkingInventory, setCheckingInventory] = useState(false)
  const [selectedAssetPlantId, setSelectedAssetPlantId] = useState<string | null>(null)

  // Add state for evidence
  const [creationEvidence, setCreationEvidence] = useState<EvidencePhoto[]>([])
  const [showEvidenceDialog, setShowEvidenceDialog] = useState(false)

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
        .select("id, name, asset_id, plant_id")
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

  // Pre-select asset from URL parameters
  useEffect(() => {
    const assetIdParam = searchParams.get('assetId')
    if (assetIdParam && assets.length > 0) {
      // Check if the asset exists in our assets list
      const assetExists = assets.find(asset => asset.id === assetIdParam)
      if (assetExists) {
        setFormData(prev => ({ ...prev, asset_id: assetIdParam }))
        if (assetExists.plant_id) {
          setSelectedAssetPlantId(assetExists.plant_id)
        }
      }
    }
  }, [searchParams, assets])
  
  // Check inventory when asset changes (but not on every parts change to avoid infinite loops)
  useEffect(() => {
    if (selectedAssetPlantId && requiredParts.length > 0) {
      const partsWithIds = requiredParts.filter(p => p.part_id)
      if (partsWithIds.length > 0) {
        checkPartsInventory(partsWithIds, selectedAssetPlantId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssetPlantId])

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

  // Function to check inventory availability for parts
  const checkPartsInventory = async (parts: PurchaseOrderItem[], plantId: string) => {
    if (!plantId || parts.length === 0) return
    
    setCheckingInventory(true)
    const availabilityMap = new Map()
    
    try {
      // Check each part with part_id
      for (const part of parts) {
        if (part.part_id) {
          const response = await fetch(`/api/inventory/parts/${part.part_id}/availability?plant_id=${plantId}&quantity=${part.quantity}`)
          if (response.ok) {
            const data = await response.json()
            if (data.success) {
              availabilityMap.set(part.id, {
                total_available: data.total_available || 0,
                sufficient: data.sufficient || false,
                available_by_warehouse: data.available_by_warehouse || []
              })
            }
          }
        }
      }
      
      setPartsAvailability(availabilityMap)
    } catch (error) {
      console.error('Error checking inventory:', error)
    } finally {
      setCheckingInventory(false)
    }
  }

  const handleAssetChange = async (assetId: string | null) => {
    handleSelectChange('asset_id', assetId)
    if (!isFromChecklist) {
        setFormData(prev => ({ ...prev, checklist_id: null }));
    }
    
    // Fetch plant_id from asset
    if (assetId) {
      const { data: assetData } = await supabase
        .from('assets')
        .select('plant_id')
        .eq('id', assetId)
        .single()
      
      if (assetData?.plant_id) {
        setSelectedAssetPlantId(assetData.plant_id)
        // Check inventory for existing parts
        if (requiredParts.length > 0) {
          checkPartsInventory(requiredParts, assetData.plant_id)
        }
      } else {
        setSelectedAssetPlantId(null)
      }
    } else {
      setSelectedAssetPlantId(null)
    }
  }
  
  const handleChecklistToggle = (checked: boolean) => {
    setIsFromChecklist(checked)
    if (!checked) {
      setFormData(prev => ({ ...prev, checklist_id: null }))
    }
  }

  // Add function to handle adding a new part
  const handleAddPart = async () => {
    if (!newPart.name) {
      setError("Por favor, ingresa el nombre del repuesto.");
      return;
    }
    
    // Calculate total price
    const totalPrice = newPart.quantity * newPart.unit_price;
    
    const newPartWithId = {
      ...newPart,
      id: crypto.randomUUID(),
      total_price: totalPrice
    }
    
    // Transfer temporary availability to the new part's ID
    if (newPart.part_id) {
      const tempKey = `temp-${newPart.part_id}`
      const tempAvailability = partsAvailability.get(tempKey)
      if (tempAvailability) {
        setPartsAvailability(prev => {
          const newMap = new Map(prev)
          newMap.delete(tempKey) // Remove temp
          newMap.set(newPartWithId.id!, tempAvailability) // Set with part ID
          return newMap
        })
      } else if (selectedAssetPlantId) {
        // If no temp availability, check now
        await checkPartsInventory([newPartWithId], selectedAssetPlantId)
      }
    }
    
    // Add new part to the list
    const updatedParts = [...requiredParts, newPartWithId]
    setRequiredParts(updatedParts)
    
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
  const handlePartSelect = async (part: PartSuggestion | null) => {
    if (part) {
      // Use functional update to ensure we get the latest state
      setNewPart(prev => {
        const currentQuantity = prev.quantity || 1
        // Use default_unit_cost if available, otherwise keep existing price or 0
        // Convert to number and handle null/undefined cases
        const unitPrice = (part.default_unit_cost !== undefined && part.default_unit_cost !== null && part.default_unit_cost !== 0) 
          ? Number(part.default_unit_cost) 
          : (prev.unit_price || 0)
        const totalPrice = unitPrice * currentQuantity
        
        console.log('handlePartSelect - part:', part)
        console.log('handlePartSelect - default_unit_cost:', part.default_unit_cost)
        console.log('handlePartSelect - calculated unitPrice:', unitPrice)
        console.log('handlePartSelect - totalPrice:', totalPrice)
        
        const updated = {
          name: part.name,
          partNumber: part.part_number,
          part_id: part.id,  // Save link to inventory catalog
          quantity: currentQuantity,  // Keep existing quantity
          unit_price: unitPrice,  // Auto-fill unit price if available
          total_price: totalPrice
        }
        console.log('handlePartSelect - updated state:', updated)
        return updated
      })
      
      // Check inventory availability after state update (outside setState)
      if (selectedAssetPlantId && part.id) {
        // Capture quantity from current state
        const qtyToCheck = newPart.quantity || 1
        // Use setTimeout to ensure state is updated before checking
        setTimeout(async () => {
          try {
            const response = await fetch(`/api/inventory/parts/${part.id}/availability?plant_id=${selectedAssetPlantId}&quantity=${qtyToCheck}`)
            if (response.ok) {
              const data = await response.json()
              if (data.success) {
                // Store availability for this part (we'll use a temp key since part isn't added yet)
                const tempKey = `temp-${part.id}`
                setPartsAvailability(prev => {
                  const newMap = new Map(prev)
                  newMap.set(tempKey, {
                    total_available: data.total_available || 0,
                    sufficient: data.sufficient || false,
                    available_by_warehouse: data.available_by_warehouse || []
                  })
                  return newMap
                })
              }
            }
          } catch (error) {
            console.error('Error checking inventory for selected part:', error)
          }
        }, 100)
      }
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
          estimated_cost: requiredParts.reduce((total, part) => total + part.total_price, 0).toString(), // Calculate estimated cost
          creation_photos: creationEvidence.length > 0 ? creationEvidence.map(evidence => ({
            url: evidence.url,
            description: evidence.description,
            category: evidence.category,
            uploaded_at: evidence.uploaded_at,
            bucket_path: evidence.bucket_path
          })) : []
        };
        
        console.log("Submitting work order:", workOrderData);

        // Insert the work order - this will use our trigger for ID generation
        const { data: insertedWorkOrder, error: insertError } = await supabase
          .from("work_orders")
          .insert(workOrderData)
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        // If supplier is assigned, update the work order with supplier information
        if (assignedSupplier && insertedWorkOrder) {
          await supabase
            .from("work_orders")
            .update({
              assigned_supplier_id: assignedSupplier.id,
              supplier_notes: supplierNotes,
              supplier_assignment_date: new Date().toISOString(),
              supplier_assignment_by: currentUser?.id,
              updated_by: currentUser?.id
            })
            .eq('id', insertedWorkOrder.id)

          // Log the supplier assignment in work history
          await supabase
            .from('supplier_work_history')
            .insert({
              supplier_id: assignedSupplier.id,
              work_order_id: insertedWorkOrder.id,
              work_type: formData.type || 'maintenance',
              total_cost: 0, // Will be updated when work is completed
              created_at: new Date().toISOString()
            })
        }

        const result = insertedWorkOrder
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
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="partName">Buscar Parte del Catálogo</Label>
              <PartAutocomplete
                value={newPart.name || ""}
                onSelect={handlePartSelect}
                onManualEntry={handleManualPartEntry}
                placeholder="Buscar por nombre o número de parte..."
                showPartNumber={true}
                allowManualEntry={true}
              />
              <p className="text-xs text-muted-foreground">
                Busca en el catálogo de inventario o escribe manualmente
              </p>
              {/* Show inventory status for selected part before adding */}
              {newPart.part_id && selectedAssetPlantId && (() => {
                const tempKey = `temp-${newPart.part_id}`
                const availability = partsAvailability.get(tempKey)
                return availability ? (
                  <div className="mt-1">
                    {availability.sufficient ? (
                      <Badge variant="default" className="bg-green-500 text-xs">
                        <Package className="h-3 w-3 mr-1" />
                        Disponible ({availability.total_available} unidades)
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Insuficiente ({availability.total_available} disponibles)
                      </Badge>
                    )}
                  </div>
                ) : checkingInventory ? (
                  <Badge variant="outline" className="text-xs mt-1">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Verificando inventario...
                  </Badge>
                ) : null
              })()}
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
                value={newPart.unit_price || 0}
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
            <div className="mt-4 space-y-2">
              {requiredParts.some(p => {
                const avail = partsAvailability.get(p.id || '')
                return p.part_id && avail && !avail.sufficient
              }) && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    Algunos repuestos no tienen suficiente inventario. Necesitarás crear una Orden de Compra para obtenerlos.
                  </AlertDescription>
                </Alert>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Número de Parte</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Inventario</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requiredParts.map((part) => {
                    const availability = partsAvailability.get(part.id || '')
                    const hasPartId = !!part.part_id
                    const isChecking = checkingInventory && hasPartId && !availability
                    
                    return (
                      <TableRow key={part.id}>
                        <TableCell>{part.name}</TableCell>
                        <TableCell>{part.partNumber || 'N/A'}</TableCell>
                        <TableCell>{part.quantity}</TableCell>
                        <TableCell>
                          {!hasPartId ? (
                            <Badge variant="outline" className="text-xs">No en catálogo</Badge>
                          ) : isChecking ? (
                            <Badge variant="outline" className="text-xs">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Verificando...
                            </Badge>
                          ) : availability ? (
                            availability.sufficient ? (
                              <Badge variant="default" className="bg-green-500 text-xs">
                                <Package className="h-3 w-3 mr-1" />
                                Disponible ({availability.total_available})
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Insuficiente ({availability.total_available} disp.)
                              </Badge>
                            )
                          ) : selectedAssetPlantId ? (
                            <Badge variant="outline" className="text-xs">Sin verificar</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Selecciona activo</Badge>
                          )}
                        </TableCell>
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
                    )
                  })}
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
          <CardTitle>Evidencia Inicial</CardTitle>
          <CardDescription>
            Suba fotografías que documenten el estado inicial del equipo y el problema identificado
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
              Agregar Evidencia
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
                No se ha agregado evidencia inicial
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
        assetId={formData.asset_id || undefined}
        title="Evidencia Inicial"
        description="Suba fotografías del problema identificado, estado del equipo y cualquier documentación relevante"
      />

      {/* Supplier Suggestions - Only show when form has enough data and is not initial load */}
      {formData.asset_id && formData.description && formData.description.length > 10 && !isLoading && (
        <>
          <div className="hidden md:block">
            <SupplierSuggestionPanel
              workOrderId={formData.id}
              assetId={formData.asset_id}
              problemDescription={formData.description}
              urgency={formData.priority}
              onSupplierAssign={(supplier) => {
                setAssignedSupplier(supplier)
                setSupplierNotes(`Proveedor asignado automáticamente basado en recomendaciones del sistema`)
              }}
            />
          </div>
          <div className="md:hidden">
            <SupplierSuggestionPanelMobile
              workOrderId={formData.id}
              assetId={formData.asset_id}
              problemDescription={formData.description}
              urgency={formData.priority}
              onSupplierAssign={(supplier) => {
                setAssignedSupplier(supplier)
                setSupplierNotes(`Proveedor asignado automáticamente basado en recomendaciones del sistema`)
              }}
            />
          </div>
        </>
      )}

      {/* Assigned Supplier Display */}
      {assignedSupplier && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Proveedor Asignado
            </CardTitle>
            <CardDescription>
              Proveedor seleccionado para esta orden de trabajo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{assignedSupplier.name}</h4>
                  <Badge className="bg-green-50 text-green-700 border-green-200">
                    Asignado
                  </Badge>
                </div>
                {assignedSupplier.business_name && (
                  <p className="text-sm text-muted-foreground">
                    {assignedSupplier.business_name}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  {assignedSupplier.rating && (
                    <span>Calificación: {assignedSupplier.rating}/5</span>
                  )}
                  {assignedSupplier.reliability_score && (
                    <span>Confiabilidad: {assignedSupplier.reliability_score}%</span>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAssignedSupplier(null)
                  setSupplierNotes("")
                }}
              >
                Cambiar
              </Button>
            </div>

            {/* Supplier Notes */}
            <div className="mt-4 space-y-2">
              <Label htmlFor="supplier_notes">Notas del Proveedor</Label>
              <Textarea
                id="supplier_notes"
                placeholder="Notas sobre la selección del proveedor, consideraciones especiales, etc."
                value={supplierNotes}
                onChange={(e) => setSupplierNotes(e.target.value)}
                rows={2}
              />
            </div>
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

