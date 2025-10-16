"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { EvidenceViewer } from "@/components/ui/evidence-viewer"

interface TransactionEvidenceModalProps {
  transactionId: string | null
  isOpen: boolean
  onClose: () => void
  headerTitle?: string
  subheader?: string
}

interface EvidenceRow {
  id: string
  photo_url: string
  description: string | null
  category: string | null
  created_at: string
}

export function TransactionEvidenceModal({
  transactionId,
  isOpen,
  onClose,
  headerTitle = "Evidencia de la Transacción",
  subheader
}: TransactionEvidenceModalProps) {
  const [loading, setLoading] = useState(false)
  const [evidence, setEvidence] = useState<Array<{
    id: string
    url: string
    description: string
    category: string
    uploaded_at: string
  }>>([])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const fetchEvidence = async () => {
      if (!transactionId || !isOpen) return
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('diesel_evidence')
          .select('id, photo_url, description, category, created_at')
          .eq('transaction_id', transactionId)
          .order('created_at', { ascending: true })

        if (error) {
          // Silent fail; UI shows empty state
          console.error('Error loading evidence:', error)
          setEvidence([])
          return
        }

        const items = (data as EvidenceRow[] | null)?.map(row => ({
          id: row.id,
          url: row.photo_url,
          description: row.description || 'Evidencia',
          category: row.category || 'other',
          uploaded_at: row.created_at
        })) || []

        setEvidence(items)
      } finally {
        setLoading(false)
      }
    }

    fetchEvidence()
  }, [transactionId, isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[96vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{headerTitle}</DialogTitle>
          {subheader && (
            <DialogDescription>
              {subheader}
            </DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <EvidenceViewer
            evidence={evidence}
            title={evidence.length > 0 ? undefined : 'Evidencia'}
            showCategories
          />
        )}
      </DialogContent>
    </Dialog>
  )
}


