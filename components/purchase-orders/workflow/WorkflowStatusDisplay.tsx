"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { useMobileSessionRecovery } from "@/hooks/use-mobile-session-recovery"
import { WorkflowStageBadge } from "@/components/purchase-orders/shared/WorkflowStageBadge"

/** Server-derived hints for post-approval UX (surtido vs compra a proveedor). */
export interface POFulfillmentHints {
  poPurpose?: string | null
  inventoryFulfilled: boolean
  receivedToInventory?: boolean
  hasInventoryLines: boolean
  hasPurchaseLines: boolean
}

interface WorkflowStatusDisplayProps {
  purchaseOrderId: string
  poType: PurchaseOrderType
  currentStatus: string
  /** Canonical approval amount from server (approval_amount ?? total_amount). Available immediately — no async dependency. */
  totalAmount?: number | string | null
  /** work_order_type from server — used to determine isPreventivePO without waiting for workflowStatus. */
  workOrderType?: string | null
  /** Optional: qué falta después de aprobar (alinear con bloque Inventario en detalle OC). */
  fulfillmentHints?: POFulfillmentHints | null
  className?: string
  onStatusChange?: () => void
}

export function WorkflowStatusDisplay({
  purchaseOrderId,
  poType,
  currentStatus,
  totalAmount,
  workOrderType,
  fulfillmentHints,
  className = "",
  onStatusChange
}: WorkflowStatusDisplayProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { profile, hasAuthorizationAccess, canAuthorizeAmount, refreshProfile } = useAuthZustand()
  // Hooks must be called at the top level
  const { fetchWithSessionRecovery } = useMobileSessionRecovery()
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
  const [effectiveAuthLimit, setEffectiveAuthLimit] = useState<number>(0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [showPaymentDateFix, setShowPaymentDateFix] = useState(false)
  const [hasSelectedQuotation, setHasSelectedQuotation] = useState<boolean>(false)
  const [isLoadingQuotations, setIsLoadingQuotations] = useState<boolean>(false)
  const [pendingApprovalQuotations, setPendingApprovalQuotations] = useState<any[]>([])
  const [selectedQuotationForApproval, setSelectedQuotationForApproval] = useState<string | null>(null)
  const [approvalContext, setApprovalContext] = useState<{
    canApprove: boolean
    canReject: boolean
    canRecordViability: boolean
    reason: string
    nextStep: string
    workflowStage: string
    responsibleRole?: string
  } | null>(null)
  
  // Get PO amount using the canonical pattern (mirrors all API endpoints):
  // approval_amount is the authoritative routing field; total_amount is the fallback.
  // IMPORTANT: approval_amount may be stored as 0 (not null) when unset — treat 0 as "not set"
  // and fall through to total_amount. Props from server component are available immediately.
  const purchaseOrderAmount = (() => {
    const fromProp = Number(totalAmount ?? 0)
    if (fromProp > 0) return fromProp
    const fromApproval = Number(workflowStatus?.purchase_order?.approval_amount ?? 0)
    if (fromApproval > 0) return fromApproval
    return Number(workflowStatus?.purchase_order?.total_amount ?? 0)
  })()


  // Load workflow status on mount and fetch existing receipt if any
  useEffect(() => {
    loadWorkflowStatus(purchaseOrderId)
    
    // Load purchase order basic data for receipt and actual amount (amount now comes from workflowStatus)
    const loadPurchaseOrderData = async () => {
      try {
        // Load purchase order basic data
        const orderResponse = await fetch(`/api/purchase-orders/${purchaseOrderId}`)
        if (orderResponse.ok) {
          const orderData = await orderResponse.json()
          if (orderData.actual_amount) {
            setActualAmount(orderData.actual_amount.toString())
          }
          
          // Load receipts data separately - only if PO is approved or later
          if (orderData && ['approved', 'purchased', 'fulfilled', 'receipt_uploaded', 'validated', 'completed'].includes(orderData.status)) {
            const receiptsResponse = await fetch(`/api/purchase-orders/${purchaseOrderId}/receipts`)
            if (receiptsResponse.ok) {
              const receipts = await receiptsResponse.json()
              if (receipts.length > 0) {
                // Use the most recent receipt
                setReceiptUrl(receipts[0].file_url)
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading purchase order data:', error)
      }
    }
    
    loadPurchaseOrderData()
  }, [loadWorkflowStatus, purchaseOrderId])

  // Load quotations to check if one is selected (and for BU approve+select flow)
  useEffect(() => {
    const loadQuotationStatus = async () => {
      if (!workflowStatus?.requires_quote) {
        setHasSelectedQuotation(true) // Not required, so consider it as "ok"
        setPendingApprovalQuotations([])
        return
      }

      setIsLoadingQuotations(true)
      try {
        const response = await fetch(`/api/purchase-orders/quotations?purchase_order_id=${purchaseOrderId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        if (response.ok) {
          const result = await response.json()
          const quotations = result.data || []
          const hasSelected = quotations.some((q: any) => q.status === 'selected')
          setHasSelectedQuotation(hasSelected)
          const pending = quotations.filter((q: any) => q.status === 'pending')
          setPendingApprovalQuotations(hasSelected ? [] : pending)
          if (hasSelected) setSelectedQuotationForApproval(null)
        } else {
          setHasSelectedQuotation(false)
          setPendingApprovalQuotations([])
        }
      } catch (error) {
        console.error('Error loading quotation status:', error)
        setHasSelectedQuotation(false)
        setPendingApprovalQuotations([])
      } finally {
        setIsLoadingQuotations(false)
      }
    }

    if (workflowStatus) {
      loadQuotationStatus()
    }
    
    // Listen for quotation selection events
    const handleQuotationSelected = (event: CustomEvent) => {
      if (event.detail.purchaseOrderId === purchaseOrderId) {
        console.log('Quotation selected event received, reloading status...')
        setTimeout(() => {
          loadQuotationStatus()
        }, 500) // Small delay to ensure DB update is complete
      }
    }
    
    window.addEventListener('quotationSelected', handleQuotationSelected as EventListener)
    
    return () => {
      window.removeEventListener('quotationSelected', handleQuotationSelected as EventListener)
    }
  }, [workflowStatus, purchaseOrderId])

  // Load effective authorization limit via single-user API
  useEffect(() => {
    const loadEffectiveAuthorization = async () => {
      if (!profile?.id) return

      try {
        const response = await fetch(`/api/authorization/summary?user_id=${profile.id}`)
        const data = await response.json()

        if (!response.ok) {
          setEffectiveAuthLimit(profile.can_authorize_up_to || 0)
          return
        }

        const apiLimit =
          data.user_summary?.effective_global_authorization != null
            ? parseFloat(data.user_summary.effective_global_authorization)
            : data.authorization_scopes?.find((s: { scope_type: string }) => s.scope_type === 'global')
                ?.effective_authorization ?? 0

        if (apiLimit > 0 || data.user_summary != null) {
          setEffectiveAuthLimit(apiLimit)
          if (data.user_summary?.role != null && data.user_summary.role !== profile.role && typeof refreshProfile === 'function') {
            try {
              await refreshProfile()
            } catch { /* ignore */ }
          }
        } else {
          setEffectiveAuthLimit(profile.can_authorize_up_to || 0)
        }
      } catch {
        setEffectiveAuthLimit(profile.can_authorize_up_to || 0)
      } finally {
        setIsLoadingAuth(false)
      }
    }

    loadEffectiveAuthorization()
  }, [profile, refreshProfile])

  // Load approval context for pending POs - gates which action cards to show (same as mobile list)
  useEffect(() => {
    const loadApprovalContext = async () => {
      if (currentStatus !== 'pending_approval') {
        setApprovalContext(null)
        return
      }
      try {
        const res = await fetch(
          `/api/purchase-orders/approval-context?ids=${purchaseOrderId}`,
          { cache: 'no-store', credentials: 'include' }
        )
        if (res.ok) {
          const data = await res.json()
          const ctx = data[purchaseOrderId]
          setApprovalContext(ctx ?? null)
        } else {
          setApprovalContext(null)
        }
      } catch {
        setApprovalContext(null)
      }
    }
    loadApprovalContext()
  }, [currentStatus, purchaseOrderId, workflowStatus])

  // Helper function to upload receipt file
  const uploadReceiptFile = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true)
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('purchaseOrderId', purchaseOrderId)
      
      const response = await fetchWithSessionRecovery('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        
        // Handle mobile session issues specifically
        if (errorData.mobileSessionIssue) {
          console.error('Mobile session issue detected:', errorData)
          throw new Error('Session expired. Please try logging in again.')
        }
        
        throw new Error(errorData.error || 'Failed to upload file')
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
  const getPrimaryNextAction = (currentStatus: string, allowedStatuses: string[], poType: PurchaseOrderType, poPurpose?: string): string | null => {
    if (!allowedStatuses.length) return null

    // Special progression for inventory-only POs
    if (poPurpose === 'work_order_inventory') {
      const inventoryProgression: Record<string, string> = {
        'pending_approval': 'approved',
        'approved': 'fulfilled',  // Fulfilled instead of purchased
        'fulfilled': 'validated'
      }
      const expectedNext = inventoryProgression[currentStatus]
      if (expectedNext && allowedStatuses.includes(expectedNext)) {
        return expectedNext
      }
      return allowedStatuses[0]
    }

    // Define the logical progression for each type (cash purchases)
    const progressionMap: Record<string, Record<string, string>> = {
      [PurchaseOrderType.DIRECT_PURCHASE]: {
        'pending_approval': 'approved',
        'approved': 'purchased',  // For cash purchases, go to purchased
        'purchased': 'receipt_uploaded',
        'receipt_uploaded': 'validated'
      },
      [PurchaseOrderType.DIRECT_SERVICE]: {
        'pending_approval': 'approved',
        'approved': 'purchased',  // For cash purchases, go to purchased
        'purchased': 'receipt_uploaded',
        'receipt_uploaded': 'validated'
      },
      [PurchaseOrderType.SPECIAL_ORDER]: {
        'quoted': 'pending_approval',
        'pending_approval': 'approved',
        'approved': 'ordered',
        'ordered': 'received',
        'received': 'receipt_uploaded',
        'receipt_uploaded': 'validated'
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
  const getWorkflowActionDescription = (currentStatus: string, poType: PurchaseOrderType, poPurpose?: string): string => {
    // Special descriptions for inventory-only POs
    if (poPurpose === 'work_order_inventory') {
      const inventoryDescriptions: Record<string, string> = {
        'pending_approval': 'Esta solicitud de uso de inventario está esperando aprobación.',
        'approved': 'Solicitud aprobada. Puedes proceder a entregar el inventario a la orden de trabajo.',
        'fulfilled': 'Inventario entregado. Esperando validación administrativa.',
        'validated': 'Proceso completado'
      }
      return inventoryDescriptions[currentStatus] || 'Continúa con el siguiente paso del proceso.'
    }

    const descriptions: Record<string, Record<string, string>> = {
      [PurchaseOrderType.DIRECT_PURCHASE]: {
        'pending_approval': 'Esta compra directa está esperando aprobación para proceder.',
        'approved': 'Compra aprobada. Puedes proceder a realizar la compra en la tienda especificada.',
        'purchased': 'Compra realizada. Sube el comprobante para continuar.',
        'receipt_uploaded': 'Comprobante subido. Esperando validación administrativa.',
        'validated': 'Proceso completado'
      },
      [PurchaseOrderType.DIRECT_SERVICE]: {
        'pending_approval': 'Este servicio directo está esperando aprobación para proceder.',
        'approved': 'Servicio aprobado. Puedes proceder a contratar el servicio con el proveedor especificado.',
        'purchased': 'Servicio contratado. Sube el comprobante para continuar.',
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
  const getActionButtonText = (action: string, poType: PurchaseOrderType, poPurpose?: string): string => {
    // Special button texts for inventory-only POs
    if (poPurpose === 'work_order_inventory') {
      const inventoryButtons: Record<string, string> = {
        'approved': 'Aprobar Solicitud',
        'fulfilled': 'Marcar como Cumplida',
        'validated': 'Validar Cumplimiento',
        'rejected': 'Rechazar Solicitud'
      }
      return inventoryButtons[action] || `Avanzar a ${action}`
    }

    const buttonTexts: Record<string, Record<string, string>> = {
      [PurchaseOrderType.DIRECT_PURCHASE]: {
        'approved': 'Aprobar Compra',
        'purchased': 'Marcar como Comprada',
        'receipt_uploaded': 'Subir Comprobante',
        'validated': 'Validar Comprobante',
        'rejected': 'Rechazar Compra'
      },
      [PurchaseOrderType.DIRECT_SERVICE]: {
        'approved': 'Aprobar Servicio',
        'purchased': 'Marcar como Contratado',
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

  // Stage-aware label for the "approve" action — used in button + action card header.
  // GG can bypass directly at the technical stage; their label reflects their role, not the Gerente's.
  const getStageAwareApprovalLabel = (workflowStage: string): { label: string; description: string } => {
    const isGG = profile?.role === 'GERENCIA_GENERAL'
    switch (workflowStage) {
      case "Validación técnica":
        return isGG
          ? { label: "Aprobar directamente", description: "Como Gerencia General — aprobación directa (bypass)" }
          : { label: "Dar validación técnica", description: "Como Gerente de Mantenimiento" }
      case "Viabilidad administrativa":
        return isGG
          ? { label: "Registrar viabilidad", description: "Como Gerencia General" }
          : { label: "Registrar viabilidad", description: "Como Área Administrativa" }
      case "Aprobación final":
        return { label: "Dar aprobación final", description: "Como Gerencia General — aprobación final" }
      default:
        return { label: "Aprobar", description: "Continuar con la aprobación" }
    }
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
  const getActionDisplayInfo = (action: string, poType: PurchaseOrderType, poPurpose?: string) => {
    // Special action info for inventory-only POs
    if (poPurpose === 'work_order_inventory') {
      const inventoryActions: Record<string, { label: string; description: string; icon: any; color: string }> = {
        'approved': {
          label: 'Aprobar Solicitud',
          description: 'Autorizar el uso de inventario para la orden de trabajo',
          icon: CheckCircle,
          color: 'bg-green-100 text-green-700'
        },
        'fulfilled': {
          label: 'Marcar como Cumplida',
          description: 'Confirmar que el inventario fue entregado a la orden de trabajo',
          icon: Package,
          color: 'bg-blue-100 text-blue-700'
        },
        'validated': {
          label: 'Validar Cumplimiento',
          description: 'Validar que el inventario fue correctamente entregado',
          icon: CheckCircle,
          color: 'bg-green-100 text-green-700'
        },
        'rejected': {
          label: 'Rechazar Solicitud',
          description: 'Rechazar la solicitud de uso de inventario',
          icon: AlertTriangle,
          color: 'bg-red-100 text-red-700'
        }
      }
      return inventoryActions[action] || {
        label: `Avanzar a ${action}`,
        description: 'Continuar con el siguiente paso',
        icon: ArrowRight,
        color: 'bg-gray-100 text-gray-700'
      }
    }

    const actionInfo: Record<string, Record<string, { label: string; description: string; icon: any; color: string }>> = {
      [PurchaseOrderType.DIRECT_PURCHASE]: {
        'approved': {
          label: 'Aprobar Compra',
          description: 'Autorizar la compra directa para proceder',
          icon: CheckCircle,
          color: 'bg-green-100 text-green-700'
        },
        'purchased': {
          label: 'Marcar como Comprada',
          description: 'Confirmar que la compra fue realizada',
          icon: ShoppingCart,
          color: 'bg-cyan-100 text-cyan-700'
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
        'purchased': {
          label: 'Marcar como Contratado',
          description: 'Confirmar que el servicio fue contratado',
          icon: ShoppingCart,
          color: 'bg-cyan-100 text-cyan-700'
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
    const poPurpose = workflowStatus?.purchase_order?.po_purpose
    // Inventory POs don't need receipts
    const requiresNotes = ['rejected', 'receipt_uploaded'].includes(newStatus) && poPurpose !== 'work_order_inventory'
    const requiresFile = newStatus === 'receipt_uploaded' && poPurpose !== 'work_order_inventory'
    
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
        let updateResponse = await fetch(`/api/purchase-orders/${purchaseOrderId}`, {
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
          // Try to handle known validation (payment date in past for transfer)
          try {
            const errorData = await updateResponse.json()
            if (errorData?.requires_fix && errorData?.fix_type === 'payment_date') {
              console.log('Payment date validation error detected, attempting auto-fix...')
              const fixed = await handlePaymentDateError()
              if (fixed) {
                console.log('Payment date fixed, retrying update...')
                // Retry update once after auto-fix
                updateResponse = await fetch(`/api/purchase-orders/${purchaseOrderId}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    receipt_url: fileUrl,
                    actual_amount: actualAmount ? parseFloat(actualAmount) : undefined
                  })
                })
                if (updateResponse.ok) {
                  console.log('Update successful after payment date fix')
                } else {
                  console.error('Update still failed after payment date fix')
                }
              } else {
                console.error('Payment date fix failed')
              }
            } else {
              console.error('Update failed with error:', errorData)
            }
          } catch (e) {
            console.error('Error parsing update response:', e)
          }
          if (!updateResponse.ok) {
            console.error('Failed to update purchase order data')
          }
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
    
    // Pass quotation_id when BU approves with 2+ quotes (select-as-part-of-approval)
    const quotationId = newStatus === 'approved' ? selectedQuotationForApproval || undefined : undefined
    let success = false
    try {
      success = await advanceWorkflow(purchaseOrderId, newStatus, workflowNotes || undefined, quotationId)
    } catch (error) {
      console.log('Workflow advance failed, checking if it\'s a payment date issue...')
      
      // If workflow advance failed, check if it's a payment date issue and try to fix it
      try {
        const response = await fetch(`/api/purchase-orders/advance-workflow/${purchaseOrderId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ new_status: newStatus, notes: workflowNotes, quotation_id: quotationId })
        })
        
        if (!response.ok && response.status === 400) {
          const errorData = await response.json()
          console.log('Workflow advance error details:', errorData)
          
          if (errorData?.requires_fix && errorData?.fix_type === 'payment_date') {
            console.log('Workflow advance failed due to payment date, attempting fix...')
            
            toast({
              title: "Corrigiendo fecha de pago",
              description: "Se detectó un problema con la fecha de pago. Corrigiendo automáticamente...",
            })
            
            const fixed = await handlePaymentDateError()
            if (fixed) {
              console.log('Payment date fixed, retrying workflow advance...')
              toast({
                title: "Fecha corregida",
                description: "Reintentando operación...",
              })
              success = await advanceWorkflow(purchaseOrderId, newStatus, workflowNotes || undefined, quotationId)
            } else {
              setShowPaymentDateFix(true)
              toast({
                title: "Error",
                description: "No se pudo corregir automáticamente la fecha de pago. Usa el botón de corrección manual.",
                variant: "destructive"
              })
            }
          } else {
            // Re-throw the original error if it's not a payment date issue
            throw error
          }
        } else {
          // Re-throw the original error if we can't get details
          throw error
        }
      } catch (checkError) {
        console.error('Error checking workflow advance error:', checkError)
        // Re-throw the original error
        throw error
      }
    }
    
    if (success) {
      setNotes("")
      setUploadedFile(null)
      // Reset file input
      const fileInput = document.getElementById('receipt_file') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      // Update receipt URL state
      if (fileUrl) setReceiptUrl(fileUrl)

      // Note: usePurchaseOrders.advanceWorkflow already shows the descriptive API toast
      // (e.g. "Validación técnica registrada..." or "Autorización escalada...").
      // Do NOT add a second generic toast here — it creates confusing duplicate notifications.

      // Reload workflow status to reflect authorized_by / viability_state changes
      await loadWorkflowStatus(purchaseOrderId)
      if (onStatusChange) {
        onStatusChange()
      }
      router.refresh()
    }
  }

  // Handle payment date error specifically
  const handlePaymentDateError = async (): Promise<boolean> => {
    try {
      // Try to fix the payment date automatically by setting it to 30 days from now
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/fix-payment-date`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_payment_date'
          // Let the endpoint auto-generate a future date
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
        return true
      } else {
        const errorData = await response.json()
        console.error('Fix payment date failed:', errorData)
        toast({
          title: "Error al actualizar fecha de pago",
          description: errorData.error || errorData.details || "No se pudo actualizar la fecha de pago automáticamente.",
          variant: "destructive"
        })
        return false
      }
    } catch (error) {
      console.error('Error fixing payment date:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar la fecha de pago automáticamente.",
        variant: "destructive"
      })
      return false
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
      },
      [EnhancedPOStatus.FULFILLED]: {
        label: "Cumplida",
        color: "bg-blue-100 text-blue-700",
        icon: Package,
        description: "Inventario entregado a la orden de trabajo"
      },
      [EnhancedPOStatus.PURCHASED]: {
        label: "Comprada",
        color: "bg-cyan-100 text-cyan-700",
        icon: ShoppingCart,
        description: "Compra realizada"
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

  const getWorkflowProgress = (currentStatus: string, type: PurchaseOrderType, poPurpose?: string): number => {
    // Special progress map for inventory-only POs
    if (poPurpose === 'work_order_inventory') {
      const inventoryProgress: Record<string, number> = {
        'draft': 10,
        'pending_approval': 25,
        'approved': 50,
        'fulfilled': 75,
        'validated': 100,
        'rejected': 0
      }
      return inventoryProgress[currentStatus] || 0
    }

    const progressMap: Record<PurchaseOrderType, Record<string, number>> = {
      [PurchaseOrderType.DIRECT_PURCHASE]: {
        'draft': 10,
        'pending_approval': 25,
        'approved': 50,
        'purchased': 65,
        'receipt_uploaded': 75,
        'validated': 100,
        'rejected': 0
      },
      [PurchaseOrderType.DIRECT_SERVICE]: {
        'draft': 10,
        'pending_approval': 25,
        'approved': 50,
        'purchased': 65,
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

  const poPurpose = workflowStatus?.purchase_order?.po_purpose
  const statusConfig = getStatusConfig(currentStatus, poType)
  const Icon = statusConfig.icon
  const progress = getWorkflowProgress(currentStatus, poType, poPurpose)

  const requiresViability = workflowStatus?.purchase_order?.workflow_policy?.requires_viability
  const viabilityState = workflowStatus?.purchase_order?.viability_state
  const hasTechnicalApproval = !!workflowStatus?.purchase_order?.authorized_by
  const hasViability = viabilityState === 'viable'
  // Mirrors normalizeWorkOrderType() in workflow-policy.ts: accepts 'preventive' and 'preventivo'.
  // Use server-side prop first (available immediately); fall back to workflowStatus once loaded.
  const rawWorkOrderType = workOrderType ?? workflowStatus?.purchase_order?.work_order_type
  const isPreventivePO =
    rawWorkOrderType === 'preventive' || rawWorkOrderType === 'preventivo'

  // Two-tier escalation check — most authoritative wins:
  // 1. Server-computed policy flag (authoritative once workflowStatus loads — uses approval_amount + full path logic)
  // 2. Client-side policy math from server-provided props (available immediately on first render)
  //
  // NOTE: We intentionally do NOT use workflowStage === "Aprobación final" here.
  // "Aprobación final" applies to BOTH <$7k POs (Admin/CxP) AND ≥$7k POs (GG).
  // Using the stage alone would incorrectly mark every final-step PO as requiring GG.
  const serverRequiresGM = workflowStatus?.purchase_order?.workflow_policy?.requires_gm_if_above_threshold
  const needsGMEscalation =
    serverRequiresGM === true ||
    (!isPreventivePO && purchaseOrderAmount >= 7000)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Single consolidated workflow card - Status + Progress + Approval steps + Financial summary */}
      <Card className="overflow-hidden">
        <CardHeader className="p-5 md:p-6 pb-4">
          <CardTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${statusConfig.color.replace('text-', 'bg-').replace('-700', '-200')}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-lg block">Estado: {statusConfig.label}</span>
              <p className="text-sm text-muted-foreground font-normal">
                {statusConfig.description}
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 md:p-6 pt-0 space-y-5">
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progreso</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className="bg-primary h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Post-approval: claridad surtido vs compra (ancla al bloque Inventario en la misma página) */}
          {fulfillmentHints &&
            [
              "approved",
              "purchased",
              "ordered",
              "received",
              "receipt_uploaded",
              "fulfilled",
            ].includes(currentStatus) &&
            (() => {
              const h = fulfillmentHints
              const needSurtido = h.hasInventoryLines && !h.inventoryFulfilled
              const needCompraORecepcion =
                h.hasPurchaseLines && h.poPurpose !== "work_order_inventory"
              if (!needSurtido && !needCompraORecepcion) return null
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-50/90 border-l-[3px] border-l-amber-500 p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-900/90">
                    Próximos pasos
                  </p>
                  <ul className="text-sm text-amber-950 space-y-2 list-none pl-0">
                    {needSurtido && (
                      <li className="flex gap-2 items-start">
                        <Package className="h-4 w-4 shrink-0 mt-0.5 text-amber-800" />
                        <span>
                          Falta registrar el{" "}
                          <strong>surtido desde almacén</strong> para las partidas con origen
                          almacén. El inventario baja al confirmar surtido, no al aprobar.{" "}
                          <a
                            href="#po-gestion-inventario"
                            className="font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
                          >
                            Ir a inventario
                          </a>
                        </span>
                      </li>
                    )}
                    {needCompraORecepcion && (
                      <li className="flex gap-2 items-start">
                        <ShoppingCart className="h-4 w-4 shrink-0 mt-0.5 text-amber-800" />
                        <span>
                          {h.poPurpose === "inventory_restock"
                            ? "Cuando reciba la mercancía, registre la entrada al almacén desde el bloque Inventario o avance el flujo según corresponda."
                            : "Complete la compra a proveedor con los botones del flujo y cargue el comprobante cuando aplique."}
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              )
            })()}

          {/* When pending_approval: Unified 3-step approval chain + compact financial summary */}
          {currentStatus === 'pending_approval' && (
            <>
              {/* Policy-driven stage badge - consistent with list view */}
              {approvalContext && (
                <div className="flex items-center gap-2">
                  <WorkflowStageBadge
                    workflowStage={approvalContext.workflowStage}
                    responsibleRole={
                      !(approvalContext.canApprove || approvalContext.canRecordViability)
                        ? approvalContext.responsibleRole
                        : undefined
                    }
                    canAct={approvalContext.canApprove || approvalContext.canRecordViability}
                    showHelp={true}
                  />
                </div>
              )}

              {/* Compact financial summary */}
              <div className="space-y-2 text-sm p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-muted-foreground text-xs">Monto</span>
                    <p className="font-semibold tabular-num">{formatCurrency(purchaseOrderAmount)}</p>
                  </div>
                  {workflowStatus?.purchase_order?.payment_condition && workflowStatus.purchase_order.po_purpose !== 'work_order_inventory' && (
                    <div className="text-right">
                      <span className="text-muted-foreground text-xs">Condición</span>
                      <p className="font-medium">
                        {workflowStatus.purchase_order.payment_condition === 'credit' ? 'Crédito' : 'Contado'}
                      </p>
                    </div>
                  )}
                </div>
                {needsGMEscalation && approvalContext?.workflowStage !== "Aprobación final" && (
                  <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                    <span className="text-[10px] font-semibold text-amber-700">
                      Este monto supera el umbral de $7,000 MXN — se requerirá aprobación de Gerencia General como paso final.
                    </span>
                  </div>
                )}
              </div>

              {/* Approval chain — always visible so users know exactly where this PO is in the flow */}
              <div className="space-y-2 pt-2 border-t">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Pasos de aprobación</p>
                <div className="space-y-2.5">
                  {/* Step 1: Technical (Gerente Mantenimiento) */}
                  {(() => {
                    const isActive = approvalContext?.workflowStage === "Validación técnica"
                    const isDone = hasTechnicalApproval
                    const stepNum = 1
                    return (
                      <div className="flex items-center gap-3">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isDone ? 'bg-green-100 text-green-700' : isActive ? 'bg-sky-100 text-sky-700 ring-2 ring-sky-300' : 'bg-muted text-muted-foreground'
                        }`}>
                          {isDone ? '✓' : stepNum}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${isActive ? 'text-sky-700' : ''}`}>Gerente de Mantenimiento</span>
                          <span className="text-xs text-muted-foreground block">
                            {isDone ? 'Completado' : isActive ? 'Etapa actual' : 'Pendiente'}
                          </span>
                        </div>
                        {isDone && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                      </div>
                    )
                  })()}

                  {/* Step 2: Viability — only when path requires it */}
                  {requiresViability && (() => {
                    const isActive = approvalContext?.workflowStage === "Viabilidad administrativa"
                    const isDone = hasViability
                    const isPending = !isActive && !isDone
                    const stepNum = 2
                    return (
                      <div className="flex items-center gap-3">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isDone ? 'bg-green-100 text-green-700'
                          : isActive ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                          : isPending ? 'bg-muted/40 text-muted-foreground/60 border border-dashed border-muted-foreground/30'
                          : 'bg-muted text-muted-foreground'
                        }`}>
                          {isDone ? '✓' : stepNum}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${isActive ? 'text-amber-700' : isPending ? 'text-muted-foreground' : ''}`}>
                            Área Administrativa
                          </span>
                          <span className="text-xs text-muted-foreground block">
                            {isDone ? 'Viable'
                            : viabilityState === 'not_viable' ? 'No viable'
                            : isActive ? 'Etapa actual — registrar viabilidad'
                            : 'Pendiente de etapa anterior'}
                          </span>
                        </div>
                        {isDone && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                      </div>
                    )
                  })()}

                  {/* Final step: GM approval — shown whenever amount ≥ $7k triggers escalation */}
                  {needsGMEscalation && (() => {
                    const isActive = approvalContext?.workflowStage === "Aprobación final"
                    const prerequisiteMet = requiresViability ? hasViability : hasTechnicalApproval
                    const isPending = !isActive && !prerequisiteMet
                    const stepNum = requiresViability ? 3 : 2
                    return (
                      <div className="flex items-start gap-3">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                            : isPending
                            ? 'bg-muted/40 text-muted-foreground/60 border border-dashed border-muted-foreground/30'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {stepNum}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium ${isActive ? 'text-emerald-700' : isPending ? 'text-muted-foreground' : ''}`}>
                              Gerencia General
                            </span>
                            {isPending && (
                              <span className="rounded-full border border-dashed border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                Requerida · monto ≥ $7k
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground block">
                            {isActive
                              ? 'Etapa actual — aprobación final'
                              : isPending
                              ? 'Pendiente de etapas anteriores'
                              : 'Pendiente aprobación final'}
                          </span>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {profile?.role === 'GERENCIA_GENERAL' && !hasTechnicalApproval && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Puedes aprobar directamente, pero se recomienda esperar al Gerente de Mantenimiento.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Registrar Viabilidad - only when current user is authorized (same logic as mobile list) */}
      {workflowStatus?.purchase_order?.workflow_policy?.requires_viability &&
       currentStatus === 'pending_approval' &&
       (!workflowStatus.purchase_order.viability_state || workflowStatus.purchase_order.viability_state === 'pending') &&
       approvalContext?.canRecordViability &&
       !approvalContext?.canApprove && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Registrar Viabilidad</CardTitle>
            <CardDescription>
              Área Administrativa o Gerencia General deben registrar la viabilidad antes de la aprobación final.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => handleAdvanceWithUpload('validated')}
              disabled={isUpdating || isLoadingWorkflow}
              className="w-full"
            >
              <Shield className="mr-2 h-4 w-4" />
              Registrar viabilidad administrativa
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Simplified Action Section - Show only NEXT logical action. For pending_approval, gate by approval-context. */}
      {workflowStatus?.allowed_next_statuses && workflowStatus.allowed_next_statuses.length > 0 && 
       !['validated', 'rejected'].includes(currentStatus) &&
       (currentStatus !== 'pending_approval' || approvalContext?.canApprove) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Siguiente Acción</CardTitle>
            <CardDescription>
              {getWorkflowActionDescription(currentStatus, poType, poPurpose)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              // Get the primary next action (most logical next step)
              const primaryAction = getPrimaryNextAction(currentStatus, workflowStatus.allowed_next_statuses, poType, poPurpose)
              
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
              // For approval: trust approvalContext.canApprove (card is already gated by it); only check quotation
              let canPerformAction = true
              
              if (isApprovalAction) {
                const quotationRequirementMet = !workflowStatus?.requires_quote || hasSelectedQuotation ||
                  (pendingApprovalQuotations.length >= 2 && !!selectedQuotationForApproval)
                canPerformAction = !isLoadingQuotations && quotationRequirementMet
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

              const actionConfig = getActionDisplayInfo(primaryAction, poType, poPurpose)
              const ActionIcon = actionConfig.icon
              // Inventory POs don't need receipts
              const requiresNotes = ['rejected', 'receipt_uploaded'].includes(primaryAction) && poPurpose !== 'work_order_inventory'

                                return (
                    <div className="space-y-4">
                      {/* Loading quotation status */}
                      {isApprovalAction && isLoadingQuotations && (
                        <Alert className="border-blue-200 bg-blue-50">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-700">
                            Verificando estado de cotizaciones...
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {/* Show quotation picker when 2+ quotes with none selected - BU can select as part of approval */}
                      {isApprovalAction && !isLoadingQuotations && workflowStatus?.requires_quote && !hasSelectedQuotation && pendingApprovalQuotations.length >= 2 && (
                        <Alert className="border-orange-200 bg-orange-50">
                          <FileText className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-orange-700">
                            <div className="space-y-2">
                              <strong>Selecciona la cotización al aprobar</strong>
                              <p className="text-sm">
                                Esta orden tiene múltiples cotizaciones. Selecciona la que autorizas:
                              </p>
                              <div className="mt-2 space-y-2">
                                {pendingApprovalQuotations.map((q: any) => (
                                  <label key={q.id} className="flex items-center gap-2 cursor-pointer p-2 rounded border border-orange-200 hover:bg-orange-100">
                                    <input
                                      type="radio"
                                      name="quotation_for_approval"
                                      value={q.id}
                                      checked={selectedQuotationForApproval === q.id}
                                      onChange={() => setSelectedQuotationForApproval(q.id)}
                                    />
                                    <span className="font-medium">{q.supplier_name}</span>
                                    <span className="text-sm text-muted-foreground">
                                      ${Number(q.quoted_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                      {/* Single quote case - still need to select above or different flow */}
                      {isApprovalAction && !isLoadingQuotations && workflowStatus?.requires_quote && !hasSelectedQuotation && pendingApprovalQuotations.length < 2 && (
                        <Alert className="border-orange-200 bg-orange-50">
                          <FileText className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-orange-700">
                            <div className="space-y-2">
                              <strong>Selección de cotización requerida</strong>
                              <p className="text-sm">
                                Revisa la sección de Cotizaciones arriba para comparar y seleccionar una cotización ganadora.
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

                      {/* Action Card — stage-aware for approval steps */}
                      {(() => {
                        const stageLabel = isApprovalAction && approvalContext?.workflowStage
                          ? getStageAwareApprovalLabel(approvalContext.workflowStage)
                          : null
                        const displayLabel = stageLabel?.label ?? actionConfig.label
                        const displayDesc = stageLabel?.description ?? actionConfig.description
                        return (
                          <Card className="border-2 border-primary/20 bg-primary/5">
                            <CardContent className="p-4">
                              <div className="flex items-center space-x-3">
                                <div className={`p-3 rounded-lg ${actionConfig.color.replace('text-', 'bg-').replace('-700', '-200')}`}>
                                  <ActionIcon className="h-6 w-6" />
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-base">{displayLabel}</h4>
                                  <p className="text-xs text-muted-foreground mt-0.5">{displayDesc}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })()}

                  {/* File upload and amount update section for receipt (not for inventory POs) */}
                  {primaryAction === 'receipt_uploaded' && poPurpose !== 'work_order_inventory' && (
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

                  {/* Show receipt for validation when status is receipt_uploaded (not for inventory POs) */}
                  {currentStatus === 'receipt_uploaded' && receiptUrl && primaryAction === 'validated' && poPurpose !== 'work_order_inventory' && (
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
                            {isApprovalAction && approvalContext?.workflowStage
                              ? getStageAwareApprovalLabel(approvalContext.workflowStage).label
                              : getActionButtonText(primaryAction, poType, poPurpose)}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </>
                    )}
                  </Button>

                  {/* Manual payment date fix button */}
                  {showPaymentDateFix && (
                    <Button 
                      onClick={async () => {
                        setShowPaymentDateFix(false)
                        const fixed = await handlePaymentDateError()
                        if (fixed) {
                          toast({
                            title: "Fecha corregida",
                            description: "Ahora puedes intentar la operación nuevamente.",
                          })
                        }
                      }}
                      variant="outline"
                      className="w-full"
                      size="lg"
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Corregir Fecha de Pago Manualmente
                    </Button>
                  )}

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
                            const config = getActionDisplayInfo(status, poType, poPurpose)
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

      {/* Pending approval but user cannot act — clear waiting state */}
      {currentStatus === 'pending_approval' &&
       approvalContext &&
       !approvalContext.canApprove &&
       !approvalContext.canRecordViability && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3.5">
              <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">En espera de acción externa</p>
                {approvalContext.responsibleRole && (
                  <p className="text-xs text-amber-800 mt-0.5">
                    Pendiente de: <span className="font-medium">{approvalContext.responsibleRole}</span>
                  </p>
                )}
                {approvalContext.reason && (
                  <p className="text-xs text-amber-700 mt-1">{approvalContext.reason}</p>
                )}
              </div>
            </div>
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

    </div>
  )
} 