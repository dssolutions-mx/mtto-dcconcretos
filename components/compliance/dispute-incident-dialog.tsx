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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface DisputeIncidentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  incidentId: string
  onDisputeSubmitted?: () => void
}

export function DisputeIncidentDialog({
  open,
  onOpenChange,
  incidentId,
  onDisputeSubmitted
}: DisputeIncidentDialogProps) {
  const [disputeReason, setDisputeReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!disputeReason.trim()) {
      setError('Por favor proporciona una razón para la disputa')
      return
    }

    if (disputeReason.trim().length < 20) {
      setError('La razón debe tener al menos 20 caracteres')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/compliance/incidents/${incidentId}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dispute_reason: disputeReason.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar la disputa')
      }

      toast({
        title: 'Disputa enviada',
        description: 'Tu disputa ha sido enviada y será revisada por un gerente.',
      })

      setDisputeReason('')
      onOpenChange(false)
      onDisputeSubmitted?.()
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
    setDisputeReason('')
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Disputar Incidente
          </DialogTitle>
          <DialogDescription>
            Si crees que este incidente fue reportado incorrectamente, puedes disputarlo.
            Un gerente revisará tu disputa y tomará una decisión.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Las disputas deben ser justificadas. 
              Proporciona evidencia o explicación detallada de por qué crees que el incidente es incorrecto.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="dispute-reason">
              Razón de la Disputa <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="dispute-reason"
              placeholder="Explica por qué crees que este incidente es incorrecto. Incluye cualquier evidencia o contexto relevante..."
              value={disputeReason}
              onChange={(e) => {
                setDisputeReason(e.target.value)
                setError(null)
              }}
              rows={6}
              className="resize-none"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 20 caracteres. {disputeReason.length}/20
            </p>
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
            disabled={loading || !disputeReason.trim() || disputeReason.trim().length < 20}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar Disputa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
