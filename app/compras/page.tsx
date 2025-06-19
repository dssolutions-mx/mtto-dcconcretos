"use client"

import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { PurchaseOrdersList } from "@/components/work-orders/purchase-orders-list"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Store, Wrench, Building2, Sparkles, Loader2, Receipt, DollarSign, Shield } from "lucide-react"
import { RoleGuard } from "@/components/auth/role-guard"
import { useAuth } from "@/components/auth/auth-provider"
import { formatCurrency } from "@/lib/utils"

// export const metadata: Metadata = {
//   title: "Órdenes de Compra | Sistema de Gestión de Mantenimiento",
//   description: "Lista y gestión de órdenes de compra",
// }

function PurchaseOrdersListFallback() {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="flex items-center space-x-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Cargando órdenes de compra...</span>
      </div>
    </div>
  )
}

export default function PurchaseOrdersPage() {
  const { profile, hasAuthorizationAccess, authorizationLimit } = useAuth()
  const canAuthorize = hasAuthorizationAccess('purchases')
  return (
    <DashboardShell>
      <div className="flex justify-between items-center mb-6">
        <DashboardHeader
          heading="Órdenes de Compra"
          text="Gestiona las órdenes de compra generadas a partir de órdenes de trabajo."
        />
        <div className="flex space-x-2">
          <RoleGuard module="purchases">
            <Link href="/compras/comprobantes">
              <Button variant="outline">
                <Receipt className="mr-2 h-4 w-4" />
                Ver Comprobantes
              </Button>
            </Link>
          </RoleGuard>
          <RoleGuard module="purchases" requireCreate>
            <Link href="/compras/crear-tipificada">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Orden Tipificada
              </Button>
            </Link>
          </RoleGuard>
        </div>
      </div>

      {/* User Authorization Info */}
      {profile && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Shield className="h-6 w-6 text-yellow-600" />
                <div>
                  <CardTitle className="text-lg">Tu Información de Autorización</CardTitle>
                  <CardDescription>
                    {profile.role?.replace(/_/g, ' ')} - {profile.nombre} {profile.apellido}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                {canAuthorize ? 'Puede Autorizar' : 'Sin Autorización'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <DollarSign className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Límite de Autorización</p>
                  <p className="font-semibold text-lg">
                    {authorizationLimit === Number.MAX_SAFE_INTEGER 
                      ? 'Sin límite' 
                      : authorizationLimit > 0 
                        ? formatCurrency(authorizationLimit)
                        : 'No puede autorizar'
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Permisos</p>
                  <p className="font-semibold">
                    {canAuthorize 
                      ? 'Crear, Aprobar y Gestionar' 
                      : 'Crear y Gestionar'
                    }
                  </p>
                </div>
              </div>
            </div>
            
            {canAuthorize && authorizationLimit > 0 && authorizationLimit < Number.MAX_SAFE_INTEGER && (
              <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Nota:</strong> Puedes autorizar órdenes de compra hasta {formatCurrency(authorizationLimit)}. 
                  Para montos mayores, se requiere autorización de un superior.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enhanced Purchase Order System Banner */}
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

          <div className="flex justify-center pt-4">
            <RoleGuard module="purchases" requireCreate>
              <Link href="/compras/crear-tipificada">
                <Button size="lg" className="min-w-[200px]">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Orden Tipificada
                </Button>
              </Link>
            </RoleGuard>
          </div>
        </CardContent>
      </Card>

      <Suspense fallback={<PurchaseOrdersListFallback />}>
        <PurchaseOrdersList />
      </Suspense>
    </DashboardShell>
  )
} 