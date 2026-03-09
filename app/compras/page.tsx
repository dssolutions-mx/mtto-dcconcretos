"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Store, Wrench, Building2, Sparkles, Loader2, Receipt, DollarSign, Shield, CheckCircle, AlertTriangle } from "lucide-react"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { useIsMobile } from "@/hooks/use-mobile"
import { formatCurrency } from "@/lib/utils"
import { AccountsPayableSummaryCard } from "@/components/purchase-orders/AccountsPayableSummaryCard"
import { ComprasMobileInfoDrawer } from "@/components/compras/ComprasMobileInfoDrawer"

const PurchaseOrdersList = dynamic(
  () => import("@/components/work-orders/purchase-orders-list").then(m => ({ default: m.PurchaseOrdersList })),
  {
    loading: () => (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Cargando órdenes de compra...</span>
        </div>
      </div>
    ),
    ssr: false,
  }
)

/** Handles toast from ?action=approved|rejected|error - isolated so main page doesn't suspend on useSearchParams */
function ComprasToastFromParams() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  useEffect(() => {
    const action = searchParams.get('action')
    const poId = searchParams.get('po')
    if (!action) return
    if (action === 'approved') {
      toast({ title: 'Orden aprobada', description: `La orden de compra fue aprobada correctamente${poId ? ` (${poId})` : ''}.` })
    } else if (action === 'rejected') {
      toast({ title: 'Orden rechazada', description: `La orden de compra fue rechazada${poId ? ` (${poId})` : ''}.`, variant: 'destructive' })
    } else if (action === 'error') {
      toast({ title: 'Error en acción', description: 'No fue posible procesar la acción solicitada.', variant: 'destructive' })
    }
  }, [searchParams, toast])
  return null
}

export default function PurchaseOrdersPage() {
  return (
    <>
      <Suspense fallback={null}>
        <ComprasToastFromParams />
      </Suspense>
      <PurchaseOrdersPageContent />
    </>
  )
}

function PurchaseOrdersPageContent() {
  const { profile, hasCreateAccess, authorizationLimit, refreshProfile } = useAuthZustand()
  const [effectiveAuthLimit, setEffectiveAuthLimit] = useState<number>(0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)

  // Load effective authorization limit via single-user API (fast, no full org fetch)
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

        // Single-user path returns user_summary + authorization_scopes
        const apiLimit =
          data.user_summary?.effective_global_authorization != null
            ? parseFloat(data.user_summary.effective_global_authorization)
            : data.authorization_scopes?.find((s: { scope_type: string }) => s.scope_type === 'global')
                ?.effective_authorization ?? 0

        if (apiLimit > 0 || data.user_summary != null) {
          setEffectiveAuthLimit(apiLimit)

          // Auto-refresh profile if API limit differs from cached profile
          const profileLimit = profile.can_authorize_up_to || 0
          const limitInconsistent = Math.abs(profileLimit - apiLimit) > 0.01
          const roleInconsistent =
            data.user_summary?.role != null && data.user_summary.role !== profile.role

          if ((limitInconsistent || roleInconsistent) && typeof refreshProfile === 'function') {
            try {
              await refreshProfile()
            } catch {
              /* ignore */
            }
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

  const displayLimit = effectiveAuthLimit || authorizationLimit
  
  // ✅ NUEVO SISTEMA: Validación dinámica para creación de órdenes
  const canCreateOrders = profile && hasCreateAccess('purchases')
  
  // ✅ NUEVO SISTEMA: Validación dinámica para aprobación
  const canApproveOrders = profile && displayLimit > 0
  
  // Determinar capacidades del usuario
  const getUserCapabilities = () => {
    if (!profile) return { canCreate: false, canApprove: false, role: '', limit: 0 }
    
    return {
      canCreate: canCreateOrders,
      canApprove: displayLimit > 0,
      role: profile.role,
      limit: displayLimit
    }
  }
  
  const userCapabilities = getUserCapabilities()
  const isMobile = useIsMobile()
  const isAdmin = profile && (profile.role === 'GERENCIA_GENERAL' || profile.role === 'AREA_ADMINISTRATIVA')

  if (isMobile) {
    return (
      <DashboardShell>
        {/* Mobile: Compact sticky header */}
        <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-4 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold truncate">Órdenes de Compra</h1>
              <p className="text-xs text-muted-foreground truncate">
                Gestiona las órdenes generadas a partir de órdenes de trabajo
              </p>
            </div>
            <ComprasMobileInfoDrawer
              profile={profile}
              userCapabilities={userCapabilities}
              isLoadingAuth={isLoadingAuth}
              canCreateOrders={canCreateOrders ?? false}
              isAdmin={!!isAdmin}
            />
          </div>
        </div>

        {/* Mobile: PO list first (above the fold) */}
        <PurchaseOrdersList effectiveAuthLimitFromParent={displayLimit} isLoadingAuthFromParent={isLoadingAuth} />

        {/* Mobile: FAB for Nueva Orden */}
        {canCreateOrders && (
          <Link
            href="/compras/crear-tipificada"
            className="fixed z-50 flex items-center justify-center w-14 h-14 rounded-full bg-sky-700 text-white shadow-lg hover:bg-sky-800 transition-colors duration-200 cursor-pointer min-h-[56px] min-w-[56px] right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))]"
            aria-label="Nueva Orden Tipificada"
          >
            <Plus className="h-6 w-6" />
          </Link>
        )}
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <DashboardHeader
          heading="Órdenes de Compra"
          text="Gestiona las órdenes de compra generadas a partir de órdenes de trabajo."
          id="compras-header"
        />
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full md:w-auto">
          {profile && hasCreateAccess('purchases') && (
            <Link href="/compras/comprobantes">
              <Button variant="outline" className="w-full sm:w-auto">
                <Receipt className="mr-2 h-4 w-4" />
                Ver Comprobantes
              </Button>
            </Link>
          )}
          {profile && (profile.role === 'GERENCIA_GENERAL' || profile.role === 'AREA_ADMINISTRATIVA') && (
            <Link href="/compras/cuentas-por-pagar">
              <Button variant="outline" className="w-full sm:w-auto bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100">
                <DollarSign className="mr-2 h-4 w-4" />
                Cuentas por Pagar
              </Button>
            </Link>
          )}
          {canCreateOrders && (
            <Link href="/compras/crear-tipificada">
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Orden Tipificada
              </Button>
            </Link>
          )}
        </div>
      </div>

      {profile && (
        <Card className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Shield className="h-6 w-6 text-blue-600" />
                <div>
                  <CardTitle className="text-lg">Tus Capacidades de Compras</CardTitle>
                  <CardDescription>
                    {profile.role?.replace(/_/g, ' ')} - {profile.nombre} {profile.apellido}
                  </CardDescription>
                </div>
              </div>
              <div className="flex space-x-2">
                {userCapabilities.canCreate && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Puede Crear
                  </Badge>
                )}
                {userCapabilities.canApprove && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    <Shield className="h-3 w-3 mr-1" />
                    Puede Aprobar
                  </Badge>
                )}
                {!userCapabilities.canCreate && !userCapabilities.canApprove && (
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Solo Lectura
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/60">
                <Plus className="h-8 w-8 text-blue-600" />
                <div>
                  <h4 className="font-medium">Crear Órdenes</h4>
                  <p className="text-sm text-muted-foreground">
                    {userCapabilities.canCreate ? 'Permitido' : 'No permitido'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/60">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <h4 className="font-medium">Límite de Aprobación</h4>
                  <p className="text-sm font-semibold">
                    {isLoadingAuth ? 'Cargando...' : (
                      userCapabilities.limit === Number.MAX_SAFE_INTEGER 
                        ? 'Sin límite' 
                        : userCapabilities.limit > 0 
                          ? formatCurrency(userCapabilities.limit)
                          : 'No puede aprobar'
                    )}
                  </p>
                  {!isLoadingAuth && (
                    <p className="text-xs text-green-600">
                      ✓ Fuente: Sistema de autorización dinámico
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/60">
                <Shield className="h-8 w-8 text-purple-600" />
                <div>
                  <h4 className="font-medium">Rol y Alcance</h4>
                  <p className="text-sm text-muted-foreground">
                    {profile.business_units?.name || profile.plants?.name || 'Sistema'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-100 rounded-lg">
              <p className="text-sm text-blue-800">
                {userCapabilities.canCreate && userCapabilities.canApprove && (
                  <><strong>Capacidades completas:</strong> Puedes crear y aprobar órdenes de compra hasta {formatCurrency(userCapabilities.limit)}. Para montos mayores, se requiere autorización de un superior.</>
                )}
                {userCapabilities.canCreate && !userCapabilities.canApprove && (
                  <><strong>Solo creación:</strong> Puedes crear órdenes de compra que serán enviadas para aprobación de tus superiores.</>
                )}
                {!userCapabilities.canCreate && userCapabilities.canApprove && (
                  <><strong>Solo aprobación:</strong> Puedes aprobar órdenes de compra hasta {formatCurrency(userCapabilities.limit)}.</>
                )}
                {!userCapabilities.canCreate && !userCapabilities.canApprove && (
                  <><strong>Solo consulta:</strong> Puedes ver las órdenes de compra pero no crear ni aprobar nuevas órdenes.</>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {profile && (profile.role === 'GERENCIA_GENERAL' || profile.role === 'AREA_ADMINISTRATIVA') && (
        <AccountsPayableSummaryCard />
      )}

      <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Sistema de Órdenes de Compra Mejorado</CardTitle>
                <CardDescription>
                  Nuevo sistema inteligente con 3 tipos de órdenes para máxima eficiencia operativa
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              Nuevo
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/60">
              <Store className="h-8 w-8 text-blue-600" />
              <div>
                <h4 className="font-medium">Compra Directa</h4>
                <p className="text-sm text-muted-foreground">
                  Ferretería, tienda local - Sin cotización
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/60">
              <Wrench className="h-8 w-8 text-green-600" />
              <div>
                <h4 className="font-medium">Servicio Directo</h4>
                <p className="text-sm text-muted-foreground">
                  Técnico especialista - Cotización si &gt;$10k
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/60">
              <Building2 className="h-8 w-8 text-purple-600" />
              <div>
                <h4 className="font-medium">Pedido Especial</h4>
                <p className="text-sm text-muted-foreground">
                  Proveedor formal - Siempre cotización
                </p>
              </div>
            </div>
          </div>

          {canCreateOrders && (
            <div className="flex justify-center pt-4">
              <Link href="/compras/crear-tipificada">
                <Button size="lg" className="min-w-[200px]">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Orden Tipificada
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <PurchaseOrdersList effectiveAuthLimitFromParent={displayLimit} isLoadingAuthFromParent={isLoadingAuth} />
    </DashboardShell>
  )
} 