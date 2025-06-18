"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  ArrowLeft, 
  Store, 
  Wrench, 
  Building2,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import { PurchaseOrderType } from "@/types/purchase-orders"
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
  
  const [currentStep, setCurrentStep] = useState<CreationStep>(CreationStep.SELECT_TYPE)
  const [selectedType, setSelectedType] = useState<PurchaseOrderType | null>(null)
  const [workOrderIdState, setWorkOrderIdState] = useState<string>("")

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

  const needsWorkOrderId = !workOrderIdState && currentStep !== CreationStep.SELECT_TYPE

  if (needsWorkOrderId) {
    return (
      <div className="max-w-md mx-auto">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-3">
              <p>Se requiere una orden de trabajo para crear la orden de compra.</p>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push('/ordenes')}
                >
                  Seleccionar Orden de Trabajo
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push('/compras')}
                >
                  Volver a Compras
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {currentStep !== CreationStep.SELECT_TYPE && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToTypeSelection}
                  className="h-8 w-8 p-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                
                {selectedType && (
                  <div className="flex items-center space-x-3">
                    {(() => {
                      const typeInfo = getTypeInfo(selectedType)
                      const Icon = typeInfo.icon
                      return (
                        <>
                          <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-medium">{typeInfo.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {typeInfo.description}
                            </p>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>

              {workOrderIdState && (
                <Badge variant="outline">
                  Orden: {workOrderIdState}
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

      {currentStep === CreationStep.FILL_FORM && selectedType && workOrderIdState && (
        <div>
          {selectedType === PurchaseOrderType.DIRECT_PURCHASE && (
            <DirectPurchaseForm
              workOrderId={workOrderIdState}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          )}
          
          {selectedType === PurchaseOrderType.DIRECT_SERVICE && (
            <DirectServiceForm
              workOrderId={workOrderIdState}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          )}

          {selectedType === PurchaseOrderType.SPECIAL_ORDER && (
            <SpecialOrderForm
              workOrderId={workOrderIdState}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          )}
        </div>
      )}

      {currentStep === CreationStep.SUCCESS && (
        <div className="text-center py-12">
          <CheckCircle className="h-16 w-16 mx-auto text-green-600 mb-4" />
          <h3 className="text-lg font-medium mb-2">¡Orden de Compra Creada!</h3>
          <p className="text-muted-foreground mb-4">
            Tu orden de compra ha sido creada exitosamente. Serás redirigido automáticamente.
          </p>
          <div className="flex justify-center space-x-3">
            <Button variant="outline" onClick={() => router.push('/compras')}>
              Ver Todas las Compras
            </Button>
            <Button onClick={() => router.push(`/ordenes/${workOrderIdState}`)}>
              Volver a Orden de Trabajo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
} 