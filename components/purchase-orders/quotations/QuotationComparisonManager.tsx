"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EnhancedQuotationUploader } from "./EnhancedQuotationUploader"
import { QuotationComparisonTable } from "./QuotationComparisonTable"
import { QuotationComparisonCard } from "./QuotationComparisonCard"
import { QuotationSelectionDialog } from "./QuotationSelectionDialog"
import { PurchaseOrderQuotation, QuotationComparisonResponse, QuotationStatus } from "@/types/purchase-orders"
import { QuotationService } from "@/lib/services/quotation-service"
import { toast } from "sonner"
import { AlertCircle, CheckCircle2, FileText, Grid3x3, List } from "lucide-react"
import { useRouter } from "next/navigation"

interface QuotationComparisonManagerProps {
  purchaseOrderId: string
  workOrderId?: string
  quotationSelectionRequired?: boolean
  quotationSelectionStatus?: string
  poPurpose?: string
  className?: string
}

export function QuotationComparisonManager({
  purchaseOrderId,
  workOrderId,
  quotationSelectionRequired = false,
  quotationSelectionStatus,
  poPurpose,
  className = ""
}: QuotationComparisonManagerProps) {
  const router = useRouter()
  const [quotations, setQuotations] = useState<PurchaseOrderQuotation[]>([])
  const [comparison, setComparison] = useState<QuotationComparisonResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null)
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  // Skip if using inventory (no purchase needed)
  if (poPurpose === 'work_order_inventory') {
    return null
  }

  useEffect(() => {
    loadQuotations()
  }, [purchaseOrderId])

  const loadQuotations = async () => {
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
  }

  const handleQuotationAdded = async (quotation: PurchaseOrderQuotation) => {
    await loadQuotations()
  }

  const handleQuotationRemoved = async (quotationId: string) => {
    await loadQuotations()
  }

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

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">Cargando cotizaciones...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Comparación de Cotizaciones</span>
              </CardTitle>
              <CardDescription>
                Compare cotizaciones de diferentes proveedores y seleccione el ganador
              </CardDescription>
            </div>
            {quotationSelectionStatus === 'selected' && selectedQuotationData && (
              <Badge className="bg-green-600">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Proveedor Seleccionado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Alerts */}
          {quotationSelectionRequired && (
            <>
              {quotationSelectionStatus === 'pending_quotations' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Se requieren al menos 2 cotizaciones antes de poder seleccionar un proveedor.
                    Agregue más cotizaciones usando el formulario a continuación.
                  </AlertDescription>
                </Alert>
              )}
              
              {quotationSelectionStatus === 'pending_selection' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Acción Requerida:</strong> Debe seleccionar un proveedor de las cotizaciones
                    antes de solicitar aprobación de la orden de compra.
                  </AlertDescription>
                </Alert>
              )}
              
              {quotationSelectionStatus === 'selected' && selectedQuotationData && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900">
                    <strong>Proveedor Seleccionado:</strong> {selectedQuotationData.supplier_name}
                    {selectedQuotationData.selection_reason && (
                      <div className="mt-2 text-sm">
                        <strong>Razón:</strong> {selectedQuotationData.selection_reason}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Quotations Display */}
          {quotations.length > 0 ? (
            <Tabs defaultValue="table" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="table" onClick={() => setViewMode('table')}>
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    Tabla
                  </TabsTrigger>
                  <TabsTrigger value="cards" onClick={() => setViewMode('cards')}>
                    <List className="h-4 w-4 mr-2" />
                    Tarjetas
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="table">
                {comparison?.comparison && (
                  <QuotationComparisonTable
                    comparison={comparison.comparison}
                    onSelect={quotationSelectionStatus === 'pending_selection' ? handleSelectQuotation : undefined}
                    onViewFile={(id) => {
                      const q = quotations.find(qu => qu.id === id)
                      if (q?.file_url) {
                        window.open(q.file_url, '_blank')
                      }
                    }}
                  />
                )}
              </TabsContent>

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
                        showActions={quotationSelectionStatus === 'pending_selection'}
                      />
                    )
                  })}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No hay cotizaciones agregadas aún. Use el formulario a continuación para agregar la primera cotización.
              </AlertDescription>
            </Alert>
          )}

          {/* Add Quotation Form */}
          <EnhancedQuotationUploader
            purchaseOrderId={purchaseOrderId}
            workOrderId={workOrderId}
            onQuotationAdded={handleQuotationAdded}
            onQuotationRemoved={handleQuotationRemoved}
            existingQuotations={quotations}
          />
        </CardContent>
      </Card>

      {/* Selection Dialog */}
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
