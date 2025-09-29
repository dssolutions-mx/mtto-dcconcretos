"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { X, Plus } from "lucide-react"
import { Supplier, SupplierFormData, SupplierType, PaymentTerms, PaymentMethod, SUPPLIER_INDUSTRIES, SUPPLIER_SPECIALTIES, SupplierIndustry, SupplierSpecialty } from "@/types/suppliers"
import { createClient } from "@/lib/supabase"

interface SupplierFormProps {
  supplier?: Supplier
  onSuccess?: (supplier: Supplier) => void
  onCancel?: () => void
}

const SUPPLIER_TYPES: { value: SupplierType; label: string }[] = [
  { value: 'individual', label: 'Persona Física' },
  { value: 'company', label: 'Empresa' },
  { value: 'distributor', label: 'Distribuidor' },
  { value: 'manufacturer', label: 'Fabricante' },
  { value: 'service_provider', label: 'Proveedor de Servicios' }
]

const PAYMENT_TERMS: { value: PaymentTerms; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'immediate', label: 'Inmediato' },
  { value: '15_days', label: '15 días' },
  { value: '30_days', label: '30 días' },
  { value: '45_days', label: '45 días' },
  { value: '60_days', label: '60 días' }
]

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'check', label: 'Cheque' },
  { value: 'wire', label: 'Transferencia Electrónica' }
]

const COMMON_SPECIALTIES: string[] = []

export function SupplierForm({ supplier, onSuccess, onCancel }: SupplierFormProps) {
  const [formData, setFormData] = useState<SupplierFormData>({
    name: supplier?.name || '',
    business_name: supplier?.business_name || '',
    tax_id: supplier?.tax_id || '',
    supplier_type: supplier?.supplier_type || 'company',
    contact_person: supplier?.contact_person || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    mobile_phone: supplier?.mobile_phone || '',
    address: supplier?.address || '',
    city: supplier?.city || '',
    state: supplier?.state || '',
    postal_code: supplier?.postal_code || '',
    country: supplier?.country || 'México',
    industry: supplier?.industry || '',
    specialties: supplier?.specialties || [],
    certifications: supplier?.certifications || [],
    payment_terms: supplier?.payment_terms || '30_days',
    payment_methods: supplier?.payment_methods || ['transfer'],
    business_hours: supplier?.business_hours || {},
    notes: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newSpecialty, setNewSpecialty] = useState('')
  const [newCertification, setNewCertification] = useState('')
  const [businessUnits, setBusinessUnits] = useState<{ id: string; name: string }[]>([])

  const handleInputChange = (field: keyof SupplierFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Load business units for selector
  useEffect(() => {
    const loadBU = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('business_units')
          .select('id, name')
          .order('name', { ascending: true })
        if (!error && data) setBusinessUnits(data as any)
      } catch (e) {
        console.error('Error loading business units', e)
      }
    }
    loadBU()
  }, [])

  const addSpecialty = () => {
    if (newSpecialty.trim() && !formData.specialties?.includes(newSpecialty.trim())) {
      handleInputChange('specialties', [...(formData.specialties || []), newSpecialty.trim()])
      setNewSpecialty('')
    }
  }

  const removeSpecialty = (specialty: string) => {
    handleInputChange('specialties', formData.specialties?.filter(s => s !== specialty))
  }

  const addCertification = () => {
    if (newCertification.trim() && !formData.certifications?.includes(newCertification.trim())) {
      handleInputChange('certifications', [...(formData.certifications || []), newCertification.trim()])
      setNewCertification('')
    }
  }

  const removeCertification = (certification: string) => {
    handleInputChange('certifications', formData.certifications?.filter(c => c !== certification))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = supplier ? `/api/suppliers/${supplier.id}` : '/api/suppliers'
      const method = supplier ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (response.ok) {
        onSuccess?.(result.supplier)
      } else {
        console.error('Error saving supplier:', result.error)
        alert('Error al guardar el proveedor: ' + result.error)
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('Error al enviar el formulario')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
          <CardDescription>
            Datos generales del proveedor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                placeholder="Nombre del proveedor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_name">Razón Social</Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => handleInputChange('business_name', e.target.value)}
                placeholder="Nombre de la empresa"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tax_id">RFC/CUIT</Label>
              <Input
                id="tax_id"
                value={formData.tax_id}
                onChange={(e) => handleInputChange('tax_id', e.target.value)}
                placeholder="Registro fiscal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_type">Tipo de Proveedor *</Label>
              <Select
                value={formData.supplier_type}
                onValueChange={(value: SupplierType) => handleInputChange('supplier_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industria</Label>
            <Select
              value={(formData.industry as string) || ''}
              onValueChange={(value: SupplierIndustry | string) => handleInputChange('industry', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar industria" />
              </SelectTrigger>
              <SelectContent>
                {SUPPLIER_INDUSTRIES.map(ind => (
                  <SelectItem key={ind} value={ind}>{ind.replace(/_/g, ' ')}</SelectItem>
                ))}
                <SelectItem value="other">otra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_unit_id">Unidad de Negocio</Label>
            <Select
              value={(formData as any).business_unit_id || ''}
              onValueChange={(value: string) => handleInputChange('business_unit_id' as any, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar unidad de negocio" />
              </SelectTrigger>
              <SelectContent>
                {businessUnits.map(bu => (
                  <SelectItem key={bu.id} value={bu.id}>{bu.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Contacto</CardTitle>
          <CardDescription>
            Datos para comunicación con el proveedor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact_person">Persona de Contacto</Label>
            <Input
              id="contact_person"
              value={formData.contact_person}
              onChange={(e) => handleInputChange('contact_person', e.target.value)}
              placeholder="Nombre de la persona de contacto"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="(55) 1234-5678"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile_phone">Teléfono Móvil</Label>
            <Input
              id="mobile_phone"
              value={formData.mobile_phone}
              onChange={(e) => handleInputChange('mobile_phone', e.target.value)}
              placeholder="(55) 9876-5432"
            />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle>Dirección</CardTitle>
          <CardDescription>
            Ubicación del proveedor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Calle, número, colonia..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="Ciudad"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                placeholder="Estado"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_code">Código Postal</Label>
              <Input
                id="postal_code"
                value={formData.postal_code}
                onChange={(e) => handleInputChange('postal_code', e.target.value)}
                placeholder="12345"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Negocio</CardTitle>
          <CardDescription>
            Especialidades, certificaciones y términos comerciales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Specialties */}
          <div className="space-y-2">
            <Label>Especialidades</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Catálogo</Label>
                <div className="flex flex-wrap gap-2">
                  {SUPPLIER_SPECIALTIES.map(s => (
                    <Button
                      key={s}
                      type="button"
                      variant={(formData.specialties || []).includes(s) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const current = formData.specialties || []
                        const next = current.includes(s)
                          ? current.filter(v => v !== s)
                          : [...current, s]
                        handleInputChange('specialties', next)
                      }}
                    >
                      {s.replace(/_/g, ' ')}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Agregar libre</Label>
                <div className="flex gap-2">
                  <Input
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    placeholder="otra_especialidad (texto libre)"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
                  />
                  <Button type="button" onClick={addSpecialty} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            {formData.specialties && formData.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.specialties.map((specialty, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {String(specialty).replace(/_/g, ' ')}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => removeSpecialty(String(specialty))}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Certifications */}
          <div className="space-y-2">
            <Label>Certificaciones</Label>
            <div className="flex gap-2">
              <Input
                value={newCertification}
                onChange={(e) => setNewCertification(e.target.value)}
                placeholder="Agregar certificación"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
              />
              <Button type="button" onClick={addCertification} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.certifications && formData.certifications.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.certifications.map((certification, index) => (
                  <Badge key={index} variant="outline" className="flex items-center gap-1">
                    {certification}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => removeCertification(certification)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Payment Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Términos de Pago</Label>
              <Select
                value={formData.payment_terms}
                onValueChange={(value: PaymentTerms) => handleInputChange('payment_terms', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar términos" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map(term => (
                    <SelectItem key={term.value} value={term.value}>
                      {term.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Métodos de Pago Aceptados</Label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map(method => (
                  <Button
                    key={method.value}
                    type="button"
                    variant={formData.payment_methods?.includes(method.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const currentMethods = formData.payment_methods || []
                      const newMethods = currentMethods.includes(method.value)
                        ? currentMethods.filter(m => m !== method.value)
                        : [...currentMethods, method.value]
                      handleInputChange('payment_methods', newMethods)
                    }}
                  >
                    {method.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (supplier ? 'Actualizar' : 'Crear')} Proveedor
        </Button>
      </div>
    </form>
  )
}
