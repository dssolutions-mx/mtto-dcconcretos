import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, FileDown, ClipboardCheck } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Checklists | Sistema de Gestión de Mantenimiento",
  description: "Gestión de checklists para mantenimiento",
}

export default function ChecklistsPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Checklists de Mantenimiento"
        text="Gestiona los checklists para diferentes frecuencias de mantenimiento."
      >
        <div className="flex gap-2">
          <Button variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button asChild>
            <Link href="/checklists/crear">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Checklist
            </Link>
          </Button>
        </div>
      </DashboardHeader>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          <TabsTrigger value="daily">Diarios</TabsTrigger>
          <TabsTrigger value="weekly">Semanales</TabsTrigger>
          <TabsTrigger value="monthly">Mensuales</TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/checklists/diarios" className="block">
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Checklists Diarios</CardTitle>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">4</div>
                  <p className="text-xs text-muted-foreground">2 pendientes hoy</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/checklists/semanales" className="block">
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Checklists Semanales</CardTitle>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">4</div>
                  <p className="text-xs text-muted-foreground">1 atrasado</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/checklists/mensuales" className="block">
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Checklists Mensuales</CardTitle>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">4</div>
                  <p className="text-xs text-muted-foreground">2 atrasados</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/checklists" className="block">
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Plantillas</CardTitle>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">5</div>
                  <p className="text-xs text-muted-foreground">Para diferentes equipos</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Checklists Pendientes</CardTitle>
                <CardDescription>Checklists que requieren atención inmediata</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Link href="/checklists/ejecutar/DCL002" className="block">
                    <Card className="hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold">Inspección Diaria - Montacargas FM-2000E</h4>
                            <p className="text-sm text-muted-foreground">Montacargas Eléctrico #3</p>
                          </div>
                          <Button size="sm">Ejecutar</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/checklists/ejecutar/DCL003" className="block">
                    <Card className="hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold">Inspección Diaria - Generador PG-5000</h4>
                            <p className="text-sm text-muted-foreground">Generador Eléctrico Principal</p>
                          </div>
                          <Button size="sm">Ejecutar</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/checklists/ejecutar/WCL003" className="block">
                    <Card className="hover:bg-muted/50 transition-colors border-amber-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold">Inspección Semanal - Generador PG-5000</h4>
                            <p className="text-sm text-muted-foreground">Atrasado - Debió ejecutarse el 15/06/2023</p>
                          </div>
                          <Button size="sm" variant="destructive">
                            Urgente
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="daily">
          <iframe src="/checklists/diarios" className="w-full h-[calc(100vh-12rem)] border rounded-md" />
        </TabsContent>

        <TabsContent value="weekly">
          <iframe src="/checklists/semanales" className="w-full h-[calc(100vh-12rem)] border rounded-md" />
        </TabsContent>

        <TabsContent value="monthly">
          <iframe src="/checklists/mensuales" className="w-full h-[calc(100vh-12rem)] border rounded-md" />
        </TabsContent>

        <TabsContent value="templates">
          <iframe src="/checklists" className="w-full h-[calc(100vh-12rem)] border rounded-md" />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}
