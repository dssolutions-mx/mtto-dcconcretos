import type { Metadata } from "next"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ServiceOrderDetails } from "@/components/work-orders/service-order-details"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase-server"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { notFound } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { 
  ArrowLeft, ShoppingCart, CalendarCheck, CheckCircle, Edit, Clock, 
  User, Wrench, Plus, CalendarDays, ChevronDown, Camera, FileText 
} from "lucide-react"
import { 
  MaintenanceType, 
  ServiceOrderPriority, 
  WorkOrderStatus, 
  WorkOrderComplete, 
  PurchaseOrder,
  Profile,
  MaintenanceHistory  
} from "@/types"
import { EvidenceViewer, type EvidenceItem } from "@/components/ui/evidence-viewer"
import { WorkOrderCostDisplay } from "@/components/work-orders/work-order-cost-display"

// Extended type for work order with completed_at field
interface ExtendedWorkOrder extends WorkOrderComplete {
  completed_at: string | null;
  creation_photos?: string | EvidenceItem[];
  completion_photos?: string | EvidenceItem[];
  progress_photos?: string | EvidenceItem[];
  incident_id?: string | null;
}

export const metadata: Metadata = {
  title: "Detalles de Orden de Servicio | Sistema de Gestión de Mantenimiento",
  description: "Detalles de la orden de servicio",
}

interface ServiceOrderPageProps {
  params: Promise<{
    id: string
  }>
}

// Helper function to get badge variant based on status
function getStatusVariant(status: string | null) {
  switch (status) {
    case WorkOrderStatus.Completed:
      return "default" 
    case WorkOrderStatus.InProgress:
      return "secondary" 
    case WorkOrderStatus.Pending:
    case WorkOrderStatus.Quoted:
      return "outline" 
    case WorkOrderStatus.Approved:
      return "outline" 
    default:
      return "outline"
  }
}

// Helper function to get badge variant based on priority
function getPriorityVariant(priority: string | null) {
  switch (priority) {
    case ServiceOrderPriority.Critical:
      return "destructive"
    case ServiceOrderPriority.High:
      return "secondary" 
    default:
      return "outline"
  }
}

// Helper function to get badge variant based on type
function getTypeVariant(type: string | null) {
  switch (type) {
    case MaintenanceType.Preventive:
      return "outline"
    case MaintenanceType.Corrective:
      return "destructive"
    default:
      return "secondary"
  }
}

// Helper function to determine if Generate Purchase Order button should be shown
function shouldShowGenerateOrderButton(workOrder: ExtendedWorkOrder): boolean {
  // Don't show if already has a purchase order
  if (workOrder.purchase_order_id) return false;
  
  // Show if work order has required parts (traditional flow)
  if (workOrder.required_parts && Array.isArray(workOrder.required_parts) && workOrder.required_parts.length > 0) return true;
  
  // Show if work order has estimated cost > 0 (from incidents with cost information)
  if (workOrder.estimated_cost && typeof workOrder.estimated_cost === 'number' && workOrder.estimated_cost > 0) return true;
  
  // Show for corrective orders (likely need parts/materials)
  if (workOrder.type === MaintenanceType.Corrective) return true;
  
  // Show for preventive maintenance that typically requires parts
  if (workOrder.type === MaintenanceType.Preventive) return true;
  
  return false;
}

export default async function WorkOrderDetailsPage({
  params,
}: ServiceOrderPageProps) {
  // Await params to get the id
  const { id } = await params;
  
  const supabase = await createClient();
  
  // Fetch work order with related data
  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      asset:assets (*),
      purchase_order:purchase_orders!work_orders_purchase_order_id_fkey (*)
    `)
    .eq("id", id)
    .single();
    
  // Fetch ALL purchase orders related to this work order (including adjustments)
  const { data: allPurchaseOrders } = await supabase
    .from("purchase_orders") 
    .select("*")
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });
    

    
  if (error || !workOrder) {
    notFound();
  }
  
  // Cast to our extended type to handle completed_at
  const extendedWorkOrder = workOrder as unknown as ExtendedWorkOrder;
  
  // Handle purchase_order whether it's a single object or array
  const purchaseOrder = Array.isArray(extendedWorkOrder.purchase_order) 
    ? extendedWorkOrder.purchase_order[0] 
    : extendedWorkOrder.purchase_order
  
  // Check if work order is completed
  const isCompleted = extendedWorkOrder.status === WorkOrderStatus.Completed
  
  // Fetch maintenance history if the work order is completed
  let maintenanceHistory = null
  if (isCompleted && extendedWorkOrder.asset?.id) {
    const { data: historyData } = await supabase
      .from("maintenance_history")
      .select("*")
      .eq("work_order_id", extendedWorkOrder.id)
      .eq("asset_id", extendedWorkOrder.asset.id)
      .single()
      
    if (historyData) {
      maintenanceHistory = historyData
    }
  }
  
  // Fetch technician and requester details
  const profiles: Record<string, Profile> = {}
  
  // Fetch requester profile if exists
  if (extendedWorkOrder.requested_by) {
    const { data: requester } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", extendedWorkOrder.requested_by)
      .single()
      
    if (requester) {
      profiles[extendedWorkOrder.requested_by] = requester
    }
  }
  
  // Fetch technician profile if exists
  if (extendedWorkOrder.assigned_to) {
    const { data: technician } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", extendedWorkOrder.assigned_to)
      .single()
      
    if (technician) {
      profiles[extendedWorkOrder.assigned_to] = technician
    }
  }
  
  // Format dates
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      return format(date, "PPP", { locale: es })
    } catch (error) {
      return dateString
    }
  }
  
  // Get name from profile
  const getProfileName = (profileId: string | null) => {
    if (!profileId) return "No asignado"
    const profile = profiles[profileId]
    if (!profile) return profileId
    return profile.nombre && profile.apellido 
      ? `${profile.nombre} ${profile.apellido}`
      : profile.nombre || profileId
  }
  
  // Parse required parts if exists
  const originalRequiredParts = extendedWorkOrder.required_parts 
    ? typeof extendedWorkOrder.required_parts === 'string'
      ? JSON.parse(extendedWorkOrder.required_parts)
      : extendedWorkOrder.required_parts
    : []
  
  // Use purchase order items if available, otherwise use original required parts
  let displayParts = originalRequiredParts;
  let partsSource = 'estimated';
  
  if (allPurchaseOrders && allPurchaseOrders.length > 0) {
    // Find the main purchase order (not adjustment)
    const mainPO = allPurchaseOrders.find(po => !po.is_adjustment);
    if (mainPO && mainPO.items) {
      const poItems = typeof mainPO.items === 'string' ? JSON.parse(mainPO.items) : mainPO.items;
      if (poItems && Array.isArray(poItems) && poItems.length > 0) {
        // Transform PO items to match our parts format
        displayParts = poItems.map((item: any) => ({
          name: item.name || item.description || item.item,
          partNumber: item.part_number || item.code || 'N/A',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || item.price || 0,
          total_price: item.total_price || (item.quantity * (item.unit_price || item.price || 0))
        }));
        partsSource = mainPO.actual_amount ? 'confirmed' : 'quoted';
      }
    }
  }
  
  // Use the display parts for calculations
  const requiredParts = displayParts;
  
  // Calculate total parts cost
  const totalPartsCost = requiredParts.length > 0
    ? requiredParts.reduce((total: number, part: any) => total + (part.total_price || 0), 0)
    : 0
    
  // Parse evidence photos
  const creationPhotos: EvidenceItem[] = extendedWorkOrder.creation_photos 
    ? typeof extendedWorkOrder.creation_photos === 'string'
      ? JSON.parse(extendedWorkOrder.creation_photos)
      : extendedWorkOrder.creation_photos
    : []
    
  const completionPhotos: EvidenceItem[] = extendedWorkOrder.completion_photos 
    ? typeof extendedWorkOrder.completion_photos === 'string'
      ? JSON.parse(extendedWorkOrder.completion_photos)
      : extendedWorkOrder.completion_photos
    : []
    
  const progressPhotos: EvidenceItem[] = extendedWorkOrder.progress_photos 
    ? typeof extendedWorkOrder.progress_photos === 'string'
      ? JSON.parse(extendedWorkOrder.progress_photos)
      : extendedWorkOrder.progress_photos
    : []
    
  const allEvidence = [...creationPhotos, ...progressPhotos, ...completionPhotos]
    
  // Fetch additional expenses if the work order is completed
  let additionalExpenses = [];
  let hasAdjustmentPO = false;
  
  if (workOrder && workOrder.status === WorkOrderStatus.Completed) {
    // Check for additional expenses
    const { data: expensesData } = await supabase
      .from("additional_expenses")
      .select("*, adjustment_po:purchase_orders(*)")
      .eq("work_order_id", id);
      
    if (expensesData && expensesData.length > 0) {
      additionalExpenses = expensesData;
      // Check if any expense has an adjustment PO already
      hasAdjustmentPO = expensesData.some(expense => expense.adjustment_po_id !== null);
    }
  }
  
  // Check for adjustment purchase orders
  const { data: adjustmentPOData } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("work_order_id", id)
    .eq("is_adjustment", true);
    
  if (adjustmentPOData && adjustmentPOData.length > 0) {
    hasAdjustmentPO = true;
  }
  
  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/ordenes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Orden de Trabajo: {extendedWorkOrder.order_id}</h1>
          <Badge variant={getStatusVariant(extendedWorkOrder.status)} className="ml-2 capitalize text-sm">
            {extendedWorkOrder.status || "Pendiente"}
          </Badge>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/ordenes/${id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
          
          {/* Purchase Order Logic */}
          {(() => {
            const hasPOId = !!extendedWorkOrder.purchase_order_id;
            const hasRelatedPOs = allPurchaseOrders && allPurchaseOrders.length > 0;
            const shouldShowGenerate = shouldShowGenerateOrderButton(extendedWorkOrder);
            
            // Show "Ver OC Existente" if there are any purchase orders
            if (hasPOId || hasRelatedPOs) {
              const targetPOId = extendedWorkOrder.purchase_order_id || allPurchaseOrders?.[0]?.id;
              return (
                <Button variant="outline" asChild>
                  <Link href={`/compras/${targetPOId}`}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Ver OC Existente
                  </Link>
                </Button>
              );
            }
            
            // Show "Generar OC" only if no POs exist and conditions are met
            if (!hasPOId && !hasRelatedPOs && shouldShowGenerate) {
              return (
                <Button asChild>
                  <Link href={`/ordenes/${id}/generar-oc`}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Generar OC
                  </Link>
                </Button>
              );
            }
            
            return null;
          })()}
          
          {extendedWorkOrder.status !== WorkOrderStatus.Completed && (
            <Button asChild>
              <Link href={`/ordenes/${id}/completar`}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Completar
              </Link>
            </Button>
          )}
        </div>
      </div>
      
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
              <CardDescription>Detalles básicos de la orden de trabajo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Tipo</p>
                  <div className="flex items-center">
                    <Badge variant={getTypeVariant(extendedWorkOrder.type)} className="capitalize mr-2">
                      {extendedWorkOrder.type || "N/A"}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Prioridad</p>
                  <div className="flex items-center">
                    <Badge variant={getPriorityVariant(extendedWorkOrder.priority)} className="capitalize mr-2">
                      {extendedWorkOrder.priority || "N/A"}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Descripción</p>
                <p className="text-base whitespace-pre-wrap">{extendedWorkOrder.description}</p>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Solicitado por</p>
                  <p className="flex items-center">
                    <User className="h-4 w-4 mr-2 text-muted-foreground" />
                    {getProfileName(extendedWorkOrder.requested_by)}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Técnico asignado</p>
                  <p className="flex items-center">
                    <Wrench className="h-4 w-4 mr-2 text-muted-foreground" />
                    {getProfileName(extendedWorkOrder.assigned_to)}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Fecha de creación</p>
                  <p className="flex items-center">
                    <CalendarCheck className="h-4 w-4 mr-2 text-muted-foreground" />
                    {formatDate(extendedWorkOrder.created_at)}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Fecha programada</p>
                  <p className="flex items-center">
                    <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                    {extendedWorkOrder.planned_date ? formatDate(extendedWorkOrder.planned_date) : "No planificada"}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Duración estimada</p>
                  <p className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                    {extendedWorkOrder.estimated_duration ? `${extendedWorkOrder.estimated_duration} horas` : "No especificada"}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <WorkOrderCostDisplay
                    estimatedCost={extendedWorkOrder.estimated_cost}
                    requiredPartsCost={totalPartsCost}
                    purchaseOrders={allPurchaseOrders || []}
                    workOrderId={id}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {requiredParts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Repuestos requeridos
                  <Badge variant={
                    partsSource === 'confirmed' ? 'default' : 
                    partsSource === 'quoted' ? 'secondary' : 'outline'
                  }>
                    {partsSource === 'confirmed' ? 'Confirmados' : 
                     partsSource === 'quoted' ? 'Cotizados' : 'Estimados'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {partsSource === 'confirmed' ? 'Repuestos confirmados con comprobantes de compra' :
                   partsSource === 'quoted' ? 'Repuestos cotizados por proveedor' :
                   'Materiales y repuestos estimados para esta orden'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Mobile/Compact View */}
                <div className="space-y-3 md:hidden">
                  {requiredParts.map((part: any, index: number) => (
                    <div key={part.id || index} className="border rounded-lg p-3 bg-gray-50/50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 pr-3">
                          <h4 className="font-medium text-sm leading-tight">{part.name}</h4>
                          {part.partNumber && part.partNumber !== 'N/A' && (
                            <p className="text-xs text-muted-foreground mt-1">#{part.partNumber}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">${part.total_price?.toFixed(2) || '0.00'}</p>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Cantidad: {part.quantity}</span>
                        <span>Unitario: ${part.unit_price?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Total row for mobile */}
                  <div className="border-t-2 pt-3 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-base">Total:</span>
                      <span className="font-bold text-lg">${totalPartsCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Desktop/Table View */}
                <div className="hidden md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-1 text-xs font-medium text-muted-foreground uppercase">Repuesto</th>
                          <th className="text-left py-2 px-1 text-xs font-medium text-muted-foreground uppercase">Parte #</th>
                          <th className="text-center py-2 px-1 text-xs font-medium text-muted-foreground uppercase">Cant.</th>
                          <th className="text-right py-2 px-1 text-xs font-medium text-muted-foreground uppercase">Unitario</th>
                          <th className="text-right py-2 px-1 text-xs font-medium text-muted-foreground uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {requiredParts.map((part: any, index: number) => (
                          <tr key={part.id || index} className="hover:bg-gray-50/50">
                            <td className="py-2 px-1">
                              <div className="text-sm font-medium leading-tight">{part.name}</div>
                            </td>
                            <td className="py-2 px-1">
                              <span className="text-xs text-muted-foreground font-mono">
                                {part.partNumber && part.partNumber !== 'N/A' ? part.partNumber : '—'}
                              </span>
                            </td>
                            <td className="py-2 px-1 text-center">
                              <span className="text-sm font-medium">{part.quantity}</span>
                            </td>
                            <td className="py-2 px-1 text-right">
                              <span className="text-sm">${part.unit_price?.toFixed(2) || '0.00'}</span>
                            </td>
                            <td className="py-2 px-1 text-right">
                              <span className="text-sm font-semibold">${part.total_price?.toFixed(2) || '0.00'}</span>
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-gray-200 bg-muted/20">
                          <td colSpan={4} className="py-3 px-1 text-right font-semibold">Total:</td>
                          <td className="py-3 px-1 text-right font-bold text-lg">
                            ${totalPartsCost.toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {(!extendedWorkOrder.purchase_order_id && (!allPurchaseOrders || allPurchaseOrders.length === 0)) && extendedWorkOrder.type === MaintenanceType.Preventive && (
                  <div className="mt-4">
                    <Button asChild>
                      <Link href={`/ordenes/${id}/generar-oc`}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Generar orden de compra
                      </Link>
                    </Button>
                  </div>
                )}
                
                {(extendedWorkOrder.purchase_order_id || (allPurchaseOrders && allPurchaseOrders.length > 0)) && (
                  <div className="mt-4">
                    <Button variant="outline" asChild>
                      <Link href={`/compras/${extendedWorkOrder.purchase_order_id || allPurchaseOrders?.[0]?.id}`}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Ver orden de compra relacionada
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Evidence Section */}
          {allEvidence.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Evidencia Fotográfica
                </CardTitle>
                <CardDescription>
                  Documentación visual del proceso de trabajo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {creationPhotos.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                        Evidencia de Creación ({creationPhotos.length})
                      </h4>
                      <EvidenceViewer 
                        evidence={creationPhotos} 
                        showCategories={true}
                        maxItems={6}
                      />
                    </div>
                  )}
                  
                  {progressPhotos.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                        Evidencia de Progreso ({progressPhotos.length})
                      </h4>
                      <EvidenceViewer 
                        evidence={progressPhotos} 
                        showCategories={true}
                        maxItems={6}
                      />
                    </div>
                  )}
                  
                  {completionPhotos.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                        Evidencia de Finalización ({completionPhotos.length})
                      </h4>
                      <EvidenceViewer 
                        evidence={completionPhotos} 
                        showCategories={true}
                        maxItems={6}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activo</CardTitle>
              <CardDescription>Información del equipo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {extendedWorkOrder.asset ? (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Nombre</p>
                    <p className="font-medium">{extendedWorkOrder.asset.name}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">ID</p>
                    <p>{extendedWorkOrder.asset.asset_id}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Ubicación</p>
                    <p>{extendedWorkOrder.asset.location || "No especificada"}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Horas Actuales</p>
                    <p>{extendedWorkOrder.asset.current_hours || "0"} hrs</p>
                  </div>
                  
                  <Button variant="outline" asChild className="w-full mt-2">
                    <Link href={`/activos/${extendedWorkOrder.asset.id}`}>
                      Ver detalle completo
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">No hay activo asignado</p>
              )}
            </CardContent>
          </Card>
          
          {purchaseOrder && (
            <Card>
              <CardHeader>
                <CardTitle>Orden de Compra</CardTitle>
                <CardDescription>OC relacionada a esta orden de trabajo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Número</p>
                  <p className="font-medium">{purchaseOrder.order_id}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Proveedor</p>
                  <p>{purchaseOrder.supplier}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Estado</p>
                  <Badge>{purchaseOrder.status}</Badge>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Monto</p>
                  <p className="font-medium">${purchaseOrder.total_amount}</p>
                </div>
                
                <Button variant="outline" asChild className="w-full mt-2">
                  <Link href={`/compras/${purchaseOrder.id}`}>
                    Ver orden de compra
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
          
          {/* Actions card */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {extendedWorkOrder.status !== WorkOrderStatus.Completed && (
                <Button asChild className="w-full">
                  <Link href={`/ordenes/${id}/completar`}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Completar OT
                  </Link>
                </Button>
              )}
              
              <Button variant="outline" asChild className="w-full">
                <Link href={`/ordenes/${id}/editar`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </Button>
              
              {/* Purchase Order Action Logic */}
              {(() => {
                const hasPOId = !!extendedWorkOrder.purchase_order_id;
                const hasRelatedPOs = allPurchaseOrders && allPurchaseOrders.length > 0;
                const hasRequiredParts = requiredParts.length > 0;
                
                // Show "Ver OC Existente" if there are any purchase orders
                if (hasPOId || hasRelatedPOs) {
                  const targetPOId = extendedWorkOrder.purchase_order_id || allPurchaseOrders?.[0]?.id;
                  return (
                    <Button variant="outline" asChild className="w-full">
                      <Link href={`/compras/${targetPOId}`}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Ver OC Existente
                      </Link>
                    </Button>
                  );
                }
                
                // Show "Generar OC" only if no POs exist and has required parts
                if (!hasPOId && !hasRelatedPOs && hasRequiredParts) {
                  return (
                    <Button variant="outline" asChild className="w-full">
                      <Link href={`/ordenes/${id}/generar-oc`}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Generar OC
                      </Link>
                    </Button>
                  );
                }
                
                return null;
              })()}
            </CardContent>
          </Card>
          
          {/* Completion information card - show if work order is completed */}
          {isCompleted && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Información de completado</CardTitle>
                <CardDescription>Detalles sobre el cierre de esta OT</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {extendedWorkOrder.completed_at && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Fecha de completado</p>
                    <p className="flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      {formatDate(extendedWorkOrder.completed_at as string)}
                    </p>
                  </div>
                )}
                
                {maintenanceHistory && (
                  <>
                    {maintenanceHistory.technician && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Técnico ejecutor</p>
                        <p>{maintenanceHistory.technician}</p>
                      </div>
                    )}
                    
                    {maintenanceHistory.actions && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Resolución</p>
                        <p className="text-sm">{maintenanceHistory.actions}</p>
                      </div>
                    )}
                    
                    {maintenanceHistory.findings && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Observaciones</p>
                        <p className="text-sm">{maintenanceHistory.findings}</p>
                      </div>
                    )}
                    
                    {maintenanceHistory.labor_hours && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Horas de trabajo</p>
                        <p>{maintenanceHistory.labor_hours} hrs</p>
                      </div>
                    )}
                    
                    {maintenanceHistory.total_cost && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Costo total</p>
                        <p className="font-medium">${maintenanceHistory.total_cost}</p>
                      </div>
                    )}
                    
                    {extendedWorkOrder.asset && (
                      <Button variant="outline" asChild className="w-full mt-4">
                        <Link href={`/activos/${extendedWorkOrder.asset.id}/historial`}>
                          Ver historial completo
                        </Link>
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Additional expenses section */}
          {workOrder.status === WorkOrderStatus.Completed && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2">Gastos Adicionales</h2>
              <div className="space-y-4">
                {additionalExpenses && additionalExpenses.length > 0 ? (
                  <>
                    {/* Mobile/Compact View */}
                    <div className="space-y-3 md:hidden">
                      {additionalExpenses.map((expense) => (
                        <div key={expense.id} className="border rounded-lg p-3 bg-gray-50/50">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 pr-3">
                              <h4 className="font-medium text-sm leading-tight">{expense.description}</h4>
                              <p className="text-xs text-muted-foreground mt-1">{expense.justification}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sm">${parseFloat(expense.amount).toFixed(2)}</p>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <Badge variant={
                              expense.status === "aprobado" ? "default" : 
                              expense.status === "rechazado" ? "destructive" : 
                              "outline"
                            } className="text-xs">
                              {expense.status === "pendiente_aprobacion" ? "Pendiente" : 
                               expense.status === "aprobado" ? "Aprobado" : 
                               expense.status === "rechazado" ? "Rechazado" : 
                               expense.status}
                            </Badge>
                            
                            <div className="flex gap-2">
                              {expense.adjustment_po_id && (
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/compras/${expense.adjustment_po_id}`} className="text-xs">
                                    Ver OC
                                  </Link>
                                </Button>
                              )}
                              
                              {!expense.adjustment_po_id && expense.status === "aprobado" && (
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/ordenes/${id}/generar-oc-ajuste`} className="text-xs">
                                    Generar OC
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop/Table View */}
                    <div className="hidden md:block">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-1 text-xs font-medium text-muted-foreground uppercase">Descripción</th>
                              <th className="text-right py-2 px-1 text-xs font-medium text-muted-foreground uppercase">Monto</th>
                              <th className="text-center py-2 px-1 text-xs font-medium text-muted-foreground uppercase">Estado</th>
                              <th className="text-center py-2 px-1 text-xs font-medium text-muted-foreground uppercase">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {additionalExpenses.map((expense) => (
                              <tr key={expense.id} className="hover:bg-gray-50/50">
                                <td className="py-2 px-1">
                                  <div className="text-sm font-medium leading-tight">{expense.description}</div>
                                  <div className="text-xs text-muted-foreground mt-1">{expense.justification}</div>
                                </td>
                                <td className="py-2 px-1 text-right">
                                  <span className="text-sm font-semibold">${parseFloat(expense.amount).toFixed(2)}</span>
                                </td>
                                <td className="py-2 px-1 text-center">
                                  <Badge variant={
                                    expense.status === "aprobado" ? "default" : 
                                    expense.status === "rechazado" ? "destructive" : 
                                    "outline"
                                  } className="text-xs">
                                    {expense.status === "pendiente_aprobacion" ? "Pendiente" : 
                                     expense.status === "aprobado" ? "Aprobado" : 
                                     expense.status === "rechazado" ? "Rechazado" : 
                                     expense.status}
                                  </Badge>
                                  
                                  {expense.adjustment_po_id && (
                                    <div className="mt-1">
                                      <Link href={`/compras/${expense.adjustment_po_id}`} className="text-xs hover:underline text-blue-600">
                                        OC de Ajuste
                                      </Link>
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-1 text-center">
                                  {!expense.adjustment_po_id && expense.status === "aprobado" && (
                                    <Button variant="outline" size="sm" asChild>
                                      <Link href={`/ordenes/${id}/generar-oc-ajuste`}>
                                        <ShoppingCart className="h-3 w-3 mr-1" />
                                        <span className="text-xs">Generar OC</span>
                                      </Link>
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {!hasAdjustmentPO && additionalExpenses.some(e => e.status === "aprobado" && !e.adjustment_po_id) && (
                      <div className="mt-4">
                        <Button variant="default" asChild>
                          <Link href={`/ordenes/${id}/generar-oc-ajuste`}>
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Generar OC para Gastos Adicionales
                          </Link>
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground italic">No hay gastos adicionales registrados para esta orden</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
