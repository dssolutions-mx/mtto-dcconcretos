'use client'

import { useRef } from 'react'
import { RoleGuard } from '@/components/auth/role-guard'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { PersonnelManagementDragDrop } from '@/components/personnel/personnel-management-drag-drop'
import { UserRegistrationTool } from '@/components/auth/user-registration-tool'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import {
  canRegisterOperatorsClient,
  isFullPersonnelRegistrationClient,
} from '@/lib/auth/client-authorization'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Canonical personal / personnel page shell — matches Órdenes de compra e Incidentes
 * (DashboardShell + header row + primary action).
 */
export function GestionPersonalView() {
  const { profile } = useAuthZustand()
  const refetchBoard = useRef<() => void>(() => {})
  const canRegister = canRegisterOperatorsClient(profile)
  const lineManagerScope =
    canRegister && profile && !isFullPersonnelRegistrationClient(profile)

  return (
    <RoleGuard module="personnel">
      <DashboardShell>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <DashboardHeader
            heading="Gestión de personal"
            text="Asignación por unidad y planta. Las altas crean cuenta en el sistema (correo + contraseña provisional) y perfil enlazado."
          />
          {canRegister && (
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
              <UserRegistrationTool
                onRegistered={() => {
                  refetchBoard.current?.()
                }}
              />
            </div>
          )}
        </div>

        {lineManagerScope && (
          <Alert className="border-border/60 bg-muted/20">
            <AlertDescription className="text-sm text-muted-foreground">
              Como Jefe de Unidad o Jefe de Planta puedes registrar{' '}
              <span className="font-medium text-foreground">operador, dosificador o mecánico</span> en tu
              alcance (POL-OPE-001). Se genera una contraseña provisional al abrir el formulario; entrégala por
              un canal seguro.
            </AlertDescription>
          </Alert>
        )}

        <PersonnelManagementDragDrop
          registrationRefetchRef={refetchBoard}
          embedRegistrationTool={false}
        />
      </DashboardShell>
    </RoleGuard>
  )
}
