'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { ComplianceIncidentWithDetails } from '@/types/compliance'

interface DisputeReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  incidentId: string
  incident: ComplianceIncidentWithDetails
  onReviewCompleted?: () => void
}

export function DisputeReviewDialog({
  open,
  onOpenChange,
  incidentId,
  incident,
  onReviewCompleted
}: DisputeReviewDialogProps) {
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!decision) {
      setError('Por favor selecciona una decisión')
      return
    }

    if (decision === 'rejected' && !reviewNotes.trim()) {
      setError('Por favor proporciona una razón para rechazar la disputa')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/compliance/incidents/${incidentId}/dispute/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision,
          review_notes: reviewNotes.trim() || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al revisar la disputa')
      }

      toast({
        title: decision === 'approved' ? 'Disputa Aprobada' : 'Disputa Rechazada',
        description: decision === 'approved'
          ? 'La disputa ha sido aprobada y el incidente ha sido descartado.'
          : 'La disputa ha sido rechazada.',
      })

      setDecision(null)
      setReviewNotes('')
      onOpenChange(false)
      onReviewCompleted?.()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setDecision(null)
    setReviewNotes('')
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Revisar Disputa
          </DialogTitle>
          <DialogDescription>
            Revisa la disputa del usuario y toma una decisión.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Dispute Reason */}
          {incident.dispute_reason && (
            <Alert>
              <AlertDescription>
                <strong>Razón de la Disputa:</strong>
                <p className="mt-2 text-sm bg-muted p-3 rounded-md">{incident.dispute_reason}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Decision */}
          <div className="space-y-2">
            <Label>Decisión <span className="text-red-500">*</span></Label>
            <RadioGroup value={decision || ''} onValueChange={(value) => setDecision(value as 'approved' | 'rejected')}>
              <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-accent">
                <RadioGroupItem value="approved" id="approved" />
                <Label htmlFor="approved" className="flex-1 cursor-pointer flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="font-medium">Aprobar Disputa</div>
                    <div className="text-xs text-muted-foreground">
                      El incidente será descartado y no se aplicarán sanciones
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-accent">
                <RadioGroupItem value="rejected" id="rejected" />
                <Label htmlFor="rejected" className="flex-1 cursor-pointer flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <div>
                    <div className="font-medium">Rechazar Disputa</div>
                    <div className="text-xs text-muted-foreground">
                      El incidente se mantendrá y se aplicarán las sanciones correspondientes
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Review Notes */}
          <div className="space-y-2">
            <Label htmlFor="review-notes">
              Notas de Revisión {decision === 'rejected' && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id="review-notes"
              placeholder="Proporciona notas sobre tu decisión..."
              value={reviewNotes}
              onChange={(e) => {
                setReviewNotes(e.target.value)
                setError(null)
              }}
              rows={4}
              className="resize-none"
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !decision || (decision === 'rejected' && !reviewNotes.trim())}
            variant={decision === 'approved' ? 'default' : 'destructive'}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {decision === 'approved' ? 'Aprobar' : 'Rechazar'} Disputa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
