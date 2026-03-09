"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Info, ChevronDown, Shield, CheckCircle, AlertTriangle, DollarSign, ExternalLink, Receipt, Sparkles } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { AccountsPayableSummary } from "@/types/purchase-orders"
import { cn } from "@/lib/utils"

interface UserCapabilities {
  canCreate: boolean
  canApprove: boolean
  role: string
  limit: number
}

interface ComprasMobileInfoDrawerProps {
  profile: {
    role?: string
    nombre?: string
    apellido?: string
    business_units?: { name?: string }
    plants?: { name?: string }
  } | null
  userCapabilities: UserCapabilities
  isLoadingAuth: boolean
  canCreateOrders: boolean
  isAdmin: boolean
}

export function ComprasMobileInfoDrawer({
  profile,
  userCapabilities,
  isLoadingAuth,
  canCreateOrders,
  isAdmin,
}: ComprasMobileInfoDrawerProps) {
  const [open, setOpen] = useState(false)
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false)
  const [apSummary, setApSummary] = useState<AccountsPayableSummary | null>(null)
  const [apLoading, setApLoading] = useState(false)

  useEffect(() => {
    if (open && isAdmin) {
      setApLoading(true)
      fetch('/api/purchase-orders/accounts-payable?limit=10')
        .then((res) => res.json())
        .then((result) => {
          if (result.success) setApSummary(result.data.summary)
        })
        .catch(console.error)
        .finally(() => setApLoading(false))
    }
  }, [open, isAdmin])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px] gap-2 cursor-pointer border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors duration-200"
        >
          <Info className="h-4 w-4" />
          Información
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl shadow-xl max-h-[85dvh] overflow-y-auto transition-transform duration-300 ease-out"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Información del sistema</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-2">
          {/* User Capabilities */}
          {profile && (
            <Collapsible open={capabilitiesOpen} onOpenChange={setCapabilitiesOpen}>
              <div className="rounded-xl border bg-slate-50/80 p-4">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer min-h-[44px]">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-50 shrink-0">
                        <Shield className="h-5 w-5 text-sky-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {profile.role?.replace(/_/g, ' ')} - {profile.nombre} {profile.apellido}
                        </p>
                        <p className="text-sm text-slate-600 truncate">
                          Límite: {isLoadingAuth ? '...' : userCapabilities.limit === Number.MAX_SAFE_INTEGER ? 'Sin límite' : userCapabilities.limit > 0 ? formatCurrency(userCapabilities.limit) : 'No puede aprobar'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {userCapabilities.canCreate && (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Crear
                          </Badge>
                        )}
                        {userCapabilities.canApprove && (
                          <Badge className="bg-blue-100 text-blue-700">
                            <Shield className="h-3 w-3 mr-1" />
                            Aprobar
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
                    <ChevronDown
                      className={cn("h-5 w-5 text-slate-500 transition-transform duration-200", capabilitiesOpen && "rotate-180")}
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 text-sm text-slate-600">
                    <p><strong>Rol y Alcance:</strong> {profile.business_units?.name || profile.plants?.name || 'Sistema'}</p>
                    {userCapabilities.canCreate && userCapabilities.canApprove && (
                      <p>Puedes crear y aprobar órdenes hasta {formatCurrency(userCapabilities.limit)}.</p>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Accounts Payable - Admins only */}
          {isAdmin && (
            <div className="rounded-xl border bg-orange-50/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <DollarSign className="h-5 w-5 text-orange-600 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-900">Cuentas por Pagar</p>
                    {apLoading ? (
                      <p className="text-sm text-slate-600">Cargando...</p>
                    ) : apSummary ? (
                      <p className="text-sm font-semibold text-slate-900">
                        {apSummary.total_overdue > 0 && `${apSummary.total_overdue} vencidos`}
                        {apSummary.total_overdue > 0 && apSummary.items_due_today > 0 && ' · '}
                        {apSummary.items_due_today > 0 && `${apSummary.items_due_today} vencen hoy`}
                        {apSummary.total_overdue === 0 && apSummary.items_due_today === 0 && 'Sin vencimientos urgentes'}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600">Sin datos</p>
                    )}
                  </div>
                </div>
                <Link href="/compras/cuentas-por-pagar" onClick={() => setOpen(false)}>
                  <Button variant="outline" size="sm" className="shrink-0 min-h-[44px] text-sky-700 border-sky-200 hover:bg-sky-50 cursor-pointer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ver Detalle
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Enhanced PO System - single line */}
          {canCreateOrders && (
            <Link
              href="/compras/crear-tipificada"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl border bg-blue-50/50 p-4 transition-colors hover:bg-blue-50 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-blue-100 shrink-0">
                <Sparkles className="h-5 w-5 text-sky-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900">Sistema de Órdenes Tipificadas</p>
                <p className="text-sm text-slate-600">Compra Directa · Servicio Directo · Pedido Especial</p>
              </div>
              <span className="text-sm font-medium text-sky-700 shrink-0">Crear →</span>
            </Link>
          )}

          {/* Secondary actions */}
          <div className="flex flex-col gap-2 pt-2">
            {profile && canCreateOrders && (
              <Link href="/compras/comprobantes" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full min-h-[44px] justify-start gap-2 cursor-pointer">
                  <Receipt className="h-4 w-4" />
                  Ver Comprobantes
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link href="/compras/cuentas-por-pagar" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full min-h-[44px] justify-start gap-2 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 cursor-pointer">
                  <DollarSign className="h-4 w-4" />
                  Cuentas por Pagar
                </Button>
              </Link>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
