"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuth } from "./auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ShieldAlert, Home } from "lucide-react"
import { type ModulePermissions } from "@/lib/auth/role-permissions"

interface RoleGuardProps {
  children: React.ReactNode
  module?: keyof ModulePermissions
  requireWrite?: boolean
  requireCreate?: boolean
  requireDelete?: boolean
  requireAuth?: boolean
  fallback?: React.ReactNode
  redirect?: string
  showAlert?: boolean
}

export function RoleGuard({
  children,
  module,
  requireWrite = false,
  requireCreate = false,
  requireDelete = false,
  requireAuth = false,
  fallback,
  redirect,
  showAlert = true
}: RoleGuardProps) {
  const { profile, loading, hasModuleAccess, hasWriteAccess, hasCreateAccess, hasDeleteAccess, hasAuthorizationAccess } = useAuth()
  const router = useRouter()
  const [hasCheckedPermissions, setHasCheckedPermissions] = useState(false)

  useEffect(() => {
    if (!loading) {
      setHasCheckedPermissions(true)
    }
  }, [loading])

  // Still loading
  if (loading || !hasCheckedPermissions) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  // No profile (shouldn't happen if auth middleware works)
  if (!profile) {
    if (redirect) {
      router.replace(redirect)
      return null
    }
    
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Sesión Requerida</CardTitle>
            <CardDescription>
              Debes iniciar sesión para acceder a este contenido
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/login')} 
              className="w-full"
            >
              Iniciar Sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check module access
  if (module && !hasModuleAccess(module)) {
    if (redirect) {
      router.replace(redirect)
      return null
    }

    if (fallback) {
      return <>{fallback}</>
    }

    if (!showAlert) {
      return null
    }

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Acceso Denegado</CardTitle>
            <CardDescription>
              Tu rol <strong>{profile.role}</strong> no tiene permisos para acceder a este módulo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Módulo:</strong> {module}<br />
                <strong>Rol actual:</strong> {profile.role}<br />
                <strong>Permisos requeridos:</strong> Acceso al módulo
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => router.push('/dashboard')} 
              className="w-full"
              variant="outline"
            >
              <Home className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check specific permission requirements
  const hasRequiredPermissions = (
    (!requireWrite || (module && hasWriteAccess(module))) &&
    (!requireCreate || (module && hasCreateAccess(module))) &&
    (!requireDelete || (module && hasDeleteAccess(module))) &&
    (!requireAuth || (module && hasAuthorizationAccess(module)))
  )

  if (!hasRequiredPermissions) {
    if (redirect) {
      router.replace(redirect)
      return null
    }

    if (fallback) {
      return <>{fallback}</>
    }

    if (!showAlert) {
      return null
    }

    const requiredPermissions = []
    if (requireWrite) requiredPermissions.push('Escritura')
    if (requireCreate) requiredPermissions.push('Creación')
    if (requireDelete) requiredPermissions.push('Eliminación')
    if (requireAuth) requiredPermissions.push('Autorización')

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ShieldAlert className="h-12 w-12 text-warning mx-auto mb-2" />
            <CardTitle>Permisos Insuficientes</CardTitle>
            <CardDescription>
              Tu rol no tiene los permisos específicos requeridos para esta acción
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Módulo:</strong> {module}<br />
                <strong>Rol actual:</strong> {profile.role}<br />
                <strong>Permisos requeridos:</strong> {requiredPermissions.join(', ')}
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => router.back()} 
              className="w-full"
              variant="outline"
            >
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // All checks passed, render children
  return <>{children}</>
}

// Convenience components for common patterns
export function AdminOnlyGuard({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile } = useAuth()
  
  if (!profile || !['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'].includes(profile.role)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

export function ManagerLevelGuard({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile } = useAuth()
  
  if (!profile || !['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'AREA_ADMINISTRATIVA', 'JEFE_PLANTA'].includes(profile.role)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

export function AuthorizedOnlyGuard({ 
  children, 
  fallback, 
  amount 
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode
  amount?: number 
}) {
  const { profile, canAuthorizeAmount } = useAuth()
  
  if (!profile) {
    return <>{fallback}</>
  }
  
  // If amount specified, check authorization limit
  if (amount !== undefined && !canAuthorizeAmount(amount)) {
    return <>{fallback}</>
  }
  
  // Check if user has any authorization powers
  const hasAuthRole = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'AREA_ADMINISTRATIVA', 'JEFE_PLANTA'].includes(profile.role)
  
  if (!hasAuthRole) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

// AREA_ADMINISTRATIVA specific guard
export function AdministrativeAreaGuard({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile } = useAuth()
  
  if (!profile || profile.role !== 'AREA_ADMINISTRATIVA') {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

// GERENCIA_GENERAL specific guard
export function GeneralManagementGuard({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile } = useAuth()
  
  if (!profile || profile.role !== 'GERENCIA_GENERAL') {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

// ENCARGADO_MANTENIMIENTO specific guard
export function MaintenanceManagerGuard({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile } = useAuth()
  
  if (!profile || profile.role !== 'ENCARGADO_MANTENIMIENTO') {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

// JEFE_PLANTA specific guard
export function PlantManagerGuard({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile } = useAuth()
  
  if (!profile || profile.role !== 'JEFE_PLANTA') {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

// AUXILIAR_COMPRAS specific guard
export function PurchasingAssistantGuard({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile } = useAuth()
  
  if (!profile || profile.role !== 'AUXILIAR_COMPRAS') {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

// OPERADOR/DOSIFICADOR specific guard (they have similar permissions)
export function OperatorGuard({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile } = useAuth()
  
  if (!profile || !['OPERADOR', 'DOSIFICADOR'].includes(profile.role)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

// VISUALIZADOR specific guard
export function ViewerGuard({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile } = useAuth()
  
  if (!profile || profile.role !== 'VISUALIZADOR') {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

// Maintenance roles guard (any role with maintenance access)
export function MaintenanceTeamGuard({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile } = useAuth()
  
  if (!profile || !['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'ENCARGADO_MANTENIMIENTO', 'JEFE_PLANTA'].includes(profile.role)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

// Purchasing roles guard (any role with purchasing authorization)
export function PurchasingTeamGuard({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile } = useAuth()
  
  if (!profile || !['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'AREA_ADMINISTRATIVA', 'JEFE_PLANTA', 'ENCARGADO_MANTENIMIENTO', 'AUXILIAR_COMPRAS'].includes(profile.role)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
} 