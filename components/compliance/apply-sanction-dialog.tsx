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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, AlertTriangle, Loader2, User } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import type { ApplySanctionRequest, Sanction } from '@/types/compliance'

interface ApplySanctionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  incidentId?: string
  userId?: string
  userName?: string
  onSanctionApplied?: (sanction: Sanction) => void
}

export function ApplySanctionDialog({
  open,
  onOpenChange,
  incidentId,
  userId: initialUserId,
  userName: initialUserName,
  onSanctionApplied
}: ApplySanctionDialogProps) {
  const [loading, setLoading] = useState(false)
  const [sanctionType, setSanctionType] = useState<'verbal_warning' | 'written_warning' | 'suspension' | 'fine' | 'termination' | 'other'>('verbal_warning')
  const [description, setDescription] = useState('')
  const [sanctionAmount, setSanctionAmount] = useState<string>('')
  const [percentage, setPercentage] = useState<string>('')
  const [selectedUserId, setSelectedUserId] = useState<string>(initialUserId || '')
  const [selectedUserName, setSelectedUserName] = useState<string>(initialUserName || '')
  const [users, setUsers] = useState<Array<{ id: string; nombre: string; apellido: string }>>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Load users when dialog opens and userId is not provided
  useEffect(() => {
    if (open && !initialUserId) {
      fetchUsers()
    } else if (open && initialUserId) {
      setSelectedUserId(initialUserId)
      setSelectedUserName(initialUserName || '')
    }
  }, [open, initialUserId, initialUserName])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nombre, apellido')
        .eq('status', 'active')
        .order('nombre')

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Error al cargar usuarios')
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUserId) {
      toast.error('Debes seleccionar un usuario')
      return
    }

    if (!description.trim()) {
      toast.error('La descripción es requerida')
      return
    }

    if (sanctionType === 'fine' && !sanctionAmount && !percentage) {
      toast.error('Las multas requieren un monto o porcentaje')
      return
    }

    setLoading(true)

    try {
      const requestBody: ApplySanctionRequest = {
        incident_id: incidentId,
        user_id: selectedUserId,
        sanction_type: sanctionType,
        description: description.trim(),
        sanction_amount: sanctionAmount ? parseFloat(sanctionAmount) : undefined,
        percentage: percentage ? parseFloat(percentage) : undefined,
      }

      const response = await fetch('/api/compliance/sanctions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al aplicar sanción')
      }

      toast.success('Sanción aplicada correctamente')
      
      // Reset form
      setDescription('')
      setSanctionAmount('')
      setPercentage('')
      setSanctionType('verbal_warning')
      if (!initialUserId) {
        setSelectedUserId('')
        setSelectedUserName('')
      }

      // Callback
      if (onSanctionApplied && data.sanction) {
        onSanctionApplied(data.sanction)
      }

      onOpenChange(false)
    } catch (error: any) {
      console.error('Error applying sanction:', error)
      toast.error(error.message || 'Error al aplicar sanción')
    } finally {
      setLoading(false)
    }
  }

  const getSanctionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      verbal_warning: 'Llamada Verbal',
      written_warning: 'Amonestación Escrita',
      suspension: 'Suspensión',
      fine: 'Multa',
      termination: 'Terminación',
      other: 'Otra'
    }
    return labels[type] || type
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Aplicar Sanción
          </DialogTitle>
          <DialogDescription>
            {selectedUserName || initialUserName ? (
              <>Aplicar sanción a <strong>{selectedUserName || initialUserName}</strong></>
            ) : incidentId ? (
              <>Aplicar sanción relacionada con el incidente de cumplimiento.</>
            ) : (
              <>Crear una nueva sanción disciplinaria.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!initialUserId && (
            <div className="space-y-2">
              <Label htmlFor="user_select">Usuario *</Label>
              <Select
                value={selectedUserId}
                onValueChange={(value) => {
                  setSelectedUserId(value)
                  const user = users.find(u => u.id === value)
                  setSelectedUserName(user ? `${user.nombre} ${user.apellido}` : '')
                }}
                disabled={loadingUsers}
              >
                <SelectTrigger id="user_select">
                  <SelectValue placeholder={loadingUsers ? "Cargando usuarios..." : "Seleccionar usuario"} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{user.nombre} {user.apellido}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sanction_type">Tipo de Sanción *</Label>
            <Select
              value={sanctionType}
              onValueChange={(value: any) => {
                setSanctionType(value)
                // Clear amount/percentage when changing type
                if (value !== 'fine') {
                  setSanctionAmount('')
                  setPercentage('')
                }
              }}
            >
              <SelectTrigger id="sanction_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="verbal_warning">Llamada Verbal</SelectItem>
                <SelectItem value="written_warning">Amonestación Escrita</SelectItem>
                <SelectItem value="suspension">Suspensión</SelectItem>
                <SelectItem value="fine">Multa</SelectItem>
                <SelectItem value="termination">Terminación</SelectItem>
                <SelectItem value="other">Otra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción *</Label>
            <Textarea
              id="description"
              placeholder="Describe la razón de la sanción y los detalles relevantes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
            />
          </div>

          {sanctionType === 'fine' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sanction_amount">Monto (MXN)</Label>
                <Input
                  id="sanction_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={sanctionAmount}
                  onChange={(e) => {
                    setSanctionAmount(e.target.value)
                    if (e.target.value) setPercentage('')
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentage">Porcentaje del Día</Label>
                <Input
                  id="percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0.00"
                  value={percentage}
                  onChange={(e) => {
                    setPercentage(e.target.value)
                    if (e.target.value) setSanctionAmount('')
                  }}
                />
              </div>
            </div>
          )}

          {(sanctionType === 'termination' || sanctionType === 'suspension') && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta es una sanción grave. Asegúrate de tener toda la documentación necesaria.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aplicando...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Aplicar Sanción
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


