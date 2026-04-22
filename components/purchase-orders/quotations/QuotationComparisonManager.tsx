"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnhancedQuotationUploader } from "./EnhancedQuotationUploader"
import { QuotationComparisonTable } from "./QuotationComparisonTable"
import { QuotationComparisonCard } from "./QuotationComparisonCard"
import { QuotationSelectionDialog } from "./QuotationSelectionDialog"
import { QuotationFileButton } from "./QuotationFileButton"
import {
  PurchaseOrderQuotation,
  QuotationComparisonResponse,
  QuotationStatus,
} from "@/types/purchase-orders"
import { QuotationService } from "@/lib/services/quotation-service"
import { toast } from "sonner"
import { AlertCircle, CheckCircle2, FileText, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

interface QuotationComparisonManagerProps {
  purchaseOrderId: string
  workOrderId?: string
  quotationSelectionRequired?: boolean
  quotationSelectionStatus?: string
  poPurpose?: string
  className?: string
  /** When true, use compact layout (cards only, collapsible upload) */
  compact?: boolean
  /** From server: whether viewer is Coordinador, Encargado deprecado, o Ejecutivo (misma política) */
  isViewerCoordinator?: boolean
  /** From server: puede add/edit/delete cotizaciones (alcance + pre-viabilidad) */
  coordinatorQuotationUnlocked?: boolean
}

export function QuotationComparisonManager({
  purchaseOrderId,
  workOrderId,
  quotationSelectionRequired = false,
  quotationSelectionStatus,
  poPurpose,
  className = "",
  compact: compactProp,
  isViewerCoordinator = false,
  coordinatorQuotationUnlocked = true,
}: QuotationComparisonManagerProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const compact = compactProp ?? isMobile
  
  const [quotations, setQuotations] = useState<PurchaseOrderQuotation[]>([])
  const [comparison, setComparison] = useState<QuotationComparisonResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null)
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false)
  const [addQuotationOpen, setAddQuotationOpen] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState<PurchaseOrderQuotation | null>(null)

  const loadQuotations = useCallback(async () => {
    setIsLoading(true)
    try {
      const [quotationsData, comparisonData] = await Promise.all([
        QuotationService.getQuotations(purchaseOrderId),
        QuotationService.getComparison(purchaseOrderId)
      ])
      
      setQuotations(quotationsData)
      setComparison(comparisonData)
    } catch (error) {
      console.error('Error loading quotations:', error)
      toast.error('Error al cargar cotizaciones')
    } finally {
      setIsLoading(false)
    }
  }, [purchaseOrderId])

  useEffect(() => {
    if (poPurpose === 'work_order_inventory') {
      setIsLoading(false)
      return
    }
    void loadQuotations()
  }, [loadQuotations, poPurpose])

  const handleQuotationAdded = async () => {
    await loadQuotations()
    setAddQuotationOpen(false)
  }

  const handleDeleteQuotation = async (quotationId: string) => {
    if (!confirm('¿Eliminar esta cotización?')) return
    try {
      const res = await fetch(`/api/purchase-orders/quotations/${quotationId}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || "Error al eliminar")
      }
      await loadQuotations()
      toast.success('Cotización eliminada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar")
    }
  }

  const handleOpenEdit = (quotationId: string) => {
    const q = quotations.find((x) => x.id === quotationId)
    if (q) setEditingQuotation(q)
  }

  const rowUnlocked = !isViewerCoordinator || coordinatorQuotationUnlocked
  /** Plant + pre-viability for coordinador/ejecutivo; everyone else is unrestricted here (API/RLS still apply) */
  const canMutate = rowUnlocked
  const showAddQuotation = !isViewerCoordinator || coordinatorQuotationUnlocked

  const handleSelectQuotation = (quotationId: string) => {
    setSelectedQuotationId(quotationId)
    setSelectionDialogOpen(true)
  }

  const handleConfirmSelection = async (quotationId: string, reason: string) => {
    try {
      const response = await fetch(`/api/purchase-orders/quotations/${quotationId}/select`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selection_reason: reason
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to select quotation')
      }
      
      // Reload quotations and refresh the page
      await loadQuotations()
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('quotationSelected', { 
        detail: { quotationId, purchaseOrderId } 
      }))
      
      router.refresh()
      toast.success('Proveedor seleccionado exitosamente')
    } catch (error) {
      console.error('Error selecting quotation:', error)
      throw error
    }
  }

  const selectedQuotation = quotations.find(q => q.id === selectedQuotationId)
  const selectedQuotationData = quotations.find(q => q.status === QuotationStatus.SELECTED)
  
  const lowestPrice = comparison?.comparison.summary.lowest_price || 0
  const fastestDelivery = comparison?.comparison.summary.fastest_delivery || 0

  if (poPurpose === "work_order_inventory") {
    return null
  }

  if (isLoading) {
    return <div className={cn("text-center py-6 text-muted-foreground text-sm", className)}>Cargando cotizaciones...</div>
  }

  // 1 fila mínima solo si además no hay acciones (si canMutate, mostramos tarjeta con "Editar" y archivo)
  const singleSelected =
    compact && quotations.length === 1 && selectedQuotationData && !canMutate

  // Status bar only when NOT single-selected (would duplicate)
  const statusMessage = !singleSelected && quotationSelectionRequired && (() => {
    if (quotationSelectionStatus === 'pending_selection') {
      return { type: 'action' as const, text: 'Debe seleccionar un proveedor antes de aprobar' }
    }
    if (quotationSelectionStatus === 'pending_quotations') {
      return { type: 'info' as const, text: 'Se requieren al menos 2 cotizaciones' }
    }
    if (quotationSelectionStatus === 'selected' && selectedQuotationData && quotations.length > 1) {
      return {
        type: 'success' as const,
        text: `Proveedor: ${selectedQuotationData.supplier_name}`,
      }
    }
    return null
  })()

  return (
    <div className={cn("space-y-4", className)}>
      {statusMessage && (
        <div className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
          statusMessage.type === 'action' && "bg-amber-50 text-amber-800 border border-amber-200",
          statusMessage.type === 'info' && "bg-muted/50 text-muted-foreground",
          statusMessage.type === 'success' && "bg-green-50 text-green-800 border border-green-200"
        )}>
          {(statusMessage.type === 'action' || statusMessage.type === 'info') && <AlertCircle className="h-4 w-4 shrink-0" />}
          {statusMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Single selected: minimal one-liner (compact mode only) */}
      {singleSelected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-green-50/50 border-green-200 px-3 py-2 text-sm">
          <span className="font-medium text-green-900">{selectedQuotationData.supplier_name}</span>
          <span className="text-green-800">
            {selectedQuotationData.quoted_amount?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
          </span>
          <QuotationFileButton
            quotation={selectedQuotationData}
            variant="link"
            className="inline-flex h-auto p-0 text-green-700"
            label="Ver"
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            Ver
          </QuotationFileButton>
        </div>
      ) : quotations.length > 0 ? (
        compact ? (
          <div className="grid grid-cols-1 gap-3">
            {quotations.map((quotation) => {
              const isSelected = quotation.status === QuotationStatus.SELECTED
              const isBestPrice = quotation.quoted_amount === lowestPrice
              const isFastestDelivery = quotation.delivery_days === fastestDelivery
              return (
                <QuotationComparisonCard
                  key={quotation.id}
                  quotation={quotation}
                  isSelected={isSelected}
                  isBestPrice={isBestPrice}
                  isFastestDelivery={isFastestDelivery}
                  onSelect={quotationSelectionStatus === 'pending_selection' ? handleSelectQuotation : undefined}
                  onDelete={canMutate ? handleDeleteQuotation : undefined}
                  onEdit={canMutate ? handleOpenEdit : undefined}
                  showSelectActions={quotationSelectionStatus === 'pending_selection'}
                />
              )
            })}
          </div>
        ) : (
          <Tabs defaultValue="cards" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="cards">Tarjetas</TabsTrigger>
              <TabsTrigger value="table">Tabla</TabsTrigger>
            </TabsList>
            <TabsContent value="cards">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quotations.map((quotation) => {
                  const isSelected = quotation.status === QuotationStatus.SELECTED
                  const isBestPrice = quotation.quoted_amount === lowestPrice
                  const isFastestDelivery = quotation.delivery_days === fastestDelivery
                  return (
                    <QuotationComparisonCard
                      key={quotation.id}
                      quotation={quotation}
                      isSelected={isSelected}
                      isBestPrice={isBestPrice}
                      isFastestDelivery={isFastestDelivery}
                      onSelect={quotationSelectionStatus === 'pending_selection' ? handleSelectQuotation : undefined}
                      onDelete={canMutate ? handleDeleteQuotation : undefined}
                      onEdit={canMutate ? handleOpenEdit : undefined}
                      showSelectActions={quotationSelectionStatus === 'pending_selection'}
                    />
                  )
                })}
              </div>
            </TabsContent>
            <TabsContent value="table">
              {comparison?.comparison && (
                <QuotationComparisonTable
                  comparison={comparison.comparison}
                  onSelect={quotationSelectionStatus === 'pending_selection' ? handleSelectQuotation : undefined}
                  onEdit={canMutate ? handleOpenEdit : undefined}
                  onDelete={canMutate ? handleDeleteQuotation : undefined}
                />
              )}
            </TabsContent>
          </Tabs>
        )
      ) : (
        <p className="text-sm text-muted-foreground py-1">
          No hay cotizaciones. Agregue al menos una.
        </p>
      )}

      {/* Add quotation - modal, form only when asked */}
      {showAddQuotation ? (
        <Dialog open={addQuotationOpen} onOpenChange={setAddQuotationOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
                compact ? "py-1" : "rounded-lg border bg-muted/30 px-4 py-2"
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              {quotations.length > 0 ? "Agregar otra cotización" : "Agregar cotización"}
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nueva cotización</DialogTitle>
            </DialogHeader>
            <EnhancedQuotationUploader
              purchaseOrderId={purchaseOrderId}
              workOrderId={workOrderId}
              onQuotationAdded={handleQuotationAdded}
              existingQuotations={quotations}
              compact
            />
          </DialogContent>
        </Dialog>
      ) : isViewerCoordinator ? (
        <p className="text-xs text-muted-foreground py-1">
          No puede agregar ni modificar cotizaciones: viabilidad administrativa ya registrada, la orden
          fuera de su alcance, o estado de la orden no permitido.
        </p>
      ) : null}

      <Dialog open={editingQuotation != null} onOpenChange={(o) => !o && setEditingQuotation(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar cotización</DialogTitle>
          </DialogHeader>
          {editingQuotation && (
            <EnhancedQuotationUploader
              key={editingQuotation.id}
              mode="edit"
              initialQuotation={editingQuotation}
              purchaseOrderId={purchaseOrderId}
              workOrderId={workOrderId}
              onQuotationUpdated={async () => {
                await loadQuotations()
                setEditingQuotation(null)
                router.refresh()
              }}
              existingQuotations={quotations}
              compact={false}
            />
          )}
        </DialogContent>
      </Dialog>

      {selectedQuotation && comparison?.comparison && (
        <QuotationSelectionDialog
          open={selectionDialogOpen}
          onOpenChange={setSelectionDialogOpen}
          quotation={selectedQuotation}
          comparison={comparison.comparison}
          onConfirm={handleConfirmSelection}
        />
      )}
    </div>
  )
}
