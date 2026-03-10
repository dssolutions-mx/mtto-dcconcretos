"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  Store, 
  Wrench, 
  Building2,
  CheckCircle
} from "lucide-react"
import { PurchaseOrderType } from "@/types/purchase-orders"
import { useIsMobile } from "@/hooks/use-mobile"
import { PurchaseOrderTypeSelector } from "./PurchaseOrderTypeSelector"
import { DirectPurchaseForm } from "./DirectPurchaseForm"
import { DirectServiceForm } from "./DirectServiceForm"
import { SpecialOrderForm } from "./SpecialOrderForm"

interface EnhancedPurchaseOrderCreationFormProps {
  workOrderId?: string
  initialType?: string
}

enum CreationStep {
  SELECT_TYPE = 'select-type',
  FILL_FORM = 'fill-form',
  SUCCESS = 'success'
}

export function EnhancedPurchaseOrderCreationForm({ 
  workOrderId, 
  initialType 
}: EnhancedPurchaseOrderCreationFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  
  const [currentStep, setCurrentStep] = useState<CreationStep>(CreationStep.SELECT_TYPE)
  const [selectedType, setSelectedType] = useState<PurchaseOrderType | null>(null)
  const [workOrderIdState, setWorkOrderIdState] = useState<string>("")
  const [prefillSupplier, setPrefillSupplier] = useState<string>("")

  useEffect(() => {
    if (initialType && Object.values(PurchaseOrderType).includes(initialType as PurchaseOrderType)) {
      setSelectedType(initialType as PurchaseOrderType)
      setCurrentStep(CreationStep.FILL_FORM)
    }
    
    if (workOrderId) {
      setWorkOrderIdState(workOrderId)
    } else {
      const woId = searchParams.get('workOrderId')
      if (woId) {
        setWorkOrderIdState(woId)
      }
    }

    const prefill = searchParams.get('prefillSupplier')
    if (prefill) setPrefillSupplier(prefill)
  }, [initialType, workOrderId, searchParams])

  const handleTypeSelected = (type: PurchaseOrderType) => {
    setSelectedType(type)
    setCurrentStep(CreationStep.FILL_FORM)
  }

  const handleBackToTypeSelection = () => {
    setSelectedType(null)
    setCurrentStep(CreationStep.SELECT_TYPE)
  }

  const handleFormSuccess = (purchaseOrderId: string) => {
    setCurrentStep(CreationStep.SUCCESS)
    setTimeout(() => {
      router.push(`/compras/${purchaseOrderId}`)
    }, 2000)
  }

  const handleFormCancel = () => {
    if (workOrderIdState) {
      router.push(`/ordenes/${workOrderIdState}`)
    } else {
      router.push('/compras')
    }
  }

  const getTypeInfo = (type: PurchaseOrderType) => {
    switch (type) {
      case PurchaseOrderType.DIRECT_PURCHASE:
        return {
          title: "Compra Directa",
          icon: Store,
          color: "bg-blue-50 text-blue-700 border-blue-200",
          description: "Ferretería, tienda local, refacciones básicas"
        }
      case PurchaseOrderType.DIRECT_SERVICE:
        return {
          title: "Servicio Directo",
          icon: Wrench,
          color: "bg-green-50 text-green-700 border-green-200",
          description: "Técnico especialista, servicio rápido"
        }
      case PurchaseOrderType.SPECIAL_ORDER:
        return {
          title: "Pedido Especial",
          icon: Building2,
          color: "bg-purple-50 text-purple-700 border-purple-200",
          description: "Agencia, proveedor formal, partes especiales"
        }
    }
  }

  // Work order is now optional - allow standalone purchase orders

  return (
    <div className="space-y-6">
      {currentStep !== CreationStep.SELECT_TYPE && (
        <Card>
          <CardContent className={isMobile ? "py-3 px-4" : "py-4"}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToTypeSelection}
                  className={isMobile ? "h-10 w-10 p-0 shrink-0" : "h-8 w-8 p-0"}
                  aria-label="Volver al selector de tipo"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                
                {selectedType && (
                  <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
                    {(() => {
                      const typeInfo = getTypeInfo(selectedType)
                      const Icon = typeInfo.icon
                      return (
                        <>
                          <div className={`p-1.5 md:p-2 rounded-lg shrink-0 ${typeInfo.color}`}>
                            <Icon className="h-4 w-4 md:h-5 md:w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-sm md:text-base truncate">{typeInfo.title}</h3>
                            {!isMobile && (
                              <p className="text-sm text-muted-foreground truncate">
                                {typeInfo.description}
                              </p>
                            )}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>

              {workOrderIdState ? (
                <Badge variant="outline" className="shrink-0 text-xs">
                  Orden: {workOrderIdState}
                </Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  Independiente
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === CreationStep.SELECT_TYPE && (
        <PurchaseOrderTypeSelector
          onTypeSelected={handleTypeSelected}
          selectedType={selectedType || undefined}
          workOrderId={workOrderIdState}
        />
      )}

      {currentStep === CreationStep.FILL_FORM && selectedType && (
        <div>
          {selectedType === PurchaseOrderType.DIRECT_PURCHASE && (
            <DirectPurchaseForm
              workOrderId={workOrderIdState || undefined}
              prefillSupplier={prefillSupplier || undefined}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          )}
          
          {selectedType === PurchaseOrderType.DIRECT_SERVICE && (
            <DirectServiceForm
              workOrderId={workOrderIdState || undefined}
              prefillSupplier={prefillSupplier || undefined}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          )}

          {selectedType === PurchaseOrderType.SPECIAL_ORDER && (
            <SpecialOrderForm
              workOrderId={workOrderIdState || undefined}
              prefillSupplier={prefillSupplier || undefined}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          )}
        </div>
      )}

      {currentStep === CreationStep.SUCCESS && (
        <div className="text-center py-8 md:py-12">
          <CheckCircle className="h-14 w-14 md:h-16 md:w-16 mx-auto text-green-600 mb-4" />
          <h3 className="text-lg font-medium mb-2">¡Orden de Compra Creada!</h3>
          <p className="text-muted-foreground mb-4 text-sm md:text-base">
            Tu orden de compra ha sido creada exitosamente. Serás redirigido automáticamente.
          </p>
          <div className={`flex gap-3 ${isMobile ? "flex-col" : "justify-center"}`}>
            <Button 
              variant="outline" 
              onClick={() => router.push('/compras')} 
              className={isMobile ? "w-full min-h-[44px]" : ""}
            >
              Ver Todas las Compras
            </Button>
            {workOrderIdState ? (
              <Button 
                onClick={() => router.push(`/ordenes/${workOrderIdState}`)}
                className={isMobile ? "w-full min-h-[44px]" : ""}
              >
                Volver a Orden de Trabajo
              </Button>
            ) : (
              <Button 
                onClick={() => router.push('/compras')}
                className={isMobile ? "w-full min-h-[44px]" : ""}
              >
                Ver Todas las Compras
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 