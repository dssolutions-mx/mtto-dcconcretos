'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  Settings, 
  Save, 
  RefreshCw,
  History,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import type { SystemSetting } from '@/types/compliance'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface SettingsAuditLog {
  id: string
  setting_key: string
  old_value: unknown
  new_value: unknown
  changed_by: string
  change_reason: string | null
  created_at: string
  changed_by_profile?: {
    nombre: string
    apellido: string
  }
}

export function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [auditLog, setAuditLog] = useState<SettingsAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingSetting, setEditingSetting] = useState<SystemSetting | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [changeReason, setChangeReason] = useState('')
  const { profile } = useAuthZustand()
  const { toast } = useToast()

  useEffect(() => {
    fetchSettings()
    fetchAuditLog()
  }, [])

  const fetchSettings = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('key')

      if (error) throw error
      setSettings(data || [])
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las configuraciones',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchAuditLog = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('system_settings_audit_log')
        .select(`
          *,
          changed_by_profile:profiles!changed_by (
            nombre,
            apellido
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setAuditLog(data || [])
    } catch (error) {
      console.error('Error fetching audit log:', error)
    }
  }

  const handleEdit = (setting: SystemSetting) => {
    setEditingSetting(setting)
    // Convert JSONB value to string for editing
    if (typeof setting.value === 'boolean') {
      setEditValue(setting.value.toString())
    } else if (typeof setting.value === 'number') {
      setEditValue(setting.value.toString())
    } else if (typeof setting.value === 'string') {
      setEditValue(setting.value)
    } else {
      setEditValue(JSON.stringify(setting.value))
    }
    setChangeReason('')
    setEditDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editingSetting) return

    setSaving(editingSetting.id)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('No autenticado')

      // Parse value based on type
      let parsedValue: boolean | number | string | Record<string, unknown>
      const currentValue = editingSetting.value

      if (typeof currentValue === 'boolean') {
        parsedValue = editValue === 'true'
      } else if (typeof currentValue === 'number') {
        parsedValue = parseFloat(editValue)
        if (isNaN(parsedValue)) {
          throw new Error('El valor debe ser un número válido')
        }
      } else if (typeof currentValue === 'string') {
        parsedValue = editValue
      } else {
        try {
          parsedValue = JSON.parse(editValue)
        } catch {
          parsedValue = editValue
        }
      }

      // Get old value before update
      const oldValue = editingSetting.value

      // Update setting - convert to JSONB properly
      const { error: updateError } = await supabase
        .from('system_settings')
        .update({
          value: parsedValue as any, // Supabase handles JSONB conversion automatically
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSetting.id)

      if (updateError) throw updateError

      // Manually insert audit log entry with change reason
      // (Trigger will also create one, but we want to include the reason)
      const { error: auditError } = await supabase
        .from('system_settings_audit_log')
        .insert({
          setting_key: editingSetting.key,
          old_value: oldValue as any,
          new_value: parsedValue as any,
          changed_by: user.id,
          change_reason: changeReason.trim() || null
        })

      if (auditError) {
        console.error('Error creating audit log:', auditError)
        // Don't fail the request, just log
      }

      toast({
        title: 'Configuración actualizada',
        description: `La configuración "${editingSetting.key}" ha sido actualizada exitosamente.`,
      })

      setEditDialogOpen(false)
      setEditingSetting(null)
      fetchSettings()
      fetchAuditLog()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setSaving(null)
    }
  }

  const getValueDisplay = (value: unknown): string => {
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false'
    }
    if (typeof value === 'number') {
      return value.toString()
    }
    if (typeof value === 'string') {
      return value
    }
    return JSON.stringify(value)
  }

  const getValueType = (value: unknown): string => {
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'string') return 'string'
    return 'object'
  }

  // Check if user is admin
  const isAdmin = profile?.role && ['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'].includes(profile.role)

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
            <p className="text-muted-foreground">
              Solo los administradores pueden acceder a esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Configuración del Sistema
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión de configuraciones y características del sistema
          </p>
        </div>
        <Button onClick={() => { fetchSettings(); fetchAuditLog(); }} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Configuraciones</TabsTrigger>
          <TabsTrigger value="audit">Historial de Cambios</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuraciones del Sistema</CardTitle>
              <CardDescription>
                Modifica las configuraciones que controlan el comportamiento del sistema de cumplimiento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settings.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Label className="font-semibold">{setting.key}</Label>
                        <Badge variant="outline" className="text-xs">
                          {getValueType(setting.value)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {setting.description || 'Sin descripción'}
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {getValueDisplay(setting.value)}
                        </code>
                        {setting.updated_at && (
                          <span className="text-xs text-muted-foreground">
                            Actualizado: {format(new Date(setting.updated_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(setting)}
                      disabled={saving === setting.id}
                    >
                      {saving === setting.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Editar'
                      )}
                    </Button>
                  </div>
                ))}
                {settings.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Settings className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay configuraciones disponibles</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de Cambios
              </CardTitle>
              <CardDescription>
                Registro completo de todos los cambios realizados en las configuraciones del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLog.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay cambios registrados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Configuración</TableHead>
                        <TableHead>Valor Anterior</TableHead>
                        <TableHead>Valor Nuevo</TableHead>
                        <TableHead>Cambiado Por</TableHead>
                        <TableHead>Razón</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLog.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </TableCell>
                          <TableCell>
                            <code className="text-sm">{log.setting_key}</code>
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {getValueDisplay(log.old_value)}
                            </code>
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {getValueDisplay(log.new_value)}
                            </code>
                          </TableCell>
                          <TableCell>
                            {log.changed_by_profile
                              ? `${log.changed_by_profile.nombre} ${log.changed_by_profile.apellido}`
                              : 'Sistema'}
                          </TableCell>
                          <TableCell>
                            {log.change_reason || (
                              <span className="text-muted-foreground text-xs">Sin razón especificada</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Configuración</DialogTitle>
            <DialogDescription>
              {editingSetting?.description || 'Modifica el valor de esta configuración'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-value">
                Valor <span className="text-red-500">*</span>
              </Label>
              {editingSetting && typeof editingSetting.value === 'boolean' ? (
                <div className="flex items-center gap-2">
                  <Switch
                    id="edit-value"
                    checked={editValue === 'true'}
                    onCheckedChange={(checked) => setEditValue(checked.toString())}
                  />
                  <Label htmlFor="edit-value" className="cursor-pointer">
                    {editValue === 'true' ? 'Habilitado' : 'Deshabilitado'}
                  </Label>
                </div>
              ) : (
                <Input
                  id="edit-value"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Ingresa el nuevo valor"
                />
              )}
              <p className="text-xs text-muted-foreground">
                Tipo: {editingSetting && getValueType(editingSetting.value)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-reason">Razón del Cambio (Opcional)</Label>
              <Textarea
                id="change-reason"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Explica por qué estás haciendo este cambio..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving !== null}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
