"use client"

import type { Metadata } from "next"
import Link from "next/link"
import { Suspense, useState, useEffect } from "react"
import { PurchaseOrdersList } from "@/components/work-orders/purchase-orders-list"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Store, Wrench, Building2, Sparkles, Loader2, Receipt, DollarSign, Shield, CheckCircle, AlertTriangle } from "lucide-react"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { formatCurrency } from "@/lib/utils"
import { AccountsPayableSummaryCard } from "@/components/purchase-orders/AccountsPayableSummaryCard"

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
  const { profile, hasCreateAccess, authorizationLimit, refreshProfile } = useAuthZustand()
  const [effectiveAuthLimit, setEffectiveAuthLimit] = useState<number>(0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)

  // Load effective authorization limit from the same source as authorization page
  useEffect(() => {
    const loadEffectiveAuthorization = async () => {
      if (!profile?.id) return
      
      try {
        // Hacer consulta directa a la vista que sabemos funciona correctamente
        const response = await fetch('/api/authorization/summary')
        const data = await response.json()
        
        // Buscar el usuario actual en la respuesta organizacional
        let userFound = false
        if (data.organization_summary) {
          for (const businessUnit of data.organization_summary) {
            for (const plant of businessUnit.plants) {
              const user = plant.users.find((u: any) => u.user_id === profile.id)
              if (user) {
                const apiLimit = parseFloat(user.effective_global_authorization || 0)
                setEffectiveAuthLimit(apiLimit)
                userFound = true
                console.log('✅ Found user effective limit:', user.effective_global_authorization)
                
                // 🔄 AUTO-REFRESH: Detectar inconsistencias de límite O rol
                const profileLimit = profile.can_authorize_up_to || 0
                const limitInconsistent = Math.abs(profileLimit - apiLimit) > 0.01 // Diferencia mayor a 1 centavo
                const roleInconsistent = user.role !== profile.role
                
                if (limitInconsistent || roleInconsistent) {
                  console.log(`🔄 Inconsistencias detectadas:`, {
                    limitInconsistent: limitInconsistent ? `Perfil=${profileLimit}, API=${apiLimit}` : false,
                    roleInconsistent: roleInconsistent ? `Perfil=${profile.role}, API=${user.role}` : false,
                    triggeringAutoRefresh: true
                  })
                  
                  try {
                    if (typeof refreshProfile === 'function') {
                      await refreshProfile()
                      console.log('✅ Perfil refrescado exitosamente')
                    }
                  } catch (refreshError) {
                    console.error('❌ Error refrescando perfil:', refreshError)
                  }
                }
                break
              }
            }
            if (userFound) break
          }
        }
        
        if (!userFound) {
          console.log('⚠️ User not found in organization summary, using profile limit')
          setEffectiveAuthLimit(profile.can_authorize_up_to || 0)
        }
      } catch (error) {
        console.error('Error loading effective authorization:', error)
        // Fallback to profile limit
        setEffectiveAuthLimit(profile.can_authorize_up_to || 0)
      } finally {
        setIsLoadingAuth(false)
      }
    }

    loadEffectiveAuthorization()
  }, [profile])

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
  
  return (
    <DashboardShell>
      <div className="flex justify-between items-center mb-6">
        <DashboardHeader
          heading="Órdenes de Compra"
          text="Gestiona las órdenes de compra generadas a partir de órdenes de trabajo."
        />
        <div className="flex space-x-2">
          {/* ✅ Solo mostrar botón de comprobantes si tiene acceso de lectura */}
          {profile && hasCreateAccess('purchases') && (
            <Link href="/compras/comprobantes">
              <Button variant="outline">
                <Receipt className="mr-2 h-4 w-4" />
                Ver Comprobantes
              </Button>
            </Link>
          )}
          
          {/* ✅ NUEVO: Botón de Cuentas por Pagar para administradores */}
          {profile && (profile.role === 'GERENCIA_GENERAL' || profile.role === 'AREA_ADMINISTRATIVA') && (
            <Link href="/compras/cuentas-por-pagar">
              <Button variant="outline" className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100">
                <DollarSign className="mr-2 h-4 w-4" />
                Cuentas por Pagar
              </Button>
            </Link>
          )}
          
          {/* ✅ NUEVO SISTEMA: Solo mostrar si puede crear órdenes */}
          {canCreateOrders && (
            <Link href="/compras/crear-tipificada">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Orden Tipificada
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ✅ NUEVO: Información de Capacidades del Usuario */}
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
            
            {/* Mensaje informativo basado en las capacidades */}
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

      {/* ✅ NUEVO: Cuentas por Pagar Summary para Administradores */}
      {profile && (profile.role === 'GERENCIA_GENERAL' || profile.role === 'AREA_ADMINISTRATIVA') && (
        <AccountsPayableSummaryCard />
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

      <Suspense fallback={<PurchaseOrdersListFallback />}>
        <PurchaseOrdersList />
      </Suspense>
    </DashboardShell>
  )
} 