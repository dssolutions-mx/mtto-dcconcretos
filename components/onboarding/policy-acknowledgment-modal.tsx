'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileText, AlertTriangle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import type { Policy } from '@/types/compliance'

interface PolicyAcknowledgmentModalProps {
  open: boolean
  onAcknowledged: () => void
  policyId?: string
}

export function PolicyAcknowledgmentModal({
  open,
  onAcknowledged,
  policyId
}: PolicyAcknowledgmentModalProps) {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchPolicy()
    }
  }, [open, policyId])

  const fetchPolicy = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      // Get active policies that user hasn't acknowledged
      let query = supabase
        .from('policies')
        .select('*')
        .eq('is_active', true)
        .order('effective_date', { ascending: false })
        .limit(1)

      if (policyId) {
        query = query.eq('id', policyId)
      }

      const { data: policies, error: policiesError } = await query

      if (policiesError) throw policiesError

      if (!policies || policies.length === 0) {
        setPolicy(null)
        setLoading(false)
        return
      }

      const activePolicy = policies[0]

      // Check if user has already acknowledged this policy
      const { data: acknowledgment } = await supabase
        .from('policy_acknowledgments')
        .select('id')
        .eq('user_id', user.id)
        .eq('policy_id', activePolicy.id)
        .single()

      if (acknowledgment) {
        // User already acknowledged, close modal
        setPolicy(null)
        setLoading(false)
        onAcknowledged()
        return
      }

      setPolicy(activePolicy)
    } catch (error) {
      console.error('Error fetching policy:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cargar la política',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAcknowledge = async () => {
    if (!policy || !acknowledged) return

    setSaving(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('No autenticado')

      // Get user IP and user agent
      const ipAddress = null // Can be obtained from headers if needed
      const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : null

      // Use API route for acknowledgment
      const response = await fetch(`/api/compliance/policies/${policy.id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature_data: null,
          comprehension_score: null
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al aceptar la política')
      }

      toast({
        title: 'Política Aceptada',
        description: 'Has aceptado la política exitosamente.',
      })

      onAcknowledged()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={() => {}} modal={true}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Política de la Empresa - Aceptación Requerida
          </DialogTitle>
          <DialogDescription>
            Debes leer y aceptar la política para continuar usando el sistema
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !policy ? (
          <div className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-muted-foreground">
              No hay políticas pendientes de aceptar.
            </p>
            <Button onClick={onAcknowledged} className="mt-4">
              Continuar
            </Button>
          </div>
        ) : (
          <>
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> Esta política es obligatoria. 
                Debes leerla completamente y aceptarla para continuar.
              </AlertDescription>
            </Alert>

            <ScrollArea className="flex-1 min-h-[300px] max-h-[500px] border rounded-md p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">{policy.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Código: {policy.code} | Versión: {policy.version} | 
                    Fecha de vigencia: {new Date(policy.effective_date).toLocaleDateString('es-ES')}
                  </p>
                </div>
                {policy.description && (
                  <div>
                    <h4 className="font-medium mb-2">Descripción</h4>
                    <p className="text-sm whitespace-pre-wrap">{policy.description}</p>
                  </div>
                )}
                {policy.document_url && (
                  <div>
                    <Button variant="outline" asChild>
                      <a href={policy.document_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4 mr-2" />
                        Ver Documento Completo (PDF)
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex items-start space-x-2 pt-4 border-t">
              <Checkbox
                id="acknowledge"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
              />
              <Label
                htmlFor="acknowledge"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                He leído y acepto la política {policy.code} - {policy.title}
              </Label>
            </div>

            <DialogFooter>
              <Button
                onClick={handleAcknowledge}
                disabled={!acknowledged || saving}
                className="w-full sm:w-auto"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aceptar y Continuar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
