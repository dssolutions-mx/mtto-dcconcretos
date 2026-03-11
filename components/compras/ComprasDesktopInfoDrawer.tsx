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
import { Info, Shield, CheckCircle, AlertTriangle, DollarSign, ExternalLink, Receipt, Sparkles, Store, Wrench, Building2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { AccountsPayableSummary } from "@/types/purchase-orders"

interface UserCapabilities {
  canCreate: boolean
  canApprove: boolean
  role: string
  limit: number
}

interface ComprasDesktopInfoDrawerProps {
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

export function ComprasDesktopInfoDrawer({
  profile,
  userCapabilities,
  isLoadingAuth,
  canCreateOrders,
  isAdmin,
}: ComprasDesktopInfoDrawerProps) {
  const [open, setOpen] = useState(false)
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
          className="gap-2 cursor-pointer border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors duration-200"
        >
          <Info className="h-4 w-4" />
          Información
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto transition-transform duration-300 ease-out"
      >
        <SheetHeader>
          <SheetTitle>Información del sistema</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 pt-6">
          {/* User Capabilities - Tus Capacidades de Compras */}
          {profile && (
            <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-slate-900">Tus Capacidades de Compras</h3>
                    <p className="text-sm text-slate-600">
                      {profile.role?.replace(/_/g, ' ')} - {profile.nombre} {profile.apellido}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {userCapabilities.canCreate && (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Puede Crear
                    </Badge>
                  )}
                  {userCapabilities.canApprove && (
                    <Badge className="bg-blue-100 text-blue-700">
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
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/60">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-sm">Crear Órdenes</h4>
                    <p className="text-sm text-slate-600">
                      {userCapabilities.canCreate ? 'Permitido' : 'No permitido'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/60">
                  <DollarSign className="h-6 w-6 text-green-600" />
                  <div>
                    <h4 className="font-medium text-sm">Límite de Aprobación</h4>
                    <p className="text-sm font-semibold">
                      {isLoadingAuth ? 'Cargando...' : (
                        userCapabilities.limit === Number.MAX_SAFE_INTEGER
                          ? 'Sin límite'
                          : userCapabilities.limit > 0
                            ? formatCurrency(userCapabilities.limit)
                            : 'No puede aprobar'
                      )}
                    </p>
                    {!isLoadingAuth && userCapabilities.limit > 0 && (
                      <p className="text-xs text-green-600">Fuente: Sistema de autorización dinámico</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/60">
                  <Shield className="h-6 w-6 text-purple-600" />
                  <div>
                    <h4 className="font-medium text-sm">Rol y Alcance</h4>
                    <p className="text-sm text-slate-600">
                      {profile.business_units?.name || profile.plants?.name || 'Sistema'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <p className="text-sm text-blue-800">
                  {userCapabilities.canCreate && userCapabilities.canApprove && (
                    <><strong>Capacidades completas:</strong> Puedes crear y aprobar órdenes hasta {formatCurrency(userCapabilities.limit)}. Para montos mayores, se requiere autorización de un superior.</>
                  )}
                  {userCapabilities.canCreate && !userCapabilities.canApprove && (
                    <><strong>Solo creación:</strong> Puedes crear órdenes que serán enviadas para aprobación de tus superiores.</>
                  )}
                  {!userCapabilities.canCreate && userCapabilities.canApprove && (
                    <><strong>Solo aprobación:</strong> Puedes aprobar órdenes hasta {formatCurrency(userCapabilities.limit)}.</>
                  )}
                  {!userCapabilities.canCreate && !userCapabilities.canApprove && (
                    <><strong>Solo consulta:</strong> Puedes ver las órdenes pero no crear ni aprobar.</>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Accounts Payable - Admins only */}
          {isAdmin && (
            <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
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
                  <Button variant="outline" size="sm" className="shrink-0 text-sky-700 border-sky-200 hover:bg-sky-50 cursor-pointer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ver Detalle
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Sistema de Órdenes de Compra Mejorado */}
          <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Sistema de Órdenes Tipificadas</h3>
                  <p className="text-sm text-slate-600">3 tipos para máxima eficiencia operativa</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                Nuevo
              </Badge>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/60">
                <Store className="h-5 w-5 text-blue-600 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Compra Directa</p>
                  <p className="text-xs text-slate-600">Ferretería, tienda local - Sin cotización</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/60">
                <Wrench className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Servicio Directo</p>
                  <p className="text-xs text-slate-600">Técnico especialista - Cotización si {'>'} $10k</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/60">
                <Building2 className="h-5 w-5 text-purple-600 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Pedido Especial</p>
                  <p className="text-xs text-slate-600">Proveedor formal - Siempre cotización</p>
                </div>
              </div>
            </div>
            {canCreateOrders && (
              <div className="mt-4">
                <Link href="/compras/crear-tipificada" onClick={() => setOpen(false)}>
                  <Button className="w-full bg-sky-700 hover:bg-sky-800 cursor-pointer">
                    Crear Orden Tipificada
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Secondary actions */}
          <div className="flex flex-col gap-2 pt-2">
            {profile && canCreateOrders && (
              <Link href="/compras/comprobantes" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full justify-start gap-2 cursor-pointer">
                  <Receipt className="h-4 w-4" />
                  Ver Comprobantes
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link href="/compras/cuentas-por-pagar" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full justify-start gap-2 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 cursor-pointer">
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
