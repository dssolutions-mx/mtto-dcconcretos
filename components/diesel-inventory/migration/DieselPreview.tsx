"use client"

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  CheckCircle, AlertTriangle, Clock, FileText, Filter, Droplets, Building2, Tags, Info
} from 'lucide-react'
import { DieselExcelRow } from '@/types/diesel'
import { useDieselStore } from '@/store/diesel-store'

type Props = {
  rows: DieselExcelRow[]
  fileName?: string
}

export default function DieselPreview({ rows, fileName }: Props) {
  const { validateExcelData } = useDieselStore()
  const [showOnlyIssues, setShowOnlyIssues] = useState(false)
  const [plantFilter, setPlantFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')

  const validation = useMemo(() => validateExcelData(rows), [rows, validateExcelData])

  // Map errors/warnings per row index (1-based in validator)
  const rowIssues = useMemo(() => {
    const issues = new Map<number, { errors: string[]; warnings: string[] }>()
    validation.errors.forEach(e => {
      const current = issues.get(e.rowNumber) || { errors: [], warnings: [] }
      current.errors.push(`${e.field}: ${e.message}`)
      issues.set(e.rowNumber, current)
    })
    validation.warnings.forEach(w => {
      const current = issues.get(w.rowNumber) || { errors: [], warnings: [] }
      current.warnings.push(`${w.field}: ${w.message}`)
      issues.set(w.rowNumber, current)
    })
    return issues
  }, [validation])

  const enriched = useMemo(() => {
    return rows.map((r, i) => {
      const idx = i + 1
      const iw = rowIssues.get(idx)
      let status: 'valid' | 'warning' | 'error' = 'valid'
      if (iw?.errors.length) status = 'error'
      else if (iw?.warnings.length) status = 'warning'
      const litros = typeof r.litros_cantidad === 'number' ? r.litros_cantidad : Number(r.litros_cantidad) || 0
      return { r, idx, status, litros, issues: iw }
    })
  }, [rows, rowIssues])

  const plants = useMemo(() => Array.from(new Set(rows.map(r => (r.planta || '').trim()).filter(Boolean))).sort(), [rows])
  const tipos = useMemo(() => Array.from(new Set(rows.map(r => r.tipo).filter(Boolean))).sort(), [rows])

  const filtered = useMemo(() => {
    return enriched.filter(e => {
      if (showOnlyIssues && e.status === 'valid') return false
      if (plantFilter && (e.r.planta || '').trim() !== plantFilter) return false
      if (typeFilter && e.r.tipo !== typeFilter) return false
      return true
    })
  }, [enriched, showOnlyIssues, plantFilter, typeFilter])

  const summary = useMemo(() => {
    const total = rows.length
    const valid = enriched.filter(e => e.status === 'valid').length
    const warning = enriched.filter(e => e.status === 'warning').length
    const error = enriched.filter(e => e.status === 'error').length
    const entradas = rows.filter(r => r.tipo === 'Entrada').length
    const salidas = rows.filter(r => r.tipo === 'Salida').length
    const totalLitros = enriched.reduce((s, e) => s + (e.litros || 0), 0)
    return { total, valid, warning, error, entradas, salidas, totalLitros }
  }, [rows, enriched])

  const statusIcon = (status: 'valid' | 'warning' | 'error') => {
    switch (status) {
      case 'valid': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-600" />
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-600" />
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Vista previa de datos
          </CardTitle>
          <CardDescription>
            {fileName ? `Archivo: ${fileName}` : 'Datos parseados del archivo cargado'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
            <div className="text-center">
              <div className="font-bold text-lg">{summary.total}</div>
              <div className="text-gray-600">Filas</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-green-600">{summary.valid}</div>
              <div className="text-green-700">Válidas</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-amber-600">{summary.warning}</div>
              <div className="text-amber-700">Avisos</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-red-600">{summary.error}</div>
              <div className="text-red-700">Errores</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-blue-600">{summary.entradas}</div>
              <div className="text-blue-700">Entradas</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-purple-600">{summary.salidas}</div>
              <div className="text-purple-700">Salidas</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-600 flex items-center gap-2">
            <Droplets className="h-3 w-3" /> Total litros: <span className="font-mono">{summary.totalLitros.toLocaleString('es-MX')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showOnlyIssues} onChange={e => setShowOnlyIssues(e.target.checked)} />
                Mostrar sólo incidencias
              </label>
              <div className="flex items-center gap-2">
                <Building2 className="h-3 w-3" />
                <select className="border rounded px-2 py-1" value={plantFilter} onChange={e => setPlantFilter(e.target.value)}>
                  <option value="">Todas las plantas</option>
                  {plants.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Tags className="h-3 w-3" />
                <select className="border rounded px-2 py-1" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                  <option value="">Todos los tipos</option>
                  {tipos.map(t => <option key={String(t)} value={String(t)}>{String(t)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Filter className="h-4 w-4" /> Mostrando {filtered.length} de {rows.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-2 w-8"></th>
              <th className="p-2">Estado</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Planta</th>
              <th className="p-2">Unidad</th>
              <th className="p-2">Identificador</th>
              <th className="p-2">Litros</th>
              <th className="p-2">Detalles</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ r, idx, status, litros, issues }) => (
              <React.Fragment key={`${r.identificador}-${idx}`}>
                <tr className="border-t hover:bg-gray-50">
                  <td className="p-2 text-[10px] text-gray-500">#{idx}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      {statusIcon(status)}
                      <span className="text-xs">
                        {status === 'valid' ? 'OK' : status === 'warning' ? 'Aviso' : 'Error'}
                      </span>
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="text-xs font-mono">{r.fecha_}</div>
                    <div className="text-[11px] text-gray-500">{r.horario}</div>
                  </td>
                  <td className="p-2">{r.tipo}</td>
                  <td className="p-2">{r.planta}</td>
                  <td className="p-2">{r.unidad || <span className="text-gray-400">—</span>}</td>
                  <td className="p-2 font-mono">{r.identificador}</td>
                  <td className="p-2 text-right font-mono">{litros.toLocaleString('es-MX')}</td>
                  <td className="p-2">
                    {issues ? (
                      <Badge variant="outline" className="text-xs">
                        {issues.errors.length} err / {issues.warnings.length} warn
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Sin incidencias</Badge>
                    )}
                  </td>
                </tr>
                {issues && (
                  <tr className="border-t bg-gray-50">
                    <td colSpan={9} className="p-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-amber-900 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Errores ({issues.errors.length})</h4>
                          <div className="space-y-1 max-h-28 overflow-auto">
                            {issues.errors.length === 0 ? (
                              <div className="text-green-600">Ninguno</div>
                            ) : issues.errors.map((m, i) => (
                              <div key={i} className="p-2 bg-amber-50 border border-amber-200 rounded">{m}</div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-blue-900 flex items-center gap-1"><Info className="h-3 w-3" /> Avisos ({issues.warnings.length})</h4>
                          <div className="space-y-1 max-h-28 overflow-auto">
                            {issues.warnings.length === 0 ? (
                              <div className="text-green-600">Ninguno</div>
                            ) : issues.warnings.map((m, i) => (
                              <div key={i} className="p-2 bg-blue-50 border border-blue-200 rounded">{m}</div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold">Datos originales</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div><span className="text-gray-600">Creado:</span> {r.creado}</div>
                            <div><span className="text-gray-600">Almacén:</span> {r.almacen}</div>
                            <div><span className="text-gray-600">Cuenta litros:</span> {String(r.cuenta_litros ?? '')}</div>
                            <div><span className="text-gray-600">Validación:</span> {r.validacion || '—'}</div>
                            <div><span className="text-gray-600">Inv. inicial:</span> {String(r.inventario_inicial ?? '')}</div>
                            <div><span className="text-gray-600">Inventario:</span> {String(r.inventario ?? '')}</div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Validation-level alerts */}
      {!validation.isValid && (
        <Alert variant="destructive">
          <AlertTitle>Errores de Validación</AlertTitle>
          <AlertDescription>
            <ScrollArea className="h-32 w-full mt-2">
              <div className="space-y-1">
                {validation.errors.slice(0, 50).map((e, i) => (
                  <div key={`${e.field}-${e.rowNumber}-${i}`} className="text-sm">
                    • Fila {e.rowNumber}: {e.field} - {e.message}
                  </div>
                ))}
                {validation.errors.length > 50 && (
                  <div className="text-sm text-muted-foreground">... y {validation.errors.length - 50} más</div>
                )}
              </div>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}




