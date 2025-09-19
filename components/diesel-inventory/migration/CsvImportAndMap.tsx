"use client"

import { useMemo, useState } from "react"
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase"
import { useResolveAssetName, useRecordDieselTransaction } from "@/hooks/use-diesel"

type ParsedRow = Record<string, string>

const requiredFields = [
  { key: "transaction_date", label: "Fecha" },
  { key: "plant_id", label: "Planta (UUID)" },
  { key: "warehouse_id", label: "Almacén (UUID)" },
  { key: "product_id", label: "Producto (UUID)" },
  { key: "transaction_type", label: "Tipo (entry|consumption|adjustment)" },
  { key: "quantity_liters", label: "Cantidad (L)" },
  { key: "asset_name", label: "Nombre de Activo (texto)" }
]

export function CsvImportAndMap() {
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState<{ total: number; success: number; failed: number }>({ total: 0, success: 0, failed: 0 })
  const [log, setLog] = useState<string[]>([])

  const { resolve } = useResolveAssetName()
  const { record } = useRecordDieselTransaction()

  const canProcess = useMemo(() => {
    return requiredFields.every(f => mapping[f.key]) && rows.length > 0
  }, [mapping, rows])

  const parseCsv = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const data = (result.data as any[]).filter(Boolean) as ParsedRow[]
        const headerList = result.meta.fields || Object.keys(data[0] || {})
        setHeaders(headerList)
        setRows(data)
      },
      error: (err) => {
        setLog(prev => [...prev, `Error parsing CSV: ${err.message}`])
      }
    })
  }

  const handleProcess = async () => {
    setProcessing(true)
    setProgress({ total: rows.length, success: 0, failed: 0 })
    setLog([])
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id || "unknown"

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      try {
        const txType = (r[mapping.transaction_type] || '').toLowerCase() as any
        const qty = Number(r[mapping.quantity_liters])
        const assetName = r[mapping.asset_name] || ''
        const resolution = assetName ? await resolve(assetName, true) : { resolution_type: 'general', asset_id: null, exception_asset_id: null, asset_category: 'general' }

        await record({
          plant_id: r[mapping.plant_id] || null,
          warehouse_id: r[mapping.warehouse_id],
          asset_id: resolution.asset_id,
          exception_asset_name: resolution.resolution_type === 'exception' ? assetName : null,
          asset_category: resolution.asset_category,
          product_id: r[mapping.product_id],
          transaction_type: txType,
          quantity_liters: qty,
          horometer_reading: null,
          kilometer_reading: null,
          operator_id: null,
          transaction_date: new Date(r[mapping.transaction_date]).toISOString(),
          created_by: userId
        })

        setProgress(p => ({ ...p, success: p.success + 1 }))
      } catch (e: any) {
        setProgress(p => ({ ...p, failed: p.failed + 1 }))
        setLog(prev => [...prev, `Row ${i + 1}: ${e?.message || 'Unknown error'}`])
      }
    }

    setProcessing(false)
    setLog(prev => [...prev, `Procesamiento terminado. Éxitos: ${progress.success}, Fallidos: ${progress.failed}`])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar CSV y Mapear Columnas</CardTitle>
        <CardDescription>Asigna columnas del archivo a los campos requeridos del sistema</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Archivo CSV</Label>
          <Input type="file" accept=".csv" onChange={(e) => {
            const f = e.target.files?.[0] || null
            setFile(f)
            if (f) parseCsv(f)
          }} />
        </div>

        {headers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {requiredFields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label>{f.label}</Label>
                <Select value={mapping[f.key] || ''} onValueChange={(v) => setMapping(prev => ({ ...prev, [f.key]: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona columna" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={handleProcess} disabled={!canProcess || processing}>Procesar Registros</Button>
          <div className="text-sm text-muted-foreground">
            Total: {progress.total} · Éxito: {progress.success} · Error: {progress.failed}
          </div>
        </div>

        {log.length > 0 && (
          <div className="text-xs whitespace-pre-wrap bg-muted/40 p-3 rounded border max-h-64 overflow-auto">
            {log.join("\n")}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


