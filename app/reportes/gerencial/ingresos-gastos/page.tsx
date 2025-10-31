'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Download, AlertCircle, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'

type PlantData = {
  plant_id: string
  plant_name: string
  plant_code: string
  business_unit_id: string

  // Ingresos Concreto
  volumen_concreto: number
  fc_ponderada: number
  edad_ponderada: number
  pv_unitario: number
  ventas_total: number

  // Costo Materia Prima
  costo_mp_unitario: number
  consumo_cem_m3: number
  costo_cem_m3: number
  costo_cem_pct: number
  costo_mp_total: number
  costo_mp_pct: number

  // Spread
  spread_unitario: number
  spread_unitario_pct: number

  // Costo Operativo
  diesel_total: number
  diesel_unitario: number
  diesel_pct: number
  mantto_total: number
  mantto_unitario: number
  mantto_pct: number
  nomina_total: number
  nomina_unitario: number
  nomina_pct: number
  otros_indirectos_total: number
  otros_indirectos_unitario: number
  otros_indirectos_pct: number
  total_costo_op: number
  total_costo_op_pct: number

  // EBITDA
  ebitda: number
  ebitda_pct: number

  // Optional Bombeo
  ingresos_bombeo_vol?: number
  ingresos_bombeo_unit?: number
}

type ReportData = {
  month: string
  plants: PlantData[]
  filters: {
    businessUnits: Array<{ id: string; name: string; code: string }>
    plants: Array<{ id: string; name: string; code: string; business_unit_id: string }>
  }
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

const formatNumber = (num: number, decimals: number = 2) =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num)

const formatPercent = (pct: number) => `${formatNumber(pct, 2)}%`

export default function IngresosGastosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ReportData | null>(null)
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [businessUnitId, setBusinessUnitId] = useState<string>('')
  const [plantId, setPlantId] = useState<string>('')

  useEffect(() => {
    if (selectedMonth) {
      loadData()
    }
  }, [selectedMonth, businessUnitId, plantId])

  const loadData = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/reports/gerencial/ingresos-gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          businessUnitId: businessUnitId || null,
          plantId: plantId || null
        })
      })

      const result = await resp.json()
      if (!resp.ok) {
        throw new Error(result.error || 'Failed to load data')
      }

      setData(result)
    } catch (err: any) {
      console.error('Error loading ingresos-gastos:', err)
      setData({
        month: selectedMonth,
        plants: [],
        filters: { businessUnits: [], plants: [] }
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBusinessUnitChange = (value: string) => {
    setBusinessUnitId(value === 'all' ? '' : value)
    setPlantId('')
  }

  const handlePlantChange = (value: string) => {
    setPlantId(value === 'all' ? '' : value)
  }

  const availablePlants = data?.filters.plants.filter(p =>
    !businessUnitId || p.business_unit_id === businessUnitId
  ) || []

  const plants = data?.plants || []

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ingresos vs Gastos</h1>
          <p className="text-muted-foreground">
            Análisis financiero mensual por planta: ingresos, costos y EBITDA
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/reportes/gerencial/manual-costs')}
          >
            <Settings className="w-4 h-4 mr-2" />
            Gestionar Costos Manuales
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="month">Mes</Label>
              <Input
                id="month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>

            <div>
              <Label>Unidad de Negocio</Label>
              <Select value={businessUnitId || 'all'} onValueChange={handleBusinessUnitChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las unidades</SelectItem>
                  {data?.filters.businessUnits.map(bu => (
                    <SelectItem key={bu.id} value={bu.id}>{bu.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Planta</Label>
              <Select value={plantId || 'all'} onValueChange={handlePlantChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las plantas</SelectItem>
                  {availablePlants.map(plant => (
                    <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2 col-span-2">
              <Button onClick={loadData} disabled={loading} className="flex-1">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Cargando...' : 'Actualizar'}
              </Button>
              <Button variant="outline" disabled={!data || loading}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      {plants.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center gap-4">
              <AlertCircle className="w-12 h-12 text-muted-foreground opacity-50" />
              <div>
                <p className="text-lg font-medium">No hay datos disponibles</p>
                <p className="text-sm text-muted-foreground">
                  No se encontraron datos para el mes seleccionado. Verifica que existan registros en la vista financiera.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tabla Financiera - {selectedMonth}</CardTitle>
            <CardDescription>
              Datos consolidados por planta con cálculos automáticos y manuales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2">
                    <th className="sticky left-0 z-10 bg-background text-left p-3 font-medium min-w-[200px] border-r-2">
                      Métrica
                    </th>
                    {plants.map(plant => (
                      <th key={plant.plant_id} className="text-right p-3 font-medium min-w-[140px] border-r">
                        {plant.plant_code || plant.plant_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* INGRESOS CONCRETO SECTION */}
                  <tr className="bg-blue-50 dark:bg-blue-950/20">
                    <td colSpan={plants.length + 1} className="p-2 font-semibold text-sm uppercase tracking-wide">
                      Ingresos Concreto
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Volumen Concreto (m³)</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatNumber(p.volumen_concreto, 2)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">f'c Ponderada (kg/cm²)</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatNumber(p.fc_ponderada, 2)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Edad Ponderada (días)</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatNumber(p.edad_ponderada, 2)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">PV Unitario</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-medium">{formatCurrency(p.pv_unitario)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30 bg-blue-100/50 dark:bg-blue-900/20">
                    <td className="sticky left-0 z-10 bg-blue-100 dark:bg-blue-900/30 p-3 border-r-2 font-bold">Ventas Total Concreto</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-bold text-lg">{formatCurrency(p.ventas_total)}</td>
                    ))}
                  </tr>

                  {/* COSTO MATERIA PRIMA SECTION */}
                  <tr className="bg-orange-50 dark:bg-orange-950/20">
                    <td colSpan={plants.length + 1} className="p-2 font-semibold text-sm uppercase tracking-wide">
                      Costo Materia Prima
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Costo MP Unitario</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-medium">{formatCurrency(p.costo_mp_unitario)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Consumo Cem / m3 (kg)</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatNumber(p.consumo_cem_m3, 2)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Costo Cem / m3 ($ Unitario)</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatCurrency(p.costo_cem_m3)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Costo Cem %</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatPercent(p.costo_cem_pct)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30 bg-orange-100/50 dark:bg-orange-900/20">
                    <td className="sticky left-0 z-10 bg-orange-100 dark:bg-orange-900/30 p-3 border-r-2 font-bold">Costo MP Total Concreto</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-bold text-lg">{formatCurrency(p.costo_mp_total)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Costo MP %</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-medium">{formatPercent(p.costo_mp_pct)}</td>
                    ))}
                  </tr>

                  {/* SPREAD SECTION */}
                  <tr className="bg-green-50 dark:bg-green-950/20">
                    <td colSpan={plants.length + 1} className="p-2 font-semibold text-sm uppercase tracking-wide">
                      Spread
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Spread Unitario</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-semibold text-green-700 dark:text-green-400">
                        {formatCurrency(p.spread_unitario)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Spread Unitario %</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-medium">{formatPercent(p.spread_unitario_pct)}</td>
                    ))}
                  </tr>

                  {/* COSTO OPERATIVO SECTION */}
                  <tr className="bg-purple-50 dark:bg-purple-950/20">
                    <td colSpan={plants.length + 1} className="p-2 font-semibold text-sm uppercase tracking-wide">
                      Costo Operativo
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-muted/30 bg-yellow-50/50 dark:bg-yellow-900/10">
                    <td className="sticky left-0 z-10 bg-yellow-50 dark:bg-yellow-900/20 p-3 border-r-2 font-semibold">Diesel (Todas las Unidades)</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-semibold">{formatCurrency(p.diesel_total)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Diesel Unitario (m3)</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatCurrency(p.diesel_unitario)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Diesel %</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatPercent(p.diesel_pct)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30 bg-orange-50/50 dark:bg-orange-900/10">
                    <td className="sticky left-0 z-10 bg-orange-50 dark:bg-orange-900/20 p-3 border-r-2 font-semibold">MANTTO. (Todas las Unidades)</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-semibold">{formatCurrency(p.mantto_total)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Mantto. Unitario (m3)</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatCurrency(p.mantto_unitario)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Mantenimiento %</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatPercent(p.mantto_pct)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30 bg-amber-50/50 dark:bg-amber-900/10">
                    <td className="sticky left-0 z-10 bg-amber-50 dark:bg-amber-900/20 p-3 border-r-2 font-semibold">Nómina Totales</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-semibold">{formatCurrency(p.nomina_total)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Nómina Unitario (m3)</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatCurrency(p.nomina_unitario)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Nómina %</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatPercent(p.nomina_pct)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30 bg-cyan-50/50 dark:bg-cyan-900/10">
                    <td className="sticky left-0 z-10 bg-cyan-50 dark:bg-cyan-900/20 p-3 border-r-2 font-semibold">Otros Indirectos Totales</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-semibold">{formatCurrency(p.otros_indirectos_total)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Otros Indirectos Unitario (m3)</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatCurrency(p.otros_indirectos_unitario)}</td>
                    ))}
                  </tr>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Otros Indirectos %</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r">{formatPercent(p.otros_indirectos_pct)}</td>
                    ))}
                  </tr>
                  <tr className="border-b-2 hover:bg-muted/30 bg-purple-100/70 dark:bg-purple-900/30">
                    <td className="sticky left-0 z-10 bg-purple-100 dark:bg-purple-900/40 p-3 border-r-2 font-bold text-base">TOTAL COSTO OP</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-bold text-lg">{formatCurrency(p.total_costo_op)}</td>
                    ))}
                  </tr>
                  <tr className="border-b-2 hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2 font-bold">TOTAL COSTO OP %</td>
                    {plants.map(p => (
                      <td key={p.plant_id} className="text-right p-3 border-r font-bold">{formatPercent(p.total_costo_op_pct)}</td>
                    ))}
                  </tr>

                  {/* EBITDA SECTION */}
                  <tr className="bg-emerald-50 dark:bg-emerald-950/20">
                    <td colSpan={plants.length + 1} className="p-2 font-semibold text-sm uppercase tracking-wide">
                      EBITDA
                    </td>
                  </tr>
                  <tr className="border-b-2 hover:bg-muted/30 bg-emerald-100/70 dark:bg-emerald-900/30">
                    <td className="sticky left-0 z-10 bg-emerald-100 dark:bg-emerald-900/40 p-3 border-r-2 font-bold text-base">EBITDA</td>
                    {plants.map(p => (
                      <td 
                        key={p.plant_id} 
                        className={`text-right p-3 border-r font-bold text-lg ${p.ebitda < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}
                      >
                        {formatCurrency(p.ebitda)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b-2 hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background p-3 border-r-2 font-bold">EBITDA %</td>
                    {plants.map(p => (
                      <td 
                        key={p.plant_id} 
                        className={`text-right p-3 border-r font-bold ${p.ebitda_pct < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
                      >
                        {formatPercent(p.ebitda_pct)}
                      </td>
                    ))}
                  </tr>

                  {/* OPTIONAL BOMBEO SECTION */}
                  {plants.some(p => p.ingresos_bombeo_vol && p.ingresos_bombeo_vol > 0) && (
                    <>
                      <tr className="bg-slate-50 dark:bg-slate-950/20">
                        <td colSpan={plants.length + 1} className="p-2 font-semibold text-sm uppercase tracking-wide">
                          Ingresos Bombeo
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Ingresos Bombeo Vol</td>
                        {plants.map(p => (
                          <td key={p.plant_id} className="text-right p-3 border-r">{formatNumber(p.ingresos_bombeo_vol || 0, 2)}</td>
                        ))}
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="sticky left-0 z-10 bg-background p-3 border-r-2">Ingresos Bombeo $ Unit</td>
                        {plants.map(p => (
                          <td key={p.plant_id} className="text-right p-3 border-r">{formatCurrency(p.ingresos_bombeo_unit || 0)}</td>
                        ))}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-muted/30 rounded-lg text-xs text-muted-foreground space-y-2">
              <p><strong>Fuentes de datos:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Ingresos y Materia Prima:</strong> Vista <code>vw_plant_financial_analysis_unified</code></li>
                <li><strong>Diesel y Mantenimiento:</strong> Calculado automáticamente del sistema de mantenimiento</li>
                <li><strong>Nómina y Otros Indirectos:</strong> Ingreso manual por administradores</li>
              </ul>
              <p className="mt-4">
                <strong>Nota:</strong> Los datos mostrados corresponden exclusivamente al mes seleccionado. 
                Para gestionar costos manuales (nómina y otros indirectos), use el botón "Gestionar Costos Manuales" en la parte superior.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}




