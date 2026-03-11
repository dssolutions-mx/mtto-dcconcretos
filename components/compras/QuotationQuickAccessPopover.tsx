"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ExternalLink, FileText, Image as ImageIcon, Loader2 } from "lucide-react"

interface QuotationQuickAccessPopoverProps {
  purchaseOrderId: string
  workOrderId?: string | null
  legacyUrl?: string | null
  quotationUrls?: string[] | unknown[] | null
  requiresQuote?: boolean
  /** Content for the trigger (e.g. icon button) */
  children: React.ReactNode
  onOpenChange?: (open: boolean) => void
}

export function QuotationQuickAccessPopover({
  purchaseOrderId,
  workOrderId,
  legacyUrl,
  quotationUrls,
  requiresQuote,
  children,
  onOpenChange,
}: QuotationQuickAccessPopoverProps) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<{ name: string; url: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchFiles = useCallback(async () => {
    const supabase = createClient()
    const collected: { name: string; url: string }[] = []

    // 1) Legacy URLs from DB (quotation_urls array or quotation_url)
    const rawUrls = Array.isArray(quotationUrls) ? quotationUrls : []
    const urls = rawUrls.length > 0
      ? rawUrls.filter((u): u is string => typeof u === "string" && !!u.trim())
      : legacyUrl
        ? [legacyUrl]
        : []
    for (const url of urls) {
      if (url && url.trim()) {
        const name = url.split("/").pop() || "Cotización"
        collected.push({ name, url: url.trim() })
      }
    }

    // 2) Storage: quotations bucket under workOrderId or purchaseOrderId
    const primaryFolder = workOrderId || purchaseOrderId
    try {
      const { data } = await (supabase as any).storage
        .from("quotations")
        .list(primaryFolder, { limit: 50, sortBy: { column: "created_at", order: "desc" } })
      if (Array.isArray(data)) {
        for (const obj of data) {
          const path = `${primaryFolder}/${obj.name}`
          const { data: urlData } = await (supabase as any).storage
            .from("quotations")
            .createSignedUrl(path, 3600 * 24 * 7)
          if (urlData?.signedUrl) {
            collected.push({ name: obj.name, url: urlData.signedUrl })
          }
        }
      }
    } catch {
      // ignore
    }

    // 3) Legacy documents bucket
    if (workOrderId && collected.length === 0) {
      try {
        const legacyFolder = `quotations/${workOrderId}`
        const { data } = await (supabase as any).storage
          .from("documents")
          .list(legacyFolder, { limit: 50, sortBy: { column: "created_at", order: "desc" } })
        if (Array.isArray(data)) {
          for (const obj of data) {
            const path = `${legacyFolder}/${obj.name}`
            const { data: urlData } = (supabase as any).storage.from("documents").getPublicUrl(path)
            if (urlData?.publicUrl) {
              collected.push({ name: obj.name, url: urlData.publicUrl })
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // Dedupe by name
    const seen = new Set<string>()
    const unique = collected.filter((f) => {
      if (seen.has(f.name)) return false
      seen.add(f.name)
      return true
    })
    setFiles(unique)
  }, [purchaseOrderId, workOrderId, legacyUrl, quotationUrls])

  useEffect(() => {
    if (open) {
      setIsLoading(true)
      fetchFiles().finally(() => setIsLoading(false))
    }
  }, [open, fetchFiles])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  const hasContent = requiresQuote || files.length > 0 || (quotationUrls?.length ?? 0) > 0 || !!legacyUrl

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <div className="flex items-center gap-2 border-b pb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Cotizaciones</span>
            {requiresQuote && (
              <span className="text-xs text-amber-600 ml-auto">Requerida</span>
            )}
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando...
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No hay cotizaciones cargadas.
              {hasContent && (
                <a
                  href={`/compras/${purchaseOrderId}`}
                  className="block mt-2 text-sky-600 hover:underline text-xs"
                >
                  Ver detalles para subir →
                </a>
              )}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {files.map((f) => {
                const isPdf = f.name.toLowerCase().endsWith(".pdf")
                return (
                  <a
                    key={f.name + f.url}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded p-2 hover:bg-muted/80 text-sm cursor-pointer"
                  >
                    {isPdf ? (
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1" title={f.name}>
                      {f.name}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                )
              })}
            </div>
          )}
          <a
            href={`/compras/${purchaseOrderId}`}
            className="block text-center text-xs text-sky-600 hover:underline pt-1"
          >
            Ver orden completa →
          </a>
        </div>
      </PopoverContent>
    </Popover>
  )
}
