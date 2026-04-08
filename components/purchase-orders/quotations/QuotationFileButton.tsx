"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import {
  openQuotationFileInNewTab,
  quotationHasFile,
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

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    try {
      const supabase = createClient()
      const ok = await openQuotationFileInNewTab(supabase, quotation)
      if (!ok) {
        toast.error("No se pudo abrir el archivo. Si el problema continúa, vuelva a subir la cotización.")
      }
    } finally {
      setLoading(false)
    }
  }

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
