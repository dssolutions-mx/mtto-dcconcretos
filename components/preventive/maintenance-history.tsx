"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Eye } from "lucide-react"

// Datos de ejemplo para el historial de mantenimiento
const maintenanceHistoryData = {
  assetId: "A007",
  asset: "Mezcladora de Concreto CR-15",
  history: [
    {
      id: "MH001",
      date: "2023-05-15",
      type: "Preventivo",
      hours: 500,
      technician: "Carlos Méndez",
      description: "Mantenimiento preventivo de 500 horas",
      findings: "Se encontró desgaste en sellos hidráulicos",
      actions: "Reemplazo de sellos hidráulicos y cambio de aceite",
      parts: [
        { name: "Kit de sellos hidráulicos", quantity: 1 },
        { name: "Filtro de aceite", quantity: 2 },
        { name: "Aceite hidráulico 20L", quantity: 1 },
      ],
      workOrderId: "OT-2250",
      checklistId: "CL-500h-001",
      status: "Completado",
    },
    {
      id: "MH002",
      date: "2023-01-20",
      type: "Preventivo",
      hours: 250,
      technician: "Roberto Sánchez",
      description: "Mantenimiento preventivo de 250 horas",
      findings: "Sin hallazgos significativos",
      actions: "Cambio de filtros y lubricación general",
      parts: [
        { name: "Filtro de aceite", quantity: 2 },
        { name: "Grasa industrial", quantity: 1 },
      ],
      workOrderId: "OT-2180",
      checklistId: "CL-250h-001",
      status: "Completado",
    },
    {
      id: "MH003",
      date: "2022-10-05",
      type: "Correctivo",
      hours: 180,
      technician: "Ana Gómez",
      description: "Reparación de fuga hidráulica",
      findings: "Manguera hidráulica rota en sistema principal",
      actions: "Reemplazo de manguera hidráulica y prueba de presión",
      parts: [
        { name: "Manguera hidráulica 1m", quantity: 1 },
        { name: "Conectores hidráulicos", quantity: 2 },
      ],
      workOrderId: "OT-2120",
      checklistId: null,
      status: "Completado",
    },
    {
      id: "MH004",
      date: "2022-08-15",
      type: "Preventivo",
      hours: 100,
      technician: "Carlos Méndez",
      description: "Mantenimiento preventivo inicial",
      findings: "Equipo en buenas condiciones",
      actions: "Ajustes generales y lubricación",
      parts: [{ name: "Grasa industrial", quantity: 1 }],
      workOrderId: "OT-2080",
      checklistId: "CL-100h-001",
      status: "Completado",
    },
  ],
  metrics: {
    totalMaintenances: 4,
    preventiveCount: 3,
    correctiveCount: 1,
    averageTimeBetweenFailures: "180 horas",
    averageRepairTime: "4.5 horas",
    maintenanceCosts: "$2,850",
    uptime: "98.5%",
  },
}

interface MaintenanceHistoryProps {
  id: string
}

export function MaintenanceHistory({ id }: MaintenanceHistoryProps) {
  // En una aplicación real, buscaríamos los datos del historial por su ID
  // const history = getMaintenanceHistoryById(id);
  const history = maintenanceHistoryData // Usamos datos de ejemplo

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Historial de Mantenimiento</CardTitle>
          <CardDescription>Registro histórico de mantenimientos para {history.asset}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="preventive">Preventivos</TabsTrigger>
              <TabsTrigger value="corrective">Correctivos</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>OT</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.history.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.date}</TableCell>
                        <TableCell>
                          <Badge variant={record.type === "Preventivo" ? "default" : "secondary"}>{record.type}</Badge>
                        </TableCell>
                        <TableCell>{record.hours}</TableCell>
                        <TableCell>{record.description}</TableCell>
                        <TableCell>{record.technician}</TableCell>
                        <TableCell>{record.workOrderId}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="preventive">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Checklist</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.history
                      .filter((record) => record.type === "Preventivo")
                      .map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>{record.hours}</TableCell>
                          <TableCell>{record.description}</TableCell>
                          <TableCell>{record.technician}</TableCell>
                          <TableCell>{record.checklistId || "N/A"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="corrective">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Hallazgos</TableHead>
                      <TableHead>Acciones</TableHead>
                      <TableHead>OT</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.history
                      .filter((record) => record.type === "Correctivo")
                      .map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>{record.hours}</TableCell>
                          <TableCell>{record.findings}</TableCell>
                          <TableCell>{record.actions}</TableCell>
                          <TableCell>{record.workOrderId}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Métricas de Mantenimiento</CardTitle>
          <CardDescription>Indicadores clave de rendimiento para este activo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Total de Mantenimientos</div>
              <div className="text-2xl font-bold">{history.metrics.totalMaintenances}</div>
              <div className="text-xs text-muted-foreground">
                {history.metrics.preventiveCount} preventivos, {history.metrics.correctiveCount} correctivos
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Tiempo Medio Entre Fallos</div>
              <div className="text-2xl font-bold">{history.metrics.averageTimeBetweenFailures}</div>
              <div className="text-xs text-muted-foreground">Tiempo promedio de operación sin fallos</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Tiempo Medio de Reparación</div>
              <div className="text-2xl font-bold">{history.metrics.averageRepairTime}</div>
              <div className="text-xs text-muted-foreground">Duración promedio de las reparaciones</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Disponibilidad</div>
              <div className="text-2xl font-bold">{history.metrics.uptime}</div>
              <div className="text-xs text-muted-foreground">Porcentaje de tiempo operativo</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
