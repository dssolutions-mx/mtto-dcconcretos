"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertCircle, ArrowDown, ArrowUp, Calendar, Download, Filter, Printer, RefreshCw } from "lucide-react"

// Datos de ejemplo para los gráficos
const salesData = [
  { name: "Ene", ventas: 4000 },
  { name: "Feb", ventas: 3000 },
  { name: "Mar", ventas: 5000 },
  { name: "Abr", ventas: 4500 },
  { name: "May", ventas: 6000 },
  { name: "Jun", ventas: 5500 },
]

const profitData = [
  { name: "Ene", ganancia: 2500, margen: 62.5 },
  { name: "Feb", ganancia: 1800, margen: 60.0 },
  { name: "Mar", ganancia: 3200, margen: 64.0 },
  { name: "Abr", ganancia: 2700, margen: 60.0 },
  { name: "May", ganancia: 3900, margen: 65.0 },
  { name: "Jun", ganancia: 3600, margen: 65.5 },
]

const visitorsData = [
  { name: "Ene", visitantes: 1200 },
  { name: "Feb", visitantes: 1400 },
  { name: "Mar", visitantes: 1300 },
  { name: "Abr", visitantes: 1500 },
  { name: "May", visitantes: 1800 },
  { name: "Jun", visitantes: 2000 },
]

const pageViewsData = [
  { name: "Ene", vistas: 3500 },
  { name: "Feb", vistas: 4200 },
  { name: "Mar", vistas: 3800 },
  { name: "Abr", vistas: 4500 },
  { name: "May", vistas: 5200 },
  { name: "Jun", vistas: 6000 },
]

const maintenanceTypeData = [
  { name: "Preventivo", value: 45, color: "#4f46e5" },
  { name: "Correctivo", value: 30, color: "#f97316" },
  { name: "Garantía", value: 15, color: "#10b981" },
  { name: "Calibración", value: 10, color: "#6366f1" },
]

const referrersData = [
  { name: "Google", visits: 1200 },
  { name: "Direct", visits: 800 },
  { name: "Twitter", visits: 400 },
  { name: "Facebook", visits: 350 },
  { name: "LinkedIn", visits: 250 },
]

const providerPerformanceData = [
  { name: "TecnoServicios", rating: 4.8, completionRate: 98, responseTime: 4 },
  { name: "LogiMant", rating: 4.5, completionRate: 95, responseTime: 6 },
  { name: "ClimaControl", rating: 4.2, completionRate: 92, responseTime: 8 },
  { name: "EnergySolutions", rating: 4.7, completionRate: 97, responseTime: 5 },
  { name: "ThermalTech", rating: 4.0, completionRate: 90, responseTime: 12 },
]

export function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState("6m")

  return (
    <div className="grid gap-4">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="maintenance">Mantenimientos</TabsTrigger>
            <TabsTrigger value="warranty">Garantías</TabsTrigger>
            <TabsTrigger value="providers">Proveedores</TabsTrigger>
          </TabsList>
          <div className="flex justify-end my-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filtrar
              </Button>
              <Select defaultValue={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">Último mes</SelectItem>
                  <SelectItem value="3m">Últimos 3 meses</SelectItem>
                  <SelectItem value="6m">Últimos 6 meses</SelectItem>
                  <SelectItem value="1y">Último año</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Disponibilidad de Equipos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">92.5%</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <ArrowUp className="mr-1 h-4 w-4 text-green-500" />
                    <span className="text-green-500">+2.5%</span>
                    <span className="ml-1">vs. período anterior</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cumplimiento de OTs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">87%</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <ArrowDown className="mr-1 h-4 w-4 text-red-500" />
                    <span className="text-red-500">-3%</span>
                    <span className="ml-1">vs. período anterior</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Gastos de Mantenimiento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$45,230</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <ArrowUp className="mr-1 h-4 w-4 text-red-500" />
                    <span className="text-red-500">+8%</span>
                    <span className="ml-1">vs. período anterior</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ahorro por Garantías</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$12,850</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <ArrowUp className="mr-1 h-4 w-4 text-green-500" />
                    <span className="text-green-500">+15%</span>
                    <span className="ml-1">vs. período anterior</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Ventas Netas</CardTitle>
                  <CardDescription>Evolución de ventas en los últimos 6 meses</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={salesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="ventas" name="Ventas ($)" stroke="#4f46e5" activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Ganancia Bruta y Margen</CardTitle>
                  <CardDescription>Evolución de ganancia y margen en los últimos 6 meses</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={profitData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="ganancia"
                        name="Ganancia ($)"
                        stroke="#10b981"
                        activeDot={{ r: 8 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="margen"
                        name="Margen (%)"
                        stroke="#f97316"
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-7 mt-4">
              <Card className="md:col-span-3">
                <CardHeader>
                  <CardTitle>Visitantes</CardTitle>
                  <CardDescription>Número de visitantes por mes</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={visitorsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="visitantes" name="Visitantes" fill="#4f46e5" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="md:col-span-4">
                <CardHeader>
                  <CardTitle>Tipos de Mantenimiento</CardTitle>
                  <CardDescription>Distribución por tipo de mantenimiento</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={maintenanceTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {maintenanceTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3 mt-4">
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle>Principales Referentes</CardTitle>
                  <CardDescription>Fuentes de tráfico más importantes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {referrersData.map((referrer) => (
                      <div key={referrer.name} className="flex items-center justify-between">
                        <div className="font-medium">{referrer.name}</div>
                        <div className="font-semibold">{referrer.visits}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar reporte
                  </Button>
                </CardFooter>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Desempeño de Proveedores</CardTitle>
                  <CardDescription>Evaluación de proveedores externos</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {providerPerformanceData.map((provider) => (
                      <div key={provider.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{provider.name}</div>
                          <div className="flex items-center">
                            <span className="font-semibold mr-1">{provider.rating}</span>
                            <span className="text-yellow-500">★</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tasa de cumplimiento:</span>
                            <span>{provider.completionRate}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tiempo de respuesta:</span>
                            <span>{provider.responseTime}h</span>
                          </div>
                        </div>
                        <div className="h-1 w-full bg-muted overflow-hidden rounded-full">
                          <div className="h-full bg-primary" style={{ width: `${provider.completionRate}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Filtrar
                  </Button>
                  <Button variant="outline">
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="maintenance">
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Mantenimientos</CardTitle>
                <CardDescription>Información detallada sobre mantenimientos</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center">
                <p className="text-muted-foreground">Contenido de análisis de mantenimientos en desarrollo</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="warranty">
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Garantías</CardTitle>
                <CardDescription>Información detallada sobre garantías</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center">
                <p className="text-muted-foreground">Contenido de análisis de garantías en desarrollo</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="providers">
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Proveedores</CardTitle>
                <CardDescription>Información detallada sobre proveedores</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center">
                <p className="text-muted-foreground">Contenido de análisis de proveedores en desarrollo</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Alertas de Garantías</CardTitle>
              <CardDescription>Panel de alertas sobre garantías próximas a vencer</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Ver calendario
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
              <AlertCircle className="h-8 w-8 text-amber-500 mr-4" />
              <div>
                <h4 className="font-semibold">8 garantías próximas a vencer</h4>
                <p className="text-sm text-muted-foreground">
                  Hay 8 garantías que vencerán en los próximos 30 días. Revisa el calendario para más detalles.
                </p>
              </div>
            </div>
            <div className="flex items-center p-4 border rounded-lg bg-red-50 dark:bg-red-950/20">
              <AlertCircle className="h-8 w-8 text-red-500 mr-4" />
              <div>
                <h4 className="font-semibold">3 garantías vencidas sin acción</h4>
                <p className="text-sm text-muted-foreground">
                  Hay 3 garantías vencidas que no tienen acciones registradas. Revisa la sección de garantías.
                </p>
              </div>
            </div>
            <div className="flex items-center p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
              <AlertCircle className="h-8 w-8 text-green-500 mr-4" />
              <div>
                <h4 className="font-semibold">5 reclamos de garantía exitosos</h4>
                <p className="text-sm text-muted-foreground">
                  Se han completado 5 reclamos de garantía con éxito en el último mes, generando un ahorro de $12,850.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
