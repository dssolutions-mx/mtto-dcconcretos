"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  FileText,
  ShoppingCart,
  Package,
  Receipt,
  Loader2,
  Info,
  Upload,
  File,
  ExternalLink,
  DollarSign,
  Shield,
  User
} from "lucide-react"
import { 
  PurchaseOrderType, 
  EnhancedPOStatus, 
  WorkflowStatusResponse 
} from "@/types/purchase-orders"
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { formatCurrency } from "@/lib/utils"

interface WorkflowStatusDisplayProps {
  purchaseOrderId: string
  poType: PurchaseOrderType
  currentStatus: string
  className?: string
  onStatusChange?: () => void
}

export function WorkflowStatusDisplay({ 
  purchaseOrderId, 
  poType, 
  currentStatus,
  className = "",
  onStatusChange
}: WorkflowStatusDisplayProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { profile, hasAuthorizationAccess, canAuthorizeAmount, refreshProfile } = useAuthZustand()
  const { 
    workflowStatus, 
    loadWorkflowStatus, 
    advanceWorkflow, 
    isLoadingWorkflow, 
    isUpdating,
    error 
  } = usePurchaseOrders()
  
  const [notes, setNotes] = useState("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [actualAmount, setActualAmount] = useState<string>("")
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [purchaseOrderAmount, setPurchaseOrderAmount] = useState<number>(0)
  const [effectiveAuthLimit, setEffectiveAuthLimit] = useState<number>(0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)


  // Load workflow status on mount and fetch existing receipt if any
  useEffect(() => {
    loadWorkflowStatus(purchaseOrderId)
    
    // Load purchase order basic data
    const loadPurchaseOrderData = async () => {
      try {
        // Load purchase order basic data
        const orderResponse = await fetch(`/api/purchase-orders/${purchaseOrderId}`)
        if (orderResponse.ok) {
          const orderData = await orderResponse.json()
          if (orderData.actual_amount) {
            setActualAmount(orderData.actual_amount.toString())
          }
          if (orderData.total_amount) {
            setPurchaseOrderAmount(parseFloat(orderData.total_amount))
          }
        }

        // Load receipts data separately
        const receiptsResponse = await fetch(`/api/purchase-orders/${purchaseOrderId}/receipts`)
        if (receiptsResponse.ok) {
          const receipts = await receiptsResponse.json()
          if (receipts.length > 0) {
            // Use the most recent receipt
            setReceiptUrl(receipts[0].file_url)
          }
        }
      } catch (error) {
        console.error('Error loading purchase order data:', error)
      }
    }
    
    loadPurchaseOrderData()
  }, [loadWorkflowStatus, purchaseOrderId])

  // Load effective authorization limit - same logic as compras page
  useEffect(() => {
    const loadEffectiveAuthorization = async () => {
      if (!profile?.id) return
      
      try {
        const response = await fetch('/api/authorization/summary')
        const data = await response.json()
        
        let userFound = false
        let authSummaryUser = null
        
        if (data.organization_summary) {
          for (const businessUnit of data.organization_summary) {
            for (const plant of businessUnit.plants) {
              const user = plant.users.find((u: any) => u.user_id === profile.id)
              if (user) {
                authSummaryUser = user
                setEffectiveAuthLimit(parseFloat(user.effective_global_authorization || 0))
                userFound = true
                break
              }
            }
            if (userFound) break
          }
        }
        
        if (!userFound) {
          setEffectiveAuthLimit(profile.can_authorize_up_to || 0)
        }

        // 🔄 AUTO-REFRESH: Detectar inconsistencias de rol y refrescar automáticamente
        if (authSummaryUser && authSummaryUser.role !== profile.role) {
          console.log('🔄 Inconsistencia de rol detectada en workflow:', {
            profileRole: profile.role,
            authSummaryRole: authSummaryUser.role,
            triggeringAutoRefresh: true
          })
          
          // Auto-refresh del perfil sin mostrar loading al usuario
          try {
            await refreshProfile()
            console.log('✅ Auto-refresh del perfil completado en workflow')
          } catch (error) {
            console.error('❌ Error en auto-refresh del perfil:', error)
          }
        }
      } catch (error) {
        console.error('Error loading effective authorization in workflow:', error)
        setEffectiveAuthLimit(profile.can_authorize_up_to || 0)
      } finally {
        setIsLoadingAuth(false)
      }
    }

    loadEffectiveAuthorization()
  }, [profile, refreshProfile])

  // Helper function to upload receipt file
  const uploadReceiptFile = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true)
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('purchaseOrderId', purchaseOrderId)
      
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error('Failed to upload file')
      }
      
      const result = await response.json()
      return result.url || result.publicUrl
      
    } catch (error) {
      console.error('Error uploading file:', error)
      return null
    } finally {
      setIsUploading(false)
    }
  }

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        alert('Solo se permiten archivos PDF, JPG, JPEG o PNG')
        return
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('El archivo no puede ser mayor a 10MB')
        return
      }
      
      setUploadedFile(file)
    }
  }

  // Helper function to get primary next action
  const getPrimaryNextAction = (currentStatus: string, allowedStatuses: string[], poType: PurchaseOrderType): string | null => {
    if (!allowedStatuses.length) return null

    // Define the logical progression for each type
    const progressionMap: Record<string, Record<string, string>> = {
      [PurchaseOrderType.DIRECT_PURCHASE]: {
        'pending_approval': 'approved',
        'approved': 'receipt_uploaded',
        'receipt_uploaded': 'validated'
      },
      [PurchaseOrderType.DIRECT_SERVICE]: {
        'pending_approval': 'approved',
        'approved': 'receipt_uploaded',
        'receipt_uploaded': 'validated'
      },
      [PurchaseOrderType.SPECIAL_ORDER]: {
        'quoted': 'pending_approval',
        'pending_approval': 'approved',
        'approved': 'ordered',
        'ordered': 'received',
        'received': 'invoiced'
      }
    }

    const expectedNext = progressionMap[poType]?.[currentStatus]
    
    // Return the expected next action if it's in allowed statuses
    if (expectedNext && allowedStatuses.includes(expectedNext)) {
      return expectedNext
    }
    
    // Otherwise return the first allowed status
    return allowedStatuses[0]
  }

  // Helper function to get action description
  const getWorkflowActionDescription = (currentStatus: string, poType: PurchaseOrderType): string => {
    const descriptions: Record<string, Record<string, string>> = {
      [PurchaseOrderType.DIRECT_PURCHASE]: {
        'pending_approval': 'Esta compra directa está esperando aprobación para proceder.',
        'approved': 'Compra aprobada. Puedes proceder a realizar la compra en la tienda especificada.',
        'receipt_uploaded': 'Comprobante subido. Esperando validación administrativa.',
        'validated': 'Proceso completado'
      },
      [PurchaseOrderType.DIRECT_SERVICE]: {
        'pending_approval': 'Este servicio directo está esperando aprobación para proceder.',
        'approved': 'Servicio aprobado. Puedes proceder a contratar el servicio con el proveedor especificado.',
        'receipt_uploaded': 'Comprobante del servicio subido. Esperando validación administrativa.',
        'validated': 'Proceso completado'
      },
      [PurchaseOrderType.SPECIAL_ORDER]: {
        'quoted': 'Cotización recibida. Envía a aprobación para proceder con el pedido.',
        'pending_approval': 'Pedido especial esperando aprobación.',
        'approved': 'Pedido aprobado. Realiza el pedido formal con el proveedor.',
        'ordered': 'Pedido realizado. Esperando recepción de productos/servicios.',
        'received': 'Productos/servicios recibidos. Sube el comprobante para completar.',
        'receipt_uploaded': 'Comprobante subido. Esperando validación administrativa.',
        'validated': 'Proceso completado'
      }
    }

    return descriptions[poType]?.[currentStatus] || 'Continúa con el siguiente paso del proceso.'
  }

  // Helper function to get action button text
  const getActionButtonText = (action: string, poType: PurchaseOrderType): string => {
    const buttonTexts: Record<string, Record<string, string>> = {
      [PurchaseOrderType.DIRECT_PURCHASE]: {
        'approved': 'Aprobar Compra',
        'receipt_uploaded': 'Subir Comprobante',
        'validated': 'Validar Comprobante',
        'rejected': 'Rechazar Compra'
      },
      [PurchaseOrderType.DIRECT_SERVICE]: {
        'approved': 'Aprobar Servicio', 
        'receipt_uploaded': 'Subir Comprobante de Servicio',
        'validated': 'Validar Comprobante de Servicio',
        'rejected': 'Rechazar Servicio'
      },
      [PurchaseOrderType.SPECIAL_ORDER]: {
        'pending_approval': 'Enviar a Aprobación',
        'approved': 'Aprobar Pedido',
        'ordered': 'Marcar como Pedida',
        'received': 'Marcar como Recibida',
        'receipt_uploaded': 'Subir Comprobante',
        'validated': 'Validar Comprobante',
        'rejected': 'Rechazar Pedido'
      }
    }

    return buttonTexts[poType]?.[action] || `Avanzar a ${action}`
  }

  // Helper function to get notes placeholder
  const getNotesPlaceholder = (action: string): string => {
    const placeholders: Record<string, string> = {
      'rejected': 'Explica la razón del rechazo...',
      'receipt_uploaded': 'Información del comprobante subido...'
    }

    return placeholders[action] || 'Agregar comentarios sobre esta acción...'
  }

  // Helper function to get action display information (not status)
  const getActionDisplayInfo = (action: string, poType: PurchaseOrderType) => {
    const actionInfo: Record<string, Record<string, { label: string; description: string; icon: any; color: string }>> = {
      [PurchaseOrderType.DIRECT_PURCHASE]: {
        'approved': {
          label: 'Aprobar Compra',
          description: 'Autorizar la compra directa para proceder',
          icon: CheckCircle,
          color: 'bg-green-100 text-green-700'
        },
        'receipt_uploaded': {
          label: 'Subir Comprobante',
          description: 'Cargar el comprobante de compra realizada',
          icon: Receipt,
          color: 'bg-purple-100 text-purple-700'
        },
        'validated': {
          label: 'Validar Comprobante',
          description: 'Revisar y validar el comprobante subido',
          icon: CheckCircle,
          color: 'bg-green-100 text-green-700'
        },
        'rejected': {
          label: 'Rechazar Compra',
          description: 'Rechazar la solicitud de compra directa',
          icon: AlertTriangle,
          color: 'bg-red-100 text-red-700'
        }
      },
      [PurchaseOrderType.DIRECT_SERVICE]: {
        'approved': {
          label: 'Aprobar Servicio',
          description: 'Autorizar la contratación del servicio directo',
          icon: CheckCircle,
          color: 'bg-green-100 text-green-700'
        },
        'receipt_uploaded': {
          label: 'Subir Comprobante de Servicio',
          description: 'Cargar el comprobante del servicio contratado',
          icon: Receipt,
          color: 'bg-purple-100 text-purple-700'
        },
        'validated': {
          label: 'Validar Comprobante de Servicio',
          description: 'Revisar y validar el comprobante del servicio',
          icon: CheckCircle,
          color: 'bg-green-100 text-green-700'
        },
        'rejected': {
          label: 'Rechazar Servicio',
          description: 'Rechazar la solicitud de servicio directo',
          icon: AlertTriangle,
          color: 'bg-red-100 text-red-700'
        }
      },
      [PurchaseOrderType.SPECIAL_ORDER]: {
        'pending_approval': {
          label: 'Enviar a Aprobación',
          description: 'Solicitar autorización para el pedido especial',
          icon: Clock,
          color: 'bg-yellow-100 text-yellow-700'
        },
        'approved': {
          label: 'Aprobar Pedido',
          description: 'Autorizar el pedido especial para proceder',
          icon: CheckCircle,
          color: 'bg-green-100 text-green-700'
        },
        'ordered': {
          label: 'Marcar como Pedida',
          description: 'Confirmar que el pedido fue enviado al proveedor',
          icon: ShoppingCart,
          color: 'bg-cyan-100 text-cyan-700'
        },
        'received': {
          label: 'Marcar como Recibida',
          description: 'Registrar la recepción de productos/servicios',
          icon: Package,
          color: 'bg-teal-100 text-teal-700'
        },
        'receipt_uploaded': {
          label: 'Subir Comprobante',
          description: 'Cargar el comprobante del pedido especial',
          icon: Receipt,
          color: 'bg-purple-100 text-purple-700'
        },
        'validated': {
          label: 'Validar Comprobante',
          description: 'Revisar y validar el comprobante subido',
          icon: CheckCircle,
          color: 'bg-green-100 text-green-700'
        },
        'rejected': {
          label: 'Rechazar Pedido',
          description: 'Rechazar la solicitud de pedido especial',
          icon: AlertTriangle,
          color: 'bg-red-100 text-red-700'
        }
      }
    }

    return actionInfo[poType]?.[action] || {
      label: `Realizar ${action}`,
      description: 'Continuar con el siguiente paso del proceso',
      icon: ArrowRight,
      color: 'bg-gray-100 text-gray-700'
    }
  }

  // Simplified advance handler with file upload and amount update integration
  const handleAdvanceWithUpload = async (newStatus: string) => {
    const requiresNotes = ['rejected', 'receipt_uploaded'].includes(newStatus)
    const requiresFile = newStatus === 'receipt_uploaded'
    
    // Validate required fields
    if (requiresNotes && !notes.trim()) {
      document.getElementById('action_notes')?.focus()
      return
    }
    
    if (requiresFile && !uploadedFile && !receiptUrl) {
      alert('Debes seleccionar un archivo para subir el comprobante')
      return
    }
    
    let fileUrl = receiptUrl // Use existing URL if available
    
    // Upload file if required and new file selected
    if (requiresFile && uploadedFile) {
      fileUrl = await uploadReceiptFile(uploadedFile)
      if (!fileUrl) {
        alert('Error al subir el archivo. Intenta de nuevo.')
        return
      }
    }
    
    // Update purchase order with actual amount and receipt URL if provided
    if (fileUrl || actualAmount) {
      try {
        const updateResponse = await fetch(`/api/purchase-orders/${purchaseOrderId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            receipt_url: fileUrl,
            actual_amount: actualAmount ? parseFloat(actualAmount) : undefined
          })
        })
        
        if (!updateResponse.ok) {
          console.error('Failed to update purchase order data')
        }
      } catch (error) {
        console.error('Error updating purchase order:', error)
      }
    }
    
    // Advance workflow
    let workflowNotes = notes.trim()
    if (actualAmount) {
      workflowNotes = workflowNotes 
        ? `${workflowNotes}\n\nMonto real: $${actualAmount}`
        : `Monto real: $${actualAmount}`
    }
    
    const success = await advanceWorkflow(purchaseOrderId, newStatus, workflowNotes || undefined)
    
    if (success) {
      setNotes("")
      setUploadedFile(null)
      // Reset file input
      const fileInput = document.getElementById('receipt_file') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      // Update receipt URL state
      if (fileUrl) setReceiptUrl(fileUrl)
      // Reload workflow status
      await loadWorkflowStatus(purchaseOrderId)
      if (onStatusChange) {
        onStatusChange()
      }
      router.refresh()
    }
  }

  // Handle payment date error specifically
  const handlePaymentDateError = async () => {
    try {
      // Try to fix the payment date automatically by setting it to 30 days from now
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/fix-payment-date`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_payment_date',
          new_max_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
      })
      
      if (response.ok) {
        toast({
          title: "Fecha de pago actualizada",
          description: "La fecha de pago ha sido actualizada automáticamente. Puedes continuar con la aprobación.",
        })
        // Reload workflow status
        await loadWorkflowStatus(purchaseOrderId)
        router.refresh()
      } else {
        const errorData = await response.json()
        toast({
          title: "Error al actualizar fecha de pago",
          description: errorData.details || "No se pudo actualizar la fecha de pago automáticamente.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fixing payment date:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar la fecha de pago automáticamente.",
        variant: "destructive"
      })
    }
  }

  // Status configurations by type
  const getStatusConfig = (status: string, type: PurchaseOrderType) => {
    interface StatusConfig {
      label: string
      color: string
      icon: any
      description: string
    }

    // Base configuration for common statuses
    const baseStatuses: Record<string, StatusConfig> = {
      [EnhancedPOStatus.DRAFT]: {
        label: "Borrador",
        color: "bg-gray-100 text-gray-700",
        icon: FileText,
        description: "Orden en proceso de creación"
      },
      [EnhancedPOStatus.PENDING_APPROVAL]: {
        label: "Pendiente Aprobación",
        color: "bg-yellow-100 text-yellow-700",
        icon: Clock,
        description: "Esperando autorización"
      },
      [EnhancedPOStatus.REJECTED]: {
        label: "Rechazada",
        color: "bg-red-100 text-red-700",
        icon: AlertTriangle,
        description: "Orden rechazada"
      },
      [EnhancedPOStatus.RECEIPT_UPLOADED]: {
        label: "Comprobante Subido",
        color: "bg-purple-100 text-purple-700",
        icon: Receipt,
        description: "En validación administrativa"
      },
      [EnhancedPOStatus.VALIDATED]: {
        label: "Validada",
        color: "bg-green-100 text-green-700",
        icon: CheckCircle,
        description: "Proceso completado"
      },
      [EnhancedPOStatus.QUOTED]: {
        label: "Cotizada",
        color: "bg-indigo-100 text-indigo-700",
        icon: FileText,
        description: "Cotización recibida"
      }
    }

    // Type-specific status configurations
    const typeSpecificStatuses: Record<PurchaseOrderType, Record<string, StatusConfig>> = {
      [PurchaseOrderType.DIRECT_PURCHASE]: {
        [EnhancedPOStatus.APPROVED]: {
          label: "Aprobada",
          color: "bg-green-100 text-green-700",
          icon: CheckCircle,
          description: "Lista para realizar la compra"
        }
      },
      [PurchaseOrderType.DIRECT_SERVICE]: {
        [EnhancedPOStatus.APPROVED]: {
          label: "Aprobada",
          color: "bg-green-100 text-green-700",
          icon: CheckCircle,
          description: "Lista para contratar el servicio"
        }
      },
      [PurchaseOrderType.SPECIAL_ORDER]: {
        [EnhancedPOStatus.APPROVED]: {
          label: "Aprobada",
          color: "bg-green-100 text-green-700",
          icon: CheckCircle,
          description: "Lista para realizar el pedido"
        },
        [EnhancedPOStatus.ORDERED]: {
          label: "Pedida",
          color: "bg-cyan-100 text-cyan-700",
          icon: ShoppingCart,
          description: "Pedido realizado al proveedor"
        },
        [EnhancedPOStatus.RECEIVED]: {
          label: "Recibida",
          color: "bg-teal-100 text-teal-700",
          icon: Package,
          description: "Productos/servicios recibidos"
        }
      }
    }

    // Check for type-specific status first, then fall back to base
    const typeSpecific = typeSpecificStatuses[type]?.[status]
    if (typeSpecific) {
      return typeSpecific
    }

    return baseStatuses[status] || {
      label: status,
      color: "bg-gray-100 text-gray-700",
      icon: Info,
      description: "Estado desconocido"
    }
  }

  const getWorkflowProgress = (currentStatus: string, type: PurchaseOrderType): number => {
    const progressMap: Record<PurchaseOrderType, Record<string, number>> = {
      [PurchaseOrderType.DIRECT_PURCHASE]: {
        'draft': 10,
        'pending_approval': 25,
        'approved': 50,
        'receipt_uploaded': 75,
        'validated': 100,
        'rejected': 0
      },
      [PurchaseOrderType.DIRECT_SERVICE]: {
        'draft': 10,
        'pending_approval': 25,
        'approved': 50,
        'receipt_uploaded': 75,
        'validated': 100,
        'rejected': 0
      },
      [PurchaseOrderType.SPECIAL_ORDER]: {
        'draft': 10,
        'quoted': 20,
        'pending_approval': 35,
        'approved': 50,
        'ordered': 65,
        'received': 75,
        'receipt_uploaded': 90,
        'validated': 100,
        'rejected': 0
      }
    }

    return progressMap[type]?.[currentStatus] || 0
  }

  if (isLoadingWorkflow) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Cargando información del workflow...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Error al cargar el workflow: {error}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const statusConfig = getStatusConfig(currentStatus, poType)
  const Icon = statusConfig.icon
  const progress = getWorkflowProgress(currentStatus, poType)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${statusConfig.color.replace('text-', 'bg-').replace('-700', '-200')}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg">Estado Actual: {statusConfig.label}</span>
              <p className="text-sm text-muted-foreground font-normal">
                {statusConfig.description}
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progreso del Workflow</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authorization Check for Approval Actions */}
      {currentStatus === 'pending_approval' && purchaseOrderAmount > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <DollarSign className="h-5 w-5" />
              Información de Autorización
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Monto a Autorizar:</span>
              <span className="text-lg font-bold">{formatCurrency(purchaseOrderAmount)}</span>
            </div>
            {profile && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tu Límite de Autorización:</span>
                                      <span className="text-lg font-bold text-green-600">
                      {isLoadingAuth ? 'Cargando...' : (
                        effectiveAuthLimit === Number.MAX_SAFE_INTEGER
                          ? 'Sin límite' 
                          : formatCurrency(effectiveAuthLimit)
                      )}
                    </span>
                </div>
                {!isLoadingAuth && effectiveAuthLimit > 0 && purchaseOrderAmount > effectiveAuthLimit && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-700">
                      <strong>No puedes autorizar esta orden.</strong> El monto excede tu límite de autorización.
                      Esta orden debe ser aprobada por un superior con mayor límite.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Simplified Action Section - Show only NEXT logical action */}
      {workflowStatus?.allowed_next_statuses && workflowStatus.allowed_next_statuses.length > 0 && 
       !['validated', 'rejected'].includes(currentStatus) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Siguiente Acción</CardTitle>
            <CardDescription>
              {getWorkflowActionDescription(currentStatus, poType)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              // Get the primary next action (most logical next step)
              const primaryAction = getPrimaryNextAction(currentStatus, workflowStatus.allowed_next_statuses, poType)
              
              // Check authorization for approval actions
              const isApprovalAction = primaryAction === 'approved'
              const isValidationAction = primaryAction === 'validated'
              
              // ✅ SISTEMA HÍBRIDO: Validación de comprobantes con autorización dinámica + restricción administrativa
              const canValidateReceipts = (() => {
                // Primero verificar si tiene rol administrativo (restricción base)
                const hasAdminRole = !!(profile?.role && [
                  'GERENCIA_GENERAL',
                  'AREA_ADMINISTRATIVA'
                ].includes(profile.role))
                
                // Si no tiene rol administrativo, no puede validar
                if (!hasAdminRole) return false
                
                // Si tiene rol administrativo, verificar si tiene autorización efectiva
                // Para validar comprobantes, requerir al menos algún nivel de autorización
                const hasAuthorizationLimit = effectiveAuthLimit > 0
                
                return hasAuthorizationLimit
              })()
              
              // Check if user can perform the action
              let canPerformAction = true
              
              if (isApprovalAction) {
                // Asegurar que todos los valores necesarios estén disponibles
                const hasValidAmount = purchaseOrderAmount > 0
                const hasValidLimit = effectiveAuthLimit > 0
                const canAuthorizeAmount = hasValidAmount && hasValidLimit && purchaseOrderAmount <= effectiveAuthLimit
                

                
                canPerformAction = !isLoadingAuth && hasValidAmount && hasValidLimit && canAuthorizeAmount
              } else if (isValidationAction) {
                canPerformAction = canValidateReceipts
              }
              
              if (!primaryAction) {
                return (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No hay acciones disponibles en este momento.
                    </AlertDescription>
                  </Alert>
                )
              }

              const actionConfig = getActionDisplayInfo(primaryAction, poType)
              const ActionIcon = actionConfig.icon
              const requiresNotes = ['rejected', 'receipt_uploaded'].includes(primaryAction)

                                return (
                    <div className="space-y-4">
                      {/* Loading authorization info */}
                      {isApprovalAction && isLoadingAuth && (
                        <Alert className="border-blue-200 bg-blue-50">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-700">
                            Verificando límite de autorización...
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {/* Show authorization warning if applicable - solo cuando no esté cargando */}
                      {isApprovalAction && !canPerformAction && !isLoadingAuth && effectiveAuthLimit > 0 && (
                        <Alert className="border-orange-200 bg-orange-50">
                          <Shield className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-orange-700">
                            <div className="space-y-2">
                              <strong>Autorización requerida por un superior</strong>
                              <p className="text-sm">
                                Esta orden de {formatCurrency(purchaseOrderAmount)} excede tu límite de autorización de {formatCurrency(effectiveAuthLimit)}
                              </p>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {/* Show validation warning if applicable */}
                      {isValidationAction && !canPerformAction && (
                        <Alert className="border-blue-200 bg-blue-50">
                          <Shield className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-700">
                            <div className="space-y-2">
                              <strong>Validación administrativa requerida</strong>
                              {!profile?.role || !['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'].includes(profile.role) ? (
                                <>
                                  <p className="text-sm">
                                    Solo el área administrativa puede validar comprobantes de órdenes de compra.
                                  </p>
                                  <p className="text-sm mt-2">
                                    Como <strong>{profile?.role?.replace(/_/g, ' ')}</strong>, no tienes permisos para validar comprobantes.
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm">
                                    Aunque tienes rol administrativo, necesitas tener límites de autorización asignados para validar comprobantes.
                                  </p>
                                  <p className="text-sm mt-2">
                                    Límite actual: <strong>{formatCurrency(effectiveAuthLimit)}</strong>
                                  </p>
                                  {effectiveAuthLimit === 0 && (
                                    <p className="text-sm text-orange-600">
                                      Contacta a tu supervisor para que te asigne límites de autorización.
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Action Button */}
                      <Card className="border-2 border-primary/20 bg-primary/5">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className={`p-3 rounded-lg ${actionConfig.color.replace('text-', 'bg-').replace('-700', '-200')}`}>
                              <ActionIcon className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-lg">{actionConfig.label}</h4>
                              <p className="text-sm text-muted-foreground">
                                {actionConfig.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                  {/* File upload and amount update section for receipt */}
                  {primaryAction === 'receipt_uploaded' && (
                    <div className="space-y-4">
                      {/* Actual amount input */}
                      <div className="space-y-2">
                        <Label htmlFor="actual_amount">
                          Monto Real Gastado (opcional)
                        </Label>
                        <Input
                          id="actual_amount"
                          type="number"
                          step="0.01"
                          placeholder="Ingresa el monto real del comprobante"
                          value={actualAmount}
                          onChange={(e) => setActualAmount(e.target.value)}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          Si es diferente al monto estimado, actualízalo aquí
                        </p>
                      </div>
                      
                      {/* File upload */}
                      <div className="space-y-2">
                        <Label htmlFor="receipt_file">
                          Archivo del Comprobante {!receiptUrl ? '(requerido)' : '(opcional - reemplazar)'}
                        </Label>
                        
                        {/* Show existing receipt if available */}
                        {receiptUrl && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center space-x-2 text-sm text-green-700">
                              <CheckCircle className="h-4 w-4" />
                              <span>Comprobante ya subido</span>
                              <a 
                                href={receiptUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                Ver archivo
                              </a>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2">
                          <Input
                            id="receipt_file"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleFileChange}
                            className="flex-1"
                          />
                          {uploadedFile && (
                            <div className="flex items-center space-x-2 text-sm text-green-600">
                              <File className="h-4 w-4" />
                              <span>{uploadedFile.name}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Formatos permitidos: PDF, JPG, JPEG, PNG. Tamaño máximo: 10MB
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Show receipt for validation when status is receipt_uploaded */}
                  {currentStatus === 'receipt_uploaded' && receiptUrl && primaryAction === 'validated' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Comprobante a Validar</Label>
                        <div className="p-4 border rounded-lg bg-blue-50">
                          <div className="flex items-center space-x-3">
                            <Receipt className="h-6 w-6 text-blue-600" />
                            <div className="flex-1">
                              <p className="font-medium">Comprobante subido</p>
                              <p className="text-sm text-muted-foreground">
                                Revisa el archivo antes de validar
                              </p>
                            </div>
                            <a 
                              href={receiptUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1 text-blue-600 hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" />
                              <span>Ver Comprobante</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes section if required */}
                  {requiresNotes && (
                    <div className="space-y-2">
                      <Label htmlFor="action_notes">
                        Notas {requiresNotes ? '(requeridas)' : '(opcionales)'}
                      </Label>
                      <Textarea
                        id="action_notes"
                        placeholder={getNotesPlaceholder(primaryAction)}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                  )}

                  {/* Action Button */}
                  <Button 
                    onClick={() => handleAdvanceWithUpload(primaryAction)}
                    disabled={
                      isUpdating || 
                      isUploading ||
                      (requiresNotes && !notes.trim()) ||
                      (primaryAction === 'receipt_uploaded' && !uploadedFile) ||
                      !canPerformAction
                    }
                    className="w-full"
                    size="lg"
                  >
                    {(isUpdating || isUploading) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isUploading ? 'Subiendo archivo...' : 'Procesando...'}
                      </>
                    ) : (
                      <>
                        {primaryAction === 'receipt_uploaded' ? (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Subir Comprobante y Continuar
                          </>
                        ) : (
                          <>
                            {getActionButtonText(primaryAction, poType)}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </>
                    )}
                  </Button>

                  {/* Secondary actions if any */}
                  {workflowStatus.allowed_next_statuses.length > 1 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        Otras acciones disponibles
                      </summary>
                      <div className="mt-2 space-y-2">
                        {workflowStatus.allowed_next_statuses
                          .filter(status => status !== primaryAction)
                          .map((status) => {
                            const config = getActionDisplayInfo(status, poType)
                            const SecondaryIcon = config.icon
                            
                            return (
                              <Button
                                key={status}
                                variant="outline"
                                size="sm"
                                onClick={() => handleAdvanceWithUpload(status)}
                                disabled={isUpdating}
                                className="w-full justify-start"
                              >
                                <SecondaryIcon className="mr-2 h-4 w-4" />
                                {config.label}
                              </Button>
                            )
                          })}
                      </div>
                    </details>
                  )}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* No Actions Available */}
      {workflowStatus && workflowStatus.allowed_next_statuses.length === 0 && (
        <Card>
          <CardContent className="py-6">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {currentStatus === 'validated' && 'Esta orden de compra ha sido completada exitosamente.'}
                {currentStatus === 'rejected' && 'Esta orden de compra fue rechazada.'}
                {!['validated', 'rejected'].includes(currentStatus) && 'No hay acciones disponibles en este momento.'}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Workflow Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Información del Workflow
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm">Tipo de Orden:</span>
            <Badge variant="outline">{poType.replace('_', ' ').toUpperCase()}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Requiere Cotización:</span>
            <Badge variant={workflowStatus?.requires_quote ? "default" : "secondary"}>
              {workflowStatus?.requires_quote ? "Sí" : "No"}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Etapa del Workflow:</span>
            <Badge variant="outline">
              {workflowStatus?.workflow_stage || statusConfig.label}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 