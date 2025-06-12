'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Eye, EyeOff } from 'lucide-react'

interface Plant {
  id: string
  name: string
  code: string
  business_unit_id: string
}

interface CreateOperatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOperatorCreated: (operator: any) => void
  plants: Plant[]
}

const operatorSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  nombre: z.string().min(1, 'El nombre es requerido'),
  apellido: z.string().min(1, 'El apellido es requerido'),
  telefono: z.string().optional(),
  phone_secondary: z.string().optional(),
  role: z.enum(['OPERADOR', 'DOSIFICADOR', 'JEFE_PLANTA', 'ENCARGADO_MANTENIMIENTO', 'JEFE_UNIDAD_NEGOCIO', 'AUXILIAR_COMPRAS', 'AREA_ADMINISTRATIVA', 'VISUALIZADOR']),
  plant_id: z.string().min(1, 'La planta es requerida'),
  employee_code: z.string().optional(),
  position: z.string().optional(),
  shift: z.enum(['morning', 'afternoon', 'night']).optional(),
  emergency_contact: z.string().optional(),
  hire_date: z.string().optional(),
  can_authorize_up_to: z.number().min(0).optional()
})

type OperatorFormData = z.infer<typeof operatorSchema>

const roleOptions = [
  { value: 'OPERADOR', label: 'Operador', defaultAuth: 0 },
  { value: 'DOSIFICADOR', label: 'Dosificador', defaultAuth: 1000 },
  { value: 'JEFE_PLANTA', label: 'Jefe de Planta', defaultAuth: 1000 },
  { value: 'ENCARGADO_MANTENIMIENTO', label: 'Encargado Mantenimiento', defaultAuth: 1000 },
  { value: 'AUXILIAR_COMPRAS', label: 'Auxiliar de Compras', defaultAuth: 2000 },
  { value: 'AREA_ADMINISTRATIVA', label: 'Área Administrativa', defaultAuth: 2000 },
  { value: 'JEFE_UNIDAD_NEGOCIO', label: 'Jefe Unidad de Negocio', defaultAuth: 5000 },
  { value: 'VISUALIZADOR', label: 'Visualizador', defaultAuth: 0 }
]

const shiftOptions = [
  { value: 'morning', label: 'Matutino' },
  { value: 'afternoon', label: 'Vespertino' },
  { value: 'night', label: 'Nocturno' }
]

export function CreateOperatorDialog({ open, onOpenChange, onOperatorCreated, plants }: CreateOperatorDialogProps) {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { toast } = useToast()

  const form = useForm<OperatorFormData>({
    resolver: zodResolver(operatorSchema),
    defaultValues: {
      email: '',
      password: '',
      nombre: '',
      apellido: '',
      telefono: '',
      phone_secondary: '',
      role: 'OPERADOR',
      plant_id: '',
      employee_code: '',
      position: '',
      emergency_contact: '',
      hire_date: '',
      can_authorize_up_to: 0
    }
  })

  const selectedRole = form.watch('role')
  const selectedPlant = form.watch('plant_id')

  // Update authorization limit when role changes
  const handleRoleChange = (role: string) => {
    const roleOption = roleOptions.find(r => r.value === role)
    if (roleOption) {
      form.setValue('can_authorize_up_to', roleOption.defaultAuth)
    }
  }

  // Set business unit based on selected plant
  const getBusinessUnitForPlant = (plantId: string) => {
    const plant = plants.find(p => p.id === plantId)
    return plant?.business_unit_id || ''
  }

  const onSubmit = async (data: OperatorFormData) => {
    try {
      setLoading(true)

      const payload = {
        ...data,
        business_unit_id: getBusinessUnitForPlant(data.plant_id),
        emergency_contact: data.emergency_contact ? {
          name: data.emergency_contact,
          phone: ''
        } : null
      }

      const response = await fetch('/api/operators/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear operador')
      }

      toast({
        title: "Éxito",
        description: "Operador creado exitosamente"
      })

      onOperatorCreated(result.user.profile)
      form.reset()

    } catch (error) {
      console.error('Error creating operator:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al crear operador",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Empleado</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Información Básica</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apellido"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido *</FormLabel>
                      <FormControl>
                        <Input placeholder="Apellido" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Contraseña" 
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono Principal</FormLabel>
                      <FormControl>
                        <Input placeholder="Teléfono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone_secondary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono Secundario</FormLabel>
                      <FormControl>
                        <Input placeholder="Teléfono secundario" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Work Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Información Laboral</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol *</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value)
                          handleRoleChange(value)
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar rol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plant_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planta *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar planta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {plants.map((plant) => (
                            <SelectItem key={plant.id} value={plant.id}>
                              {plant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="employee_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de Empleado</FormLabel>
                      <FormControl>
                        <Input placeholder="EMP001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Puesto</FormLabel>
                      <FormControl>
                        <Input placeholder="Puesto de trabajo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shift"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Turno</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar turno" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {shiftOptions.map((shift) => (
                            <SelectItem key={shift.value} value={shift.value}>
                              {shift.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hire_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Contratación</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="can_authorize_up_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Límite de Autorización (MXN)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="emergency_contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contacto de Emergencia</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del contacto de emergencia" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Empleado
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
} 