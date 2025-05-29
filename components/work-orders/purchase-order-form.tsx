"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Save, ShoppingCart, Loader2, FileText, X, Trash, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  WorkOrder, 
  WorkOrderWithAsset, 
  PurchaseOrderItem, 
  PurchaseOrderStatus, 
  InsertPurchaseOrder,
  Asset,
  Profile
} from "@/types"

export interface PurchaseOrderFormProps {
  workOrderId: string;
}

export function PurchaseOrderForm({ workOrderId }: PurchaseOrderFormProps) {
  const router = useRouter();
  const supabase = createClient();
  
  const [workOrder, setWorkOrder] = useState<WorkOrderWithAsset | null>(null);
  const [parts, setParts] = useState<PurchaseOrderItem[]>([]);
  const [recentSuppliers, setRecentSuppliers] = useState<string[]>([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  
  const [formData, setFormData] = useState<Partial<InsertPurchaseOrder>>({
    work_order_id: workOrderId,
    supplier: "",
    status: PurchaseOrderStatus.Pending
  });

  const [quotationFile, setQuotationFile] = useState<File | null>(null);
  const [quotationUrl, setQuotationUrl] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [newPart, setNewPart] = useState<Partial<PurchaseOrderItem>>({
    name: '',
    partNumber: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0
  });
  
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load work order data and recent suppliers
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
            
          if (profileError) {
            console.error("Error fetching user profile:", profileError);
          } else if (profile) {
            setCurrentUser(profile);
            setFormData(prev => ({ ...prev, requested_by: profile.id }));
          }
        }
        
        // Get recent suppliers from existing purchase orders
        const { data: supplierData, error: supplierError } = await supabase
          .from("purchase_orders")
          .select("supplier")
          .not("supplier", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);
          
        if (!supplierError && supplierData) {
          // Get unique suppliers from recent orders
          const uniqueSuppliers = Array.from(
            new Set(supplierData
              .map(item => item.supplier)
              .filter(supplier => supplier && supplier.trim() !== "")
            )
          ) as string[];
          setRecentSuppliers(uniqueSuppliers.slice(0, 10)); // Keep top 10
        }
        
        // Get work order with asset
        const { data: workOrderData, error: workOrderError } = await supabase
          .from("work_orders")
          .select(`
            *,
            asset:assets (*)
          `)
          .eq("id", workOrderId)
          .single();
          
        if (workOrderError) {
          setError("Error al cargar la orden de trabajo");
          console.error("Error fetching work order:", workOrderError);
          return;
        }
        
        if (!workOrderData) {
          setError("Orden de trabajo no encontrada");
          return;
        }
        
        setWorkOrder(workOrderData as WorkOrderWithAsset);
        
        // Extract required parts from work order
        let partsToLoad: PurchaseOrderItem[] = [];
        
        if (workOrderData.required_parts) {
          // Parse required parts if it's a string
          const partsData = typeof workOrderData.required_parts === 'string' 
            ? JSON.parse(workOrderData.required_parts) 
            : workOrderData.required_parts;
            
          partsToLoad = partsData as PurchaseOrderItem[];
        }
        
        // If still no parts but has estimated cost, create generic entry
        if (partsToLoad.length === 0 && workOrderData.estimated_cost && Number(workOrderData.estimated_cost) > 0) {
          partsToLoad = [{
            id: 'estimated-cost',
            name: 'Materiales y repuestos',
            partNumber: '',
            quantity: 1,
            unit_price: Number(workOrderData.estimated_cost),
            total_price: Number(workOrderData.estimated_cost),
            supplier: ''
          }];
        }
        
        setParts(partsToLoad);
        
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Error al cargar los datos necesarios");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [supabase, workOrderId]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSupplierChange = (value: string) => {
    setFormData(prev => ({ ...prev, supplier: value }));
    
    // Show suggestions if there's text and we have recent suppliers
    if (value.trim() && recentSuppliers.length > 0) {
      const filtered = recentSuppliers.filter(supplier => 
        supplier.toLowerCase().includes(value.toLowerCase())
      );
      setSupplierSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSupplierSuggestions(recentSuppliers);
      setShowSuggestions(value.trim() === "" && recentSuppliers.length > 0);
    }
  };

  const selectSupplier = (supplier: string) => {
    setFormData(prev => ({ ...prev, supplier }));
    setShowSuggestions(false);
  };
  
  const handleDeliveryDateChange = (date: Date | undefined) => {
    setExpectedDeliveryDate(date);
    setFormData(prev => ({ 
      ...prev, 
      expected_delivery_date: date ? date.toISOString() : null 
    }));
  };

  const handleQuotationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setQuotationFile(file);
    
    // Preview upload
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Just for UI preview
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePartChange = (index: number, field: string, value: any) => {
    const updatedParts = [...parts];
    updatedParts[index] = {
      ...updatedParts[index],
      [field]: value
    };
    
    // Recalculate total price if quantity or unit price changes
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = field === 'quantity' ? value : updatedParts[index].quantity;
      const unitPrice = field === 'unit_price' ? value : updatedParts[index].unit_price;
      updatedParts[index].total_price = quantity * unitPrice;
    }
    
    setParts(updatedParts);
  };

  const handleNewPartChange = (field: string, value: any) => {
    setNewPart(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate total price
      if (field === 'quantity' || field === 'unit_price') {
        const quantity = field === 'quantity' ? value : prev.quantity || 0;
        const unitPrice = field === 'unit_price' ? value : prev.unit_price || 0;
        updated.total_price = quantity * unitPrice;
      }
      
      return updated;
    });
  };

  const addNewPart = () => {
    if (!newPart.name || !newPart.quantity || !newPart.unit_price) {
      setError("Todos los campos del nuevo repuesto son requeridos");
      return;
    }
    
    setParts([...parts, {
      id: `new-${Date.now()}`,
      name: newPart.name || '',
      partNumber: newPart.partNumber || '',
      quantity: Number(newPart.quantity) || 0,
      unit_price: Number(newPart.unit_price) || 0,
      total_price: Number(newPart.total_price) || 0
    }]);
    
    // Reset form for new part
    setNewPart({
      name: '',
      partNumber: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0
    });
  };

  const removePart = (index: number) => {
    const updatedParts = [...parts];
    updatedParts.splice(index, 1);
    setParts(updatedParts);
  };
  
  const calculateTotal = () => {
    return parts.reduce((total, part) => total + (part.total_price || 0), 0);
  };
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    
    if (!formData.supplier || formData.supplier.trim() === "") {
      setError("Por favor, ingresa el nombre del proveedor");
      setIsSaving(false);
      return;
    }
    
    if (!formData.expected_delivery_date) {
      setError("Por favor, selecciona una fecha de entrega esperada");
      setIsSaving(false);
      return;
    }
    
    if (parts.length === 0) {
      setError("No hay repuestos para incluir en la orden de compra");
      setIsSaving(false);
      return;
    }
    
    const totalAmount = calculateTotal().toFixed(2);
    
    try {
      // If there's a quotation file, upload it first
      let quotationFileUrl = null;
      if (quotationFile) {
        const fileName = `quotations/${workOrderId}/${Date.now()}_${quotationFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, quotationFile, {
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError) {
          throw new Error(`Error al subir la cotización: ${uploadError.message}`);
        }
        
        // Get the public URL
        const { data: urlData } = await supabase.storage
          .from('documents')
          .getPublicUrl(fileName);
          
        quotationFileUrl = urlData?.publicUrl || null;
      }
      
      // Update work order with adjusted parts and prices
      const { error: updateWorkOrderError } = await supabase
        .from("work_orders")
        .update({ 
          required_parts: JSON.stringify(parts),
          estimated_cost: totalAmount,
          updated_at: new Date().toISOString()
        })
        .eq("id", workOrderId);
        
      if (updateWorkOrderError) {
        console.error("Error updating work order with new parts:", updateWorkOrderError);
      }
      
      // Use the SQL function to generate a purchase order
      const { data: poId, error: functionError } = await supabase.rpc(
        'generate_purchase_order',
        {
          p_work_order_id: workOrderId,
          p_supplier: formData.supplier?.trim() || "",
          p_items: parts,
          p_requested_by: formData.requested_by as any,
          p_expected_delivery_date: formData.expected_delivery_date || new Date().toISOString(),
          p_quotation_url: quotationFileUrl
        } as any
      );
      
      if (functionError) {
        console.error("Error generating purchase order:", functionError);
        throw new Error(functionError.message);
      }
      
      if (!poId) {
        throw new Error("No se recibió ID de la orden de compra");
      }
      
      // Redirect to the purchase order page
      router.push(`/compras/${poId}`);
      
    } catch (error: any) {
      console.error("Error creating purchase order:", error);
      setError(`Error al crear la orden de compra: ${error.message || 'Error desconocido'}`);
      setIsSaving(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3">Cargando datos de la orden de trabajo...</span>
      </div>
    );
  }
  
  if (!workOrder) {
    return (
      <div className="text-center p-6 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600">No se pudo cargar la orden de trabajo o no existe.</p>
        <Button onClick={() => router.back()} className="mt-4">Volver</Button>
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-16">
      <Card>
        <CardHeader>
          <CardTitle>Generar Orden de Compra</CardTitle>
          <CardDescription>
            Crea una orden de compra para los repuestos requeridos en la orden de trabajo {workOrder.order_id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Orden de Trabajo</Label>
              <div className="p-2 border rounded-md bg-muted/20">
                <p className="font-medium">{workOrder.order_id}</p>
                <p className="text-sm text-muted-foreground">{workOrder.description}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Activo</Label>
              <div className="p-2 border rounded-md bg-muted/20">
                <p className="font-medium">{workOrder.asset?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {workOrder.asset?.asset_id} - {workOrder.asset?.model_id}
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor</Label>
              <div className="relative">
                <Input
                  id="supplier"
                  placeholder="Ingresa el nombre del proveedor"
                  value={formData.supplier || ""}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  onFocus={() => {
                    if (recentSuppliers.length > 0) {
                      setSupplierSuggestions(recentSuppliers);
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding suggestions to allow for selection
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  required
                />
                {showSuggestions && supplierSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 text-xs text-gray-500 border-b">
                      Proveedores recientes:
                    </div>
                    {supplierSuggestions.map((supplier, index) => (
                      <button
                        key={index}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                        onClick={() => selectSupplier(supplier)}
                      >
                        {supplier}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Escribe el nombre del proveedor o selecciona uno de los recientes
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Fecha de Entrega Esperada</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn("w-full justify-start text-left font-normal", !expectedDeliveryDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expectedDeliveryDate ? format(expectedDeliveryDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={expectedDeliveryDate}
                    onSelect={handleDeliveryDateChange}
                    initialFocus
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <div className="flex justify-between items-center mb-4">
              <Label>Subir Cotización (PDF, JPG)</Label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleQuotationUpload}
                className="max-w-xs"
              />
            </div>

            {quotationFile && (
              <div className="p-2 border rounded-md bg-blue-50 flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-blue-500" />
                  <span className="text-sm">{quotationFile.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuotationFile(null)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          <div className="space-y-2 pt-4">
            <div className="flex justify-between items-center">
              <Label>Repuestos Requeridos</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? "Ver Lista" : "Editar Repuestos"}
              </Button>
            </div>

            {!editMode ? (
              <div>
                {parts.length === 0 ? (
                  <div className="text-center p-4 border border-dashed rounded-md">
                    <p className="text-muted-foreground">No hay repuestos definidos para esta orden de trabajo.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Número de Parte</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead className="text-right">Precio Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parts.map((part, index) => (
                        <TableRow key={part.id || index}>
                          <TableCell>{part.name}</TableCell>
                          <TableCell>{part.partNumber || 'N/A'}</TableCell>
                          <TableCell>{part.quantity}</TableCell>
                          <TableCell className="text-right">${part.unit_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right">${part.total_price.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-medium">Total Estimado:</TableCell>
                        <TableCell className="text-right font-bold">
                          ${calculateTotal().toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Número de Parte</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Precio Unit.</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parts.map((part, index) => (
                      <TableRow key={part.id || index}>
                        <TableCell>
                          <Input
                            value={part.name}
                            onChange={(e) => handlePartChange(index, 'name', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={part.partNumber || ''}
                            onChange={(e) => handlePartChange(index, 'partNumber', e.target.value)}
                            placeholder="N/A"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={part.quantity}
                            onChange={(e) => handlePartChange(index, 'quantity', Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={part.unit_price}
                            onChange={(e) => handlePartChange(index, 'unit_price', Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${part.total_price.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePart(index)}
                            className="h-8 w-8"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* New part form */}
                    <TableRow>
                      <TableCell>
                        <Input
                          placeholder="Nombre del repuesto"
                          value={newPart.name || ''}
                          onChange={(e) => handleNewPartChange('name', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Número de parte"
                          value={newPart.partNumber || ''}
                          onChange={(e) => handleNewPartChange('partNumber', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Cantidad"
                          value={newPart.quantity}
                          onChange={(e) => handleNewPartChange('quantity', Number(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Precio unit."
                          value={newPart.unit_price}
                          onChange={(e) => handleNewPartChange('unit_price', Number(e.target.value))}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${(newPart.total_price || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={addNewPart}
                          className="h-8 w-8"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-medium">Total Estimado:</TableCell>
                      <TableCell className="text-right font-bold">
                        ${calculateTotal().toFixed(2)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          
          <div className="space-y-2 pt-4">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea 
              id="notes" 
              placeholder="Escriba instrucciones o notas para el proveedor"
              value={formData.notes || ""}
              onChange={handleInputChange}
            />
          </div>
        </CardContent>
        
        {error && (
          <div className="mx-6 mb-4 p-3 border border-red-200 bg-red-50 rounded text-red-600 text-sm">
            {error}
          </div>
        )}
        
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving || parts.length === 0}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Generar Orden de Compra
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
} 