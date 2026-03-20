"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  ArrowLeft,
  Store,
  Wrench,
  Building2,
  CheckCircle,
  Package,
  ShoppingCart,
  Layers,
  Info,
} from "lucide-react"
import { PurchaseOrderType } from "@/types/purchase-orders"
import { useIsMobile } from "@/hooks/use-mobile"
import { PurchaseOrderTypeSelector } from "./PurchaseOrderTypeSelector"
import { DirectPurchaseForm } from "./DirectPurchaseForm"
import { DirectServiceForm } from "./DirectServiceForm"
import { SpecialOrderForm } from "./SpecialOrderForm"
import { OcCreationStepIndicator } from "./OcCreationStepIndicator"

interface EnhancedPurchaseOrderCreationFormProps {
  workOrderId?: string
  initialType?: string
}

enum CreationStep {
  SELECT_TYPE = 'select-type',
  WO_LINE_INTENT = 'wo-line-intent',
  FILL_FORM = 'fill-form',
  SUCCESS = 'success'
}

type WoLineSourceIntent = 'inventory' | 'mixed' | 'purchase'

export function EnhancedPurchaseOrderCreationForm({ 
  workOrderId, 
  initialType 
}: EnhancedPurchaseOrderCreationFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  
  const [currentStep, setCurrentStep] = useState<CreationStep>(CreationStep.SELECT_TYPE)
  const [selectedType, setSelectedType] = useState<PurchaseOrderType | null>(null)
  const [workOrderIdState, setWorkOrderIdState] = useState<string>("")
  const [prefillSupplier, setPrefillSupplier] = useState<string>("")
  const [woLineSourceIntent, setWoLineSourceIntent] = useState<WoLineSourceIntent | null>(null)

  const showOriginStep = useMemo(
    () =>
      !!workOrderIdState &&
      (selectedType === null ||
        selectedType === PurchaseOrderType.DIRECT_PURCHASE ||
        selectedType === PurchaseOrderType.SPECIAL_ORDER),
    [workOrderIdState, selectedType]
  )

  const advanceFromTypeSelection = useCallback(
    (type: PurchaseOrderType) => {
      setWoLineSourceIntent(null)
      const needsLineIntent =
        !!workOrderIdState &&
        (type === PurchaseOrderType.DIRECT_PURCHASE || type === PurchaseOrderType.SPECIAL_ORDER)
      setCurrentStep(needsLineIntent ? CreationStep.WO_LINE_INTENT : CreationStep.FILL_FORM)
    },
    [workOrderIdState]
  )

  useEffect(() => {
    if (initialType && Object.values(PurchaseOrderType).includes(initialType as PurchaseOrderType)) {
      setSelectedType(initialType as PurchaseOrderType)
      setCurrentStep(CreationStep.SELECT_TYPE)
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

  const stripTypeQueryFromUrl = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString())
    p.delete("type")
    p.delete("initialType")
    const q = p.toString()
    router.replace(q ? `${pathname}?${q}` : pathname)
  }, [pathname, router, searchParams])

  const handleWoLineIntentConfirm = (intent: WoLineSourceIntent) => {
    setWoLineSourceIntent(intent)
    setCurrentStep(CreationStep.FILL_FORM)
  }

  const handleBackToTypeSelection = () => {
    setSelectedType(null)
    setWoLineSourceIntent(null)
    setCurrentStep(CreationStep.SELECT_TYPE)
  }

  const handleBackFromWoLineIntent = () => {
    setSelectedType(null)
    setWoLineSourceIntent(null)
    setCurrentStep(CreationStep.SELECT_TYPE)
  }

  const handleBackFromForm = () => {
    if (
      workOrderIdState &&
      selectedType &&
      (selectedType === PurchaseOrderType.DIRECT_PURCHASE ||
        selectedType === PurchaseOrderType.SPECIAL_ORDER)
    ) {
      setWoLineSourceIntent(null)
      setCurrentStep(CreationStep.WO_LINE_INTENT)
    } else {
      handleBackToTypeSelection()
    }
  }

  const orchestratorStep = useMemo(() => {
    if (currentStep === CreationStep.SELECT_TYPE) return "select-type" as const
    if (currentStep === CreationStep.WO_LINE_INTENT) return "wo-line-intent" as const
    if (currentStep === CreationStep.FILL_FORM) return "fill-form" as const
    return "fill-form" as const
  }, [currentStep])

  const urlSuggestedTypeMatches =
    Boolean(initialType) &&
    Boolean(selectedType) &&
    Object.values(PurchaseOrderType).includes(initialType as PurchaseOrderType) &&
    selectedType === (initialType as PurchaseOrderType)

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
      {currentStep !== CreationStep.SUCCESS && (
        <OcCreationStepIndicator
          current={orchestratorStep}
          showOriginStep={showOriginStep}
          compact={isMobile}
        />
      )}

      {currentStep === CreationStep.SELECT_TYPE &&
        urlSuggestedTypeMatches &&
        initialType && (
          <Alert className="border-sky-200 bg-sky-50/80 dark:bg-sky-950/30 dark:border-sky-900/50">
            <Info className="h-4 w-4 text-sky-700 dark:text-sky-300" />
            <AlertTitle className="text-sky-950 dark:text-sky-100">
              Tipo sugerido por el enlace
            </AlertTitle>
            <AlertDescription className="text-sky-900/90 dark:text-sky-100/90 text-sm space-y-2">
              <p>
                Verifique la tarjeta resaltada y pulse <strong>Continuar</strong>. Si el enlace no aplica,
                elija otra opción o quite el parámetro de la URL.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-sky-300 text-sky-900 dark:text-sky-100"
                onClick={stripTypeQueryFromUrl}
              >
                Quitar tipo del enlace
              </Button>
            </AlertDescription>
          </Alert>
        )}

      {currentStep !== CreationStep.SELECT_TYPE && currentStep !== CreationStep.WO_LINE_INTENT && (
        <Card>
          <CardContent className={isMobile ? "py-3 px-4" : "py-4"}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackFromForm}
                  className={isMobile ? "h-10 w-10 p-0 shrink-0" : "h-8 w-8 p-0"}
                  aria-label="Volver al paso anterior"
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
          onSelectType={(type) => setSelectedType(type)}
          onContinue={() => {
            if (!selectedType) return
            advanceFromTypeSelection(selectedType)
          }}
          selectedType={selectedType || undefined}
          workOrderId={workOrderIdState}
        />
      )}

      {currentStep === CreationStep.WO_LINE_INTENT && selectedType && (
        <Card>
          <CardContent className={isMobile ? "py-4 px-4 space-y-4" : "py-6 space-y-4"}>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackFromWoLineIntent}
                className={isMobile ? "h-10 w-10 p-0 shrink-0" : "h-8 w-8 p-0"}
                aria-label="Volver al tipo de orden"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h3 className="font-medium text-sm md:text-base">Origen de las refacciones</h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Esto solo precarga las partidas; puedes ajustar cada línea después. El inventario baja al
                  registrar el surtido, no al aprobar.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-[100px] flex flex-col items-start justify-start text-left py-4 px-4 gap-1 whitespace-normal"
                onClick={() => handleWoLineIntentConfirm('inventory')}
              >
                <Package className="h-5 w-5 shrink-0 text-green-700" />
                <span className="font-medium">Surtir todo desde almacén</span>
                <span className="text-xs text-muted-foreground font-normal leading-snug">
                  Partidas con surtido interno cuando haya existencias.
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-[100px] flex flex-col items-start justify-start text-left py-4 px-4 gap-1 whitespace-normal"
                onClick={() => handleWoLineIntentConfirm('mixed')}
              >
                <Layers className="h-5 w-5 shrink-0 text-amber-700" />
                <span className="font-medium">Combinado (almacén + proveedor)</span>
                <span className="text-xs text-muted-foreground font-normal leading-snug">
                  El sistema sugerirá surtido desde almacén cuando haya stock; el resto va por compra.
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-[100px] flex flex-col items-start justify-start text-left py-4 px-4 gap-1 whitespace-normal"
                onClick={() => handleWoLineIntentConfirm('purchase')}
              >
                <ShoppingCart className="h-5 w-5 shrink-0 text-sky-700" />
                <span className="font-medium">Todo por compra</span>
                <span className="text-xs text-muted-foreground font-normal leading-snug">
                  Proveedor / cotización; sin surtido desde almacén por defecto.
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === CreationStep.FILL_FORM && selectedType && (
        <div>
          {selectedType === PurchaseOrderType.DIRECT_PURCHASE && (
            <DirectPurchaseForm
              key={`dp-${workOrderIdState || 'x'}-${woLineSourceIntent ?? 'na'}`}
              workOrderId={workOrderIdState || undefined}
              prefillSupplier={prefillSupplier || undefined}
              woLineSourceIntent={woLineSourceIntent ?? undefined}
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
              key={`so-${workOrderIdState || 'x'}-${woLineSourceIntent ?? 'na'}`}
              workOrderId={workOrderIdState || undefined}
              prefillSupplier={prefillSupplier || undefined}
              woLineSourceIntent={woLineSourceIntent ?? undefined}
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