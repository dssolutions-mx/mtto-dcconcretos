"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase"

export function ExcelImport() {
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setNotes(null)
    try {
      const supabase = createClient()
      // Upload to storage bucket 'imports' to process from backend or edge function
      const { data, error } = await supabase.storage.from('imports').upload(`diesel/${Date.now()}-${file.name}`, file, { upsert: false })
      if (error) throw error
      setNotes(`Archivo subido: ${data.path}. Procesa el lote desde staging con el botón Procesar.`)
    } catch (e: any) {
      setNotes(e?.message || 'Error subiendo archivo')
    } finally {
      setLoading(false)
    }
  }

  const handleProcessStaging = async () => {
    setLoading(true)
    setNotes(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('process_diesel_excel_staging', {})
      if (error) throw error
      setNotes('Procesamiento iniciado. Revisa notas en registros de staging.')
    } catch (e: any) {
      setNotes(e?.message || 'Error procesando staging')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar desde Excel</CardTitle>
        <CardDescription>Sube tu archivo para cargar registros a `diesel_excel_staging`</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div className="flex gap-2">
          <Button onClick={handleUpload} disabled={!file || loading}>Subir</Button>
          <Button variant="outline" onClick={handleProcessStaging} disabled={loading}>Procesar</Button>
        </div>
        {notes && (
          <div className="text-sm text-muted-foreground">{notes}</div>
        )}
      </CardContent>
    </Card>
  )
}


