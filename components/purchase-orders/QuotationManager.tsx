"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Download, ExternalLink, FileText, Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react"
import { cn } from "@/lib/utils"

type QuotationSource = 'quotations' | 'documents' | 'legacy'

interface QuotationFile {
  name: string
  path: string
  signedUrl?: string
  size?: number
  type?: string
  source: QuotationSource
}

interface QuotationManagerProps {
  purchaseOrderId: string
  workOrderId?: string | null
  onChanged?: () => void
  readOnly?: boolean
  className?: string
  legacyUrl?: string | null
}

function getPrimaryFolder(purchaseOrderId: string, workOrderId?: string | null) {
  // Primary convention: store files under the work order id root if available, otherwise under PO id root
  if (workOrderId) return `${workOrderId}`
  return `${purchaseOrderId}`
}

export function QuotationManager({ purchaseOrderId, workOrderId, onChanged, readOnly = false, className, legacyUrl }: QuotationManagerProps) {
  const supabase = createClient()
  const [files, setFiles] = useState<QuotationFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const primaryFolder = useMemo(() => getPrimaryFolder(purchaseOrderId, workOrderId), [purchaseOrderId, workOrderId])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const collected: QuotationFile[] = []

      // 1) Primary: quotations bucket under primaryFolder
      try {
        const { data: dataQ, error: errQ } = await (supabase as any).storage
          .from('quotations')
          .list(primaryFolder, { limit: 100, offset: 0, sortBy: { column: 'created_at', order: 'desc' } })
        if (!errQ && Array.isArray(dataQ)) {
          for (const obj of dataQ) {
            const path = `${primaryFolder}/${obj.name}`
            const { data: urlData } = await (supabase as any).storage
              .from('quotations')
              .createSignedUrl(path, 3600 * 24 * 7)
            if (urlData?.signedUrl) collected.push({ name: obj.name, path, signedUrl: urlData.signedUrl, source: 'quotations' })
          }
        }
      } catch {}

      // 2) Legacy: documents bucket under quotations/{workOrderId}
      if (workOrderId && collected.length === 0) {
        try {
          const legacyFolder = `quotations/${workOrderId}`
          const { data: dataD, error: errD } = await (supabase as any).storage
            .from('documents')
            .list(legacyFolder, { limit: 100, offset: 0, sortBy: { column: 'created_at', order: 'desc' } })
          if (!errD && Array.isArray(dataD)) {
            for (const obj of dataD) {
              const path = `${legacyFolder}/${obj.name}`
              // documents bucket was public in legacy usage, use public URL
              const { data: urlData } = (supabase as any).storage.from('documents').getPublicUrl(path)
              if (urlData?.publicUrl) collected.push({ name: obj.name, path, signedUrl: urlData.publicUrl, source: 'documents' })
            }
          }
        } catch {}
      }

      // 3) Optional: show single legacy URL stored in DB (only if still nothing found)
      if (legacyUrl && collected.length === 0) {
        collected.unshift({ name: legacyUrl.split('/').pop() || 'cotizacion', path: legacyUrl, signedUrl: legacyUrl, source: 'legacy' })
      }

      // Deduplicate by filename to avoid duplicates across sources
      const seen = new Set<string>()
      const unique: QuotationFile[] = []
      for (const f of collected) {
        const key = f.name
        if (!seen.has(key)) {
          seen.add(key)
          unique.push(f)
        }
      }

      setFiles(unique)
    } catch (e) {
      // Ignore listing errors silently
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [primaryFolder, supabase, workOrderId, legacyUrl])

  useEffect(() => {
    refresh()
  }, [refresh])

  const onFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return
    setIsUploading(true)
    try {
      const fileList = Array.from(e.target.files)
      for (const file of fileList) {
        const ext = file.name.split('.').pop()
        const base = file.name.replace(/\.[^/.]+$/, '')
        const safeBase = base.replace(/[^a-zA-Z0-9-_]/g, '_')
        const fileName = `${primaryFolder}/${Date.now()}_${safeBase}.${ext}`
        const { error: uploadError } = await (supabase as any).storage
          .from('quotations')
          .upload(fileName, file, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
      }
      await refresh()
      onChanged?.()
    } catch (error) {
      // Consider adding toast in parent context
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const onDelete = async (path: string, source: QuotationSource) => {
    try {
      if (source !== 'quotations') return // Only allow deleting from the primary bucket
      const { error } = await (supabase as any).storage.from('quotations').remove([path])
      if (error) throw error
      await refresh()
      onChanged?.()
    } catch (error) {
      // ignore
    }
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="pt-4">
        {!readOnly && (
          <div className="mb-4 flex items-center gap-3">
            <Label className="shrink-0">Subir cotizaciones</Label>
            <Input type="file" multiple accept="application/pdf,image/*" onChange={onFileInput} disabled={isUploading} />
            <Button type="button" variant="outline" disabled>
              <Upload className="h-4 w-4 mr-2" />Seleccionar
            </Button>
            {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando cotizaciones...</div>
        ) : files.length === 0 ? (
          <div className="text-sm text-muted-foreground">No hay cotizaciones cargadas.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {files.map((f) => {
              const isPdf = f.name.toLowerCase().endsWith('.pdf')
              return (
                <div key={f.path} className="border rounded p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                    <a href={f.signedUrl} target="_blank" rel="noopener noreferrer" className="truncate flex items-center gap-1">
                      <span className="truncate" title={f.name}>{f.name}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {!readOnly && f.source === 'quotations' && (
                    <Button variant="ghost" size="icon" onClick={() => onDelete(f.path, f.source)} title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


