"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, Receipt, DollarSign } from "lucide-react"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { useIsMobile } from "@/hooks/use-mobile"
import { ComprasMobileInfoDrawer } from "@/components/compras/ComprasMobileInfoDrawer"
import { ComprasDesktopInfoDrawer } from "@/components/compras/ComprasDesktopInfoDrawer"

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
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full md:w-auto items-stretch sm:items-center">
          {profile && (
            <ComprasDesktopInfoDrawer
              profile={profile}
              userCapabilities={userCapabilities}
              isLoadingAuth={isLoadingAuth}
              canCreateOrders={canCreateOrders ?? false}
              isAdmin={!!isAdmin}
            />
          )}
          {profile && hasCreateAccess('purchases') && (
            <Link href="/compras/comprobantes">
              <Button variant="outline" className="w-full sm:w-auto cursor-pointer">
                <Receipt className="mr-2 h-4 w-4" />
                Ver Comprobantes
              </Button>
            </Link>
          )}
          {profile && (profile.role === 'GERENCIA_GENERAL' || profile.role === 'AREA_ADMINISTRATIVA') && (
            <Link href="/compras/cuentas-por-pagar">
              <Button variant="outline" className="w-full sm:w-auto bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 cursor-pointer">
                <DollarSign className="mr-2 h-4 w-4" />
                Cuentas por Pagar
              </Button>
            </Link>
          )}
          {canCreateOrders && (
            <Link href="/compras/crear-tipificada">
              <Button className="w-full sm:w-auto cursor-pointer">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Orden Tipificada
              </Button>
            </Link>
          )}
        </div>
      </div>

      <PurchaseOrdersList effectiveAuthLimitFromParent={displayLimit} isLoadingAuthFromParent={isLoadingAuth} />
    </DashboardShell>
  )
} 