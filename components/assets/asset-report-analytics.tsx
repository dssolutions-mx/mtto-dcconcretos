'use client';

import { useState } from 'react';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Clock,
  Zap,
  Activity,
  BarChart3,
  LineChart,
  Download,
  FileSpreadsheet
} from "lucide-react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AnalyticsData {
  summary: {
    totalAssets: number;
    totalActiveIncidents?: number;
    preventiveCount?: number;
    correctiveCount?: number;
    totalHours: number;
    totalKilometers: number;
    totalChecklists: number;
    totalMaintenances: number;
    totalMaintenanceCost: number;
    averageHoursPerAsset: number;
    averageKilometersPerAsset: number;
  };
  assetDetails: any[];
  customParameters: any[];
  trends: {
    hoursOverTime: any[];
    kilometersOverTime: any[];
    maintenanceCostsOverTime: any[];
  };
  insights: {
    highestCostAsset: any;
    mostEfficientAsset: any;
    alertsAndRecommendations: any[];
  };
}

interface AssetReportAnalyticsProps {
  data: AnalyticsData;
  onBack: () => void;
  customParameters: any[];
  assetParameters: any[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

/** Compute fleet health score (0-100) from active incidents. Simplified when no overdue data. */
function computeFleetHealthScore(activeIncidents: number): number {
  const raw = Math.round(100 - activeIncidents * 15)
  return Math.max(0, Math.min(100, raw))
}

/** Banded health: Alto (80+), Medio (50-79), Bajo (<50). */
function getHealthBand(score: number): { band: string; color: string } {
  if (score >= 80) return { band: 'Alto', color: 'text-green-600' }
  if (score >= 50) return { band: 'Medio', color: 'text-amber-600' }
  return { band: 'Bajo', color: 'text-red-600' }
}

export function AssetReportAnalytics({ data, onBack, customParameters, assetParameters }: AssetReportAnalyticsProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Executive summary metrics
  const activeIncidents = data.summary.totalActiveIncidents ?? 0
  const preventiveCount = data.summary.preventiveCount ?? 0
  const correctiveCount = data.summary.correctiveCount ?? 0
  const totalMaint = preventiveCount + correctiveCount || 1
  const preventivePct = Math.round((preventiveCount / totalMaint) * 100)
  const correctivePct = Math.round((correctiveCount / totalMaint) * 100)
  const healthScore = computeFleetHealthScore(activeIncidents)
  const healthBand = getHealthBand(healthScore)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-ES').format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
  };

  // Prepare chart data
  const efficiencyChartData = data.assetDetails.map(asset => ({
    name: asset.asset_id,
    efficiency: asset.metrics.efficiency,
    availability: asset.metrics.availability,
    costPerHour: asset.metrics.costPerHour,
  }));

  const maintenanceTypeData = data.assetDetails.reduce((acc: any, asset) => {
    Object.entries(asset.maintenance.byType).forEach(([type, count]: [string, any]) => {
      acc[type] = (acc[type] || 0) + count;
    });
    return acc;
  }, {});

  const maintenanceTypePieData = Object.entries(maintenanceTypeData).map(([type, count], index) => ({
    name: type,
    value: count,
    fill: COLORS[index % COLORS.length]
  }));

  const statusBarData = Object.entries(data.assetDetails.reduce((acc: any, asset) => {
    acc[asset.status] = (acc[asset.status] || 0) + 1;
    return acc;
  }, {})).map(([status, count], index) => ({
    name: status,
    count,
    fill: COLORS[index % COLORS.length]
  }));

  // Process hours trend data for chart
  const hoursOverTimeChart = data.trends.hoursOverTime.reduce((acc: any[], asset: any) => {
    asset.readings.forEach((reading: any) => {
      const existingDate = acc.find(item => item.date === reading.date);
      if (existingDate) {
        existingDate[asset.assetId] = reading.hours;
      } else {
        acc.push({
          date: reading.date,
          [asset.assetId]: reading.hours
        });
      }
    });
    return acc;
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Process maintenance costs over time
  const maintenanceCostsChart = data.trends.maintenanceCostsOverTime.reduce((acc: any[], maintenance: any) => {
    const month = format(new Date(maintenance.date), 'yyyy-MM');
    const existingMonth = acc.find(item => item.month === month);
    if (existingMonth) {
      existingMonth.cost += maintenance.cost;
      existingMonth.count += 1;
    } else {
      acc.push({
        month,
        cost: maintenance.cost,
        count: 1
      });
    }
    return acc;
  }, []).sort((a, b) => a.month.localeCompare(b.month));

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Análisis de Activos"
        text="Dashboard analítico con métricas y tendencias de rendimiento"
      >
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Reportes
        </Button>
      </DashboardHeader>

      {/* Resumen Ejecutivo (Problema → Impacto → Solución → Decisión) */}
      <Card className="mb-6 border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle>Resumen Ejecutivo</CardTitle>
          <CardDescription>
            Métricas clave para decisión rápida — 30 segundos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4 text-center bg-muted/30">
              <p className="text-2xl font-bold">{healthScore}</p>
              <p className="text-xs text-muted-foreground">Salud Flota (0-100)</p>
              <p className={`text-sm font-medium ${healthBand.color}`}>{healthBand.band}</p>
            </div>
            <div className="rounded-lg border p-4 text-center bg-muted/30">
              <p className="text-2xl font-bold">{activeIncidents}</p>
              <p className="text-xs text-muted-foreground">Incidentes Activos</p>
            </div>
            <div className="rounded-lg border p-4 text-center bg-muted/30">
              <p className="text-xl font-bold text-green-600">{preventivePct}%</p>
              <p className="text-xs text-muted-foreground">Preventivo</p>
            </div>
            <div className="rounded-lg border p-4 text-center bg-muted/30">
              <p className="text-xl font-bold text-red-600">{correctivePct}%</p>
              <p className="text-xs text-muted-foreground">Correctivo</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-3xl">
            {activeIncidents > 0
              ? `Problema: ${activeIncidents} incidente(s) activo(s) requieren atención. `
              : 'Problema: Sin incidentes abiertos. '}
            Impacto: {formatCurrency(data.summary.totalMaintenanceCost)} en mantenimiento; {preventivePct}% preventivo vs {correctivePct}% correctivo.
            {correctivePct > 60
              ? ' Solución: Fortalecer programa preventivo. '
              : ' Solución: Balance preventivo/correctivo aceptable. '}
            Decisión: {activeIncidents > 0 ? `Atender ${activeIncidents} incidente(s) abierto(s).` : 'Mantener monitoreo y preventivo.'}
          </p>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Activos</p>
                <p className="text-2xl font-bold">{data.summary.totalAssets}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Horas</p>
                <p className="text-2xl font-bold">{formatNumber(data.summary.totalHours)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Costo Mantenimiento</p>
                <p className="text-2xl font-bold">{formatCurrency(data.summary.totalMaintenanceCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Mantenimientos</p>
                <p className="text-2xl font-bold">{data.summary.totalMaintenances}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights and Alerts */}
      {data.insights.alertsAndRecommendations.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas y Recomendaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.insights.alertsAndRecommendations.map((assetAlert, index) => (
                <div key={index} className="space-y-2">
                  <h4 className="font-medium">{assetAlert.assetName} ({assetAlert.assetId})</h4>
                  {assetAlert.alerts.map((alert: any, alertIndex: number) => (
                    <Alert 
                      key={alertIndex} 
                      variant={alert.severity === 'error' ? 'destructive' : 'default'}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div>
                          <strong>{alert.message}</strong>
                          <p className="text-sm mt-1">{alert.recommendation}</p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="maintenance">Mantenimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle>Activos Destacados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Más Eficiente</span>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="font-medium">{data.insights.mostEfficientAsset.name}</p>
                    <p className="text-sm text-muted-foreground">{data.insights.mostEfficientAsset.asset_id}</p>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Mayor Costo</span>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="font-medium">{data.insights.highestCostAsset.name}</p>
                    <p className="text-sm text-muted-foreground">{data.insights.highestCostAsset.asset_id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Asset Status Distribution - Bar chart (avoid pie per plan) */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsBarChart data={statusBarData} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={55} />
                    <Tooltip formatter={(value: number) => [value, 'Cantidad']} />
                    <Bar dataKey="count" name="Activos" radius={[0, 4, 4, 0]}>
                      {statusBarData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Custom Parameters */}
          {data.customParameters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Parámetros Personalizados por Activo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.customParameters.map((param: any, index: number) => {
                    const relatedAssetParams = data.assetParameters.filter((ap: any) => ap.parameterId === param.id);
                    if (relatedAssetParams.length === 0) return null;
                    
                    return (
                      <div key={index} className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3">{param.name} ({param.unit})</h4>
                        <p className="text-sm text-muted-foreground mb-3">{param.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {relatedAssetParams.map((assetParam: any, assetIndex: number) => {
                            const asset = data.assetDetails.find((a: any) => a.id === assetParam.assetId);
                            return asset ? (
                              <div key={assetIndex} className="flex justify-between items-center p-2 bg-muted rounded text-sm">
                                <span className="truncate">{asset.name}</span>
                                <span className="font-medium">{assetParam.value} {param.unit}</span>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Hours Over Time */}
            {hoursOverTimeChart.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tendencia de Horas por Activo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsLineChart data={hoursOverTimeChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => formatDate(value)}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => formatDate(value)}
                      />
                      <Legend />
                      {data.trends.hoursOverTime.map((asset, index) => (
                        <Line
                          key={asset.assetId}
                          type="monotone"
                          dataKey={asset.assetId}
                          stroke={COLORS[index % COLORS.length]}
                          name={asset.assetName}
                        />
                      ))}
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Maintenance Costs Over Time */}
            {maintenanceCostsChart.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Costos de Mantenimiento por Mes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={maintenanceCostsChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        formatter={[(value: number) => formatCurrency(value), 'Costo']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="cost" 
                        stroke="#8884d8" 
                        fill="#8884d8" 
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {/* Operational Efficiency Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Promedio Productividad</p>
                    <p className="text-2xl font-bold">
                      {(data.assetDetails.reduce((sum, asset) => sum + (asset.operationalMetrics?.productionPerHour || 0), 0) / data.assetDetails.length).toFixed(2)} m³/h
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Zap className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Eficiencia Combustible</p>
                    <p className="text-2xl font-bold">
                      {(data.assetDetails.reduce((sum, asset) => sum + (asset.operationalMetrics?.fuelEfficiency || 0), 0) / data.assetDetails.length).toFixed(2)} m³/L
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Costo Promedio/m³</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(data.assetDetails.reduce((sum, asset) => sum + (asset.operationalMetrics?.totalCostPerUnit || 0), 0) / data.assetDetails.length)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Consumo Promedio</p>
                    <p className="text-2xl font-bold">
                      {(data.assetDetails.reduce((sum, asset) => sum + (asset.operationalMetrics?.fuelConsumptionPerUnit || 0), 0) / data.assetDetails.length).toFixed(2)} L/m³
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Efficiency Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Rendimiento por Activo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RechartsBarChart data={efficiencyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="efficiency" fill="#8884d8" name="Eficiencia (%)" />
                  <Bar dataKey="availability" fill="#82ca9d" name="Disponibilidad (%)" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Operational Efficiency Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Comparación de Eficiencia Operacional</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RechartsBarChart data={data.assetDetails.map(asset => ({
                  name: asset.asset_id,
                  productividad: asset.operationalMetrics?.productionPerHour || 0,
                  eficienciaFuel: asset.operationalMetrics?.fuelEfficiency || 0,
                  costoTotal: asset.operationalMetrics?.totalCostPerUnit || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'costoTotal') return [formatCurrency(value), 'Costo por m³']
                      if (name === 'productividad') return [`${value.toFixed(2)} m³/h`, 'Productividad']
                      if (name === 'eficienciaFuel') return [`${value.toFixed(2)} m³/L`, 'Eficiencia Combustible']
                      return [value, name]
                    }}
                  />
                  <Legend />
                  <Bar dataKey="productividad" fill="#8884d8" name="Productividad (m³/h)" />
                  <Bar dataKey="eficienciaFuel" fill="#82ca9d" name="Eficiencia Combustible (m³/L)" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Asset Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detalle de Rendimiento y Eficiencia Operacional</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Activo</th>
                      <th className="text-left p-2">Horas Op.</th>
                      <th className="text-left p-2">Productividad<br/>(m³/h)</th>
                      <th className="text-left p-2">Consumo<br/>(L/h)</th>
                      <th className="text-left p-2">Eficiencia<br/>(m³/L)</th>
                      <th className="text-left p-2">Costo/m³</th>
                      <th className="text-left p-2">Disponibilidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assetDetails.map((asset) => (
                      <tr key={asset.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <div>
                            <p className="font-medium">{asset.name}</p>
                            <p className="text-xs text-muted-foreground">{asset.asset_id}</p>
                          </div>
                        </td>
                        <td className="p-2">{asset.operationalMetrics?.operationalHours?.toFixed(1) || '0'}h</td>
                        <td className="p-2">
                          <span className="font-medium text-green-600">
                            {asset.operationalMetrics?.productionPerHour?.toFixed(2) || '0'}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className="font-medium text-blue-600">
                            {asset.operationalMetrics?.fuelPerHour?.toFixed(2) || '0'}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className="font-medium text-purple-600">
                            {asset.operationalMetrics?.fuelEfficiency?.toFixed(3) || '0'}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className="font-medium text-orange-600">
                            {formatCurrency(asset.operationalMetrics?.totalCostPerUnit || 0)}
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Progress value={asset.metrics.availability} className="w-16" />
                            <span>{asset.metrics.availability}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Maintenance Types - Bar chart (avoid pie per plan) */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Mantenimientos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsBarChart
                    data={maintenanceTypePieData.map((d) => ({ ...d, count: d.value }))}
                    margin={{ top: 5, right: 20, left: 5, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [value, 'Cantidad']} />
                    <Bar dataKey="count" name="Mantenimientos" radius={[4, 4, 0, 0]}>
                      {maintenanceTypePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Maintenance Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Resumen de Mantenimiento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total Mantenimientos</span>
                    <Badge variant="outline">{data.summary.totalMaintenances}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Costo Promedio</span>
                    <Badge variant="outline">
                      {formatCurrency(data.summary.totalMaintenanceCost / Math.max(data.summary.totalMaintenances, 1))}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Costo por Activo</span>
                    <Badge variant="outline">
                      {formatCurrency(data.summary.totalMaintenanceCost / data.summary.totalAssets)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Checklists Promedio</span>
                    <Badge variant="outline">
                      {(data.summary.totalChecklists / data.summary.totalAssets).toFixed(1)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Maintenance Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Actividades Recientes de Mantenimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.assetDetails.slice(0, 5).map((asset) => (
                  <div key={asset.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{asset.name}</h4>
                      <Badge variant="outline">{asset.asset_id}</Badge>
                    </div>
                    <div className="space-y-2">
                      {asset.maintenance.recent.slice(0, 3).map((maintenance: any, index: number) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium">{maintenance.type}</span>
                            <span className="text-muted-foreground ml-2">
                              {formatDate(maintenance.date)}
                            </span>
                          </div>
                          <div className="text-right">
                            <div>{formatCurrency(maintenance.cost)}</div>
                            <div className="text-xs text-muted-foreground">
                              {maintenance.hours}h trabajo
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}