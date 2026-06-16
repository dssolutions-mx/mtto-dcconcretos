'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import {
  generateCsvTemplate,
  type CsvImportRow,
  type CsvImportRowError,
} from '@/lib/tires/csv-import'
import { ArrowLeft, Download, FileUp, Loader2, Upload } from 'lucide-react'

type ImportStep = 'upload' | 'preview' | 'done'

export function CsvImportWizardPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<ImportStep>('upload')
  const [loading, setLoading] = useState(false)
  const [validRows, setValidRows] = useState<CsvImportRow[]>([])
  const [errors, setErrors] = useState<CsvImportRowError[]>([])
  const [createdCount, setCreatedCount] = useState(0)

  const downloadTemplate = () => {
    const blob = new Blob([generateCsvTemplate()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla-llantas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const runDryRun = useCallback(async (csvText: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/tires/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_text: csvText, dry_run: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error en validación')

      setValidRows(data.valid_rows ?? [])
      setErrors(data.errors ?? [])
      setStep('preview')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al validar CSV')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleFile = async (file: File) => {
    const text = await file.text()
    await runDryRun(text)
  }

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/tires/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows, dry_run: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al importar')

      setCreatedCount(data.created_count ?? 0)
      if (data.error_count > 0) {
        setErrors(data.errors ?? [])
        toast.warning(`${data.created_count} importadas, ${data.error_count} con error`)
      } else {
        toast.success(`${data.created_count} llantas importadas`)
      }
      setStep('done')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al importar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Importar llantas desde CSV"
        text="Cargue inventario en lote con validación previa. Máximo 100 filas por lote."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/activos/llantas">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Inventario
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Descargar plantilla
          </Button>
        </div>
      </DashboardHeader>

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Cargar archivo CSV</CardTitle>
            <CardDescription>
              Columnas: marca, medida, modelo, dot, condicion, costo_compra, fecha_compra,
              almacen_id (opcional).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="min-h-11"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              Seleccionar archivo CSV
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <Alert variant={errors.length > 0 ? 'destructive' : 'default'}>
            <AlertDescription>
              {validRows.length} fila(s) válida(s), {errors.length} error(es). Revise antes de
              confirmar.
            </AlertDescription>
          </Alert>

          {errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-destructive">Errores de validación</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fila</TableHead>
                      <TableHead>Campo</TableHead>
                      <TableHead>Mensaje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errors.map((err, i) => (
                      <TableRow key={`${err.row_number}-${i}`}>
                        <TableCell>{err.row_number}</TableCell>
                        <TableCell>{err.field ?? '—'}</TableCell>
                        <TableCell>{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {validRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vista previa ({validRows.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fila</TableHead>
                      <TableHead>Marca / Medida</TableHead>
                      <TableHead>DOT</TableHead>
                      <TableHead>Condición</TableHead>
                      <TableHead>Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRows.map((row) => (
                      <TableRow key={row.row_number}>
                        <TableCell>{row.row_number}</TableCell>
                        <TableCell>
                          {row.marca} {row.medida}
                        </TableCell>
                        <TableCell>{row.dot ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.condicion}</Badge>
                        </TableCell>
                        <TableCell>
                          {row.costo_compra != null
                            ? `$${row.costo_compra.toLocaleString('es-MX')}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep('upload')}>
              Volver
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={loading || validRows.length === 0}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Confirmar importación ({validRows.length})
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <Card>
          <CardHeader>
            <CardTitle>Importación completada</CardTitle>
            <CardDescription>
              Se registraron {createdCount} llanta(s) en almacén.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/activos/llantas">Ver inventario</Link>
            </Button>
            <Button variant="outline" onClick={() => {
              setStep('upload')
              setValidRows([])
              setErrors([])
            }}>
              Importar otro lote
            </Button>
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  )
}
