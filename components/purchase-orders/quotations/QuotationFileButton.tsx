"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileText, Loader2, ChevronDown } from "lucide-react"
import { createClient } from "@/lib/supabase"
import {
  openQuotationFileInNewTab,
  openQuotationPathInNewTab,
  quotationHasFile,
  resolveQuotationsObjectPath,
} from "@/lib/quotations/quotation-file-access"
import type { QuotationFileFields } from "@/lib/quotations/quotation-file-access"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Props = {
  quotation: QuotationFileFields
  className?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  children?: React.ReactNode
  label?: string
  fullWidth?: boolean
}

function countQuotationFiles(q: QuotationFileFields): number {
  let n = 0
  if (resolveQuotationsObjectPath(q) || q.file_url?.trim()) n += 1
  n += q.additional_files?.filter((a) => a.file_storage_path?.trim()).length ?? 0
  return n
}

export function QuotationFileButton({
  quotation,
  className,
  variant = "outline",
  size = "sm",
  children,
  label = "Ver Cotización",
  fullWidth,
}: Props) {
  const [loading, setLoading] = useState(false)

  if (!quotationHasFile(quotation)) {
    return null
  }

  const fileCount = countQuotationFiles(quotation)
  const extra = (quotation.additional_files ?? []).filter((a) => a.file_storage_path?.trim())

  const openPrimary = async (supabase: ReturnType<typeof createClient>) => {
    return openQuotationFileInNewTab(supabase, quotation)
  }

  const openExtraPath = async (path: string) => {
    const supabase = createClient()
    return openQuotationPathInNewTab(supabase, path)
  }

  const openDefaultFile = async () => {
    const supabase = createClient()
    if (resolveQuotationsObjectPath(quotation) || quotation.file_url?.trim()) {
      return openPrimary(supabase)
    }
    const first = extra[0]
    if (first) return openExtraPath(first.file_storage_path)
    return false
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    try {
      const ok = await openDefaultFile()
      if (!ok) {
        toast.error("No se pudo abrir el archivo. Si el problema continúa, vuelva a subir la cotización.")
      }
    } finally {
      setLoading(false)
    }
  }

  if (fileCount <= 1) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(fullWidth && "w-full", className)}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          children ?? (
            <>
              <FileText className="h-4 w-4 mr-2" />
              {label}
            </>
          )
        )}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn(fullWidth && "w-full", className)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          ) : (
            children ?? (
              <>
                <FileText className="h-4 w-4 mr-2" />
                {label} ({fileCount})
                <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
              </>
            )
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[12rem]">
        {resolveQuotationsObjectPath(quotation) || quotation.file_url?.trim() ? (
          <DropdownMenuItem
            onSelect={async (ev) => {
              ev.preventDefault()
              setLoading(true)
              try {
                const supabase = createClient()
                const ok = await openPrimary(supabase)
                if (!ok) toast.error("No se pudo abrir el archivo principal.")
              } finally {
                setLoading(false)
              }
            }}
          >
            {quotation.file_name?.trim() || "Archivo principal"}
          </DropdownMenuItem>
        ) : null}
        {extra.map((a) => (
          <DropdownMenuItem
            key={a.file_storage_path}
            onSelect={async (ev) => {
              ev.preventDefault()
              setLoading(true)
              try {
                const ok = await openExtraPath(a.file_storage_path)
                if (!ok) toast.error("No se pudo abrir el archivo.")
              } finally {
                setLoading(false)
              }
            }}
          >
            {a.file_name?.trim() || a.file_storage_path.split("/").pop() || "Adjunto"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
