"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { MaintenanceTeamGuard } from "@/components/auth/role-guard"
import { CacheCleanupButton } from "@/components/checklists/cache-cleanup-button"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Lock, Building, Phone, Mail, ShieldCheck, Settings2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export default function ConfiguracionPage() {
  const { profile, user } = useAuthZustand()

  if (!profile || !user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Cargando información del usuario...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Administre su información personal y configuración de cuenta
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="security">Seguridad</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Información del Perfil</CardTitle>
              <CardDescription>
                Detalles de su cuenta y rol en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <User className="mr-2 h-4 w-4" />
                    Nombre completo
                  </div>
                  <p className="font-medium">
                    {profile.nombre} {profile.apellido}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="mr-2 h-4 w-4" />
                    Correo electrónico
                  </div>
                  <p className="font-medium">{profile.email}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Rol
                  </div>
                  <p className="font-medium">
                    {profile.role.replace(/_/g, ' ')}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="mr-2 h-4 w-4" />
                    Teléfono
                  </div>
                  <p className="font-medium">
                    {profile.telefono || 'No registrado'}
                  </p>
                </div>

                {profile.plant_id && profile.plants && (
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Building className="mr-2 h-4 w-4" />
                      Planta asignada
                    </div>
                    <p className="font-medium">{profile.plants.name}</p>
                  </div>
                )}

                {profile.business_unit_id && profile.business_units && (
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Building className="mr-2 h-4 w-4" />
                      Unidad de negocio
                    </div>
                    <p className="font-medium">{profile.business_units.name}</p>
                  </div>
                )}
              </div>

              {profile.emergency_contact && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="font-medium">Contacto de Emergencia</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <User className="mr-2 h-4 w-4" />
                          Nombre
                        </div>
                        <p className="font-medium">
                          {profile.emergency_contact.name || 'No registrado'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Phone className="mr-2 h-4 w-4" />
                          Teléfono
                        </div>
                        <p className="font-medium">
                          {profile.emergency_contact.phone || 'No registrado'}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <ChangePasswordForm />
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <MaintenanceTeamGuard
            fallback={
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    No tienes permisos para acceder a la configuración del sistema.
                  </p>
                </CardContent>
              </Card>
            }
          >
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Administración de Cache
                </CardTitle>
                <CardDescription>
                  Herramientas para gestionar el almacenamiento local y resolver problemas de sincronización de checklists
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CacheCleanupButton />
              </CardContent>
            </Card>
          </MaintenanceTeamGuard>
        </TabsContent>
      </Tabs>
    </div>
  )
} 