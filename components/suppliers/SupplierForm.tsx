"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { X, Plus, UserPlus, Trash2, CreditCard, Users, Building2, CircleAlert } from "lucide-react"
import {
  Supplier,
  SupplierFormData,
  SupplierType,
  PaymentTerms,
  PaymentMethod,
  SUPPLIER_INDUSTRIES,
  SUPPLIER_SPECIALTIES,
  SupplierIndustry,
  SupplierContact,
  ContactType,
  BankAccountInfo,
} from "@/types/suppliers"
import { createClient } from "@/lib/supabase"

interface SupplierFormProps {
  supplier?: Supplier
  onSuccess?: (supplier: Supplier) => void
  onCancel?: () => void
  /** When create is blocked (e.g. duplicate name + BU), parent can show banner + focus search */
  onDuplicateBlocked?: (payload: { message: string; searchedName: string }) => void
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
  { value: 'wire', label: 'Wire Transfer' }
]

const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'technical', label: 'Técnico' },
  { value: 'billing', label: 'Cobranza' },
  { value: 'emergency', label: 'Emergencias' }
]

interface ContactRow {
  id?: string
  contact_type: ContactType
  name: string
  position: string
  email: string
  phone: string
  mobile_phone: string
  is_primary: boolean
}

const emptyContact = (): ContactRow => ({
  contact_type: 'general',
  name: '',
  position: '',
  email: '',
  phone: '',
  mobile_phone: '',
  is_primary: false,
})

export function SupplierForm({ supplier, onSuccess, onCancel, onDuplicateBlocked }: SupplierFormProps) {
  const [createDuplicateMessage, setCreateDuplicateMessage] = useState<string | null>(null)
  const [formData, setFormData] = useState<SupplierFormData & { bank_account_info: BankAccountInfo }>({
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
    bank_account_info: (supplier?.bank_account_info as BankAccountInfo) || {
      bank_name: '',
      account_number: '',
      routing_number: '',
      account_holder: '',
      account_type: 'checking',
    },
  })

  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [selectedBUs, setSelectedBUs] = useState<string[]>([])
  const [businessUnits, setBusinessUnits] = useState<{ id: string; name: string }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newSpecialty, setNewSpecialty] = useState('')
  const [newCertification, setNewCertification] = useState('')

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleBankChange = (field: keyof BankAccountInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      bank_account_info: { ...prev.bank_account_info, [field]: value }
    }))
  }

  // Load business units and existing contacts
  useEffect(() => {
    const load = async () => {
      const supabase = createClient()

      const { data: buData } = await supabase
        .from('business_units')
        .select('id, name')
        .order('name', { ascending: true })
      if (buData) setBusinessUnits(buData as any)

      if (supplier?.id) {
        // Load existing contacts
        const { data: contactData } = await supabase
          .from('supplier_contacts')
          .select('*')
          .eq('supplier_id', supplier.id)
          .eq('is_active', true)
          .order('is_primary', { ascending: false })

        if (contactData && contactData.length > 0) {
          setContacts(contactData.map(c => ({
            id: c.id,
            contact_type: c.contact_type as ContactType,
            name: c.name || '',
            position: c.position || '',
            email: c.email || '',
            phone: c.phone || '',
            mobile_phone: c.mobile_phone || '',
            is_primary: c.is_primary || false,
          })))
        }

        // Load existing business unit associations
        const { data: buAssoc } = await supabase
          .from('supplier_business_units')
          .select('business_unit_id')
          .eq('supplier_id', supplier.id)

        if (buAssoc && buAssoc.length > 0) {
          setSelectedBUs(buAssoc.map(r => r.business_unit_id))
        } else if (supplier.business_unit_id) {
          setSelectedBUs([supplier.business_unit_id])
        }
      }
    }
    load()
  }, [supplier?.id])

  useEffect(() => {
    if (!supplier) setCreateDuplicateMessage(null)
  }, [formData.name, selectedBUs, supplier])

  // Contact management
  const addContact = () => setContacts(prev => [...prev, emptyContact()])

  const removeContact = (index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index))
  }

  const updateContact = (index: number, field: keyof ContactRow, value: any) => {
    setContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const setPrimaryContact = (index: number) => {
    setContacts(prev => prev.map((c, i) => ({ ...c, is_primary: i === index })))
  }

  // Specialty management
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

  const toggleBU = (buId: string) => {
    setSelectedBUs(prev =>
      prev.includes(buId) ? prev.filter(id => id !== buId) : [...prev, buId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setCreateDuplicateMessage(null)

    try {
      const supabase = createClient()

      // Save supplier via API
      const url = supplier ? `/api/suppliers/${supplier.id}` : '/api/suppliers'
      const method = supplier ? 'PUT' : 'POST'

      // Clean bank_account_info — only include if at least bank_name is filled
      const bankInfo = formData.bank_account_info.bank_name
        ? formData.bank_account_info
        : undefined

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          bank_account_info: bankInfo,
          // Keep legacy single BU field as the first selected BU
          business_unit_id: selectedBUs[0] || null,
        })
      })

      const result = await response.json()
      if (!response.ok) {
        if (
          response.status === 409 &&
          result?.code === 'DUPLICATE_SUPPLIER_NAME_BU' &&
          typeof result?.error === 'string'
        ) {
          const searchedName = formData.name.trim()
          if (onDuplicateBlocked) {
            onDuplicateBlocked({ message: result.error, searchedName })
          } else {
            setCreateDuplicateMessage(result.error)
          }
          return
        }
        alert('Error al guardar el proveedor: ' + (result.error || response.statusText))
        return
      }

      const savedSupplier: Supplier = result.supplier
      const supplierId = savedSupplier.id

      // Save contacts to supplier_contacts
      if (contacts.length > 0) {
        // Delete existing contacts for this supplier
        await supabase
          .from('supplier_contacts')
          .delete()
          .eq('supplier_id', supplierId)

        // Insert new contacts
        const contactsToInsert = contacts
          .filter(c => c.name.trim())
          .map(c => ({
            supplier_id: supplierId,
            contact_type: c.contact_type,
            name: c.name,
            position: c.position || null,
            email: c.email || null,
            phone: c.phone || null,
            mobile_phone: c.mobile_phone || null,
            is_primary: c.is_primary,
            is_active: true,
          }))

        if (contactsToInsert.length > 0) {
          await supabase.from('supplier_contacts').insert(contactsToInsert)
        }
      }

      // Save business unit associations
      await supabase
        .from('supplier_business_units')
        .delete()
        .eq('supplier_id', supplierId)

      if (selectedBUs.length > 0) {
        await supabase.from('supplier_business_units').insert(
          selectedBUs.map(buId => ({
            supplier_id: supplierId,
            business_unit_id: buId,
          }))
        )
      }

      onSuccess?.(savedSupplier)
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('Error al enviar el formulario')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!supplier && createDuplicateMessage && (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <CircleAlert className="h-4 w-4" aria-hidden />
          <AlertTitle>Ya existe este proveedor</AlertTitle>
          <AlertDescription>{createDuplicateMessage}</AlertDescription>
        </Alert>
      )}
      {/* 1. Datos Fiscales y Generales */}
      <Card>
        <CardHeader>
          <CardTitle>Datos Fiscales y Generales</CardTitle>
          <CardDescription>Información fiscal y tipo de proveedor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Comercial *</Label>
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
                placeholder="Nombre oficial de la empresa"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tax_id">RFC *</Label>
              <Input
                id="tax_id"
                value={formData.tax_id}
                onChange={(e) => handleInputChange('tax_id', e.target.value)}
                placeholder="RFC del proveedor"
                className={!formData.tax_id ? 'border-amber-400 focus-visible:ring-amber-400' : ''}
              />
              {!formData.tax_id && (
                <p className="text-xs text-amber-600">Requerido para certificar al proveedor</p>
              )}
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
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <SelectItem value="other">Otra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Calle, número, colonia..."
              />
            </div>
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
              <Label htmlFor="postal_code">C.P.</Label>
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

      {/* 2. Datos Bancarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Datos Bancarios
          </CardTitle>
          <CardDescription>Información para pagos y transferencias</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Banco</Label>
              <Input
                id="bank_name"
                value={formData.bank_account_info.bank_name || ''}
                onChange={(e) => handleBankChange('bank_name', e.target.value)}
                placeholder="BBVA, Banamex, Santander..."
                className={!formData.bank_account_info.bank_name ? 'border-amber-400 focus-visible:ring-amber-400' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_holder">Titular de la Cuenta</Label>
              <Input
                id="account_holder"
                value={formData.bank_account_info.account_holder || ''}
                onChange={(e) => handleBankChange('account_holder', e.target.value)}
                placeholder="Nombre del titular"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account_number">CLABE / Número de Cuenta</Label>
              <Input
                id="account_number"
                value={formData.bank_account_info.account_number || ''}
                onChange={(e) => handleBankChange('account_number', e.target.value)}
                placeholder="18 dígitos CLABE"
                className={!formData.bank_account_info.account_number ? 'border-amber-400 focus-visible:ring-amber-400' : ''}
              />
              {!formData.bank_account_info.account_number && (
                <p className="text-xs text-amber-600">Requerido para certificar al proveedor</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_type">Tipo de Cuenta</Label>
              <Select
                value={formData.bank_account_info.account_type || 'checking'}
                onValueChange={(val) => handleBankChange('account_type', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Cheques</SelectItem>
                  <SelectItem value="savings">Ahorros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
                    <SelectItem key={term.value} value={term.value}>{term.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Métodos de Pago Aceptados</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {PAYMENT_METHODS.map(method => (
                  <Button
                    key={method.value}
                    type="button"
                    variant={formData.payment_methods?.includes(method.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const current = formData.payment_methods || []
                      const next = current.includes(method.value)
                        ? current.filter(m => m !== method.value)
                        : [...current, method.value]
                      handleInputChange('payment_methods', next)
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

      {/* 3. Contactos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Contactos
              </CardTitle>
              <CardDescription>Personas de contacto del proveedor</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addContact}>
              <UserPlus className="w-4 h-4 mr-2" />
              Agregar Contacto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay contactos registrados. Haz clic en "Agregar Contacto" para añadir uno.
            </p>
          ) : (
            contacts.map((contact, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Select
                      value={contact.contact_type}
                      onValueChange={(val: ContactType) => updateContact(index, 'contact_type', val)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_TYPES.map(ct => (
                          <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant={contact.is_primary ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPrimaryContact(index)}
                      title="Marcar como contacto principal"
                    >
                      {contact.is_primary ? '★ Principal' : '☆ Principal'}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeContact(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre *</Label>
                    <Input
                      value={contact.name}
                      onChange={(e) => updateContact(index, 'name', e.target.value)}
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cargo</Label>
                    <Input
                      value={contact.position}
                      onChange={(e) => updateContact(index, 'position', e.target.value)}
                      placeholder="Gerente, Vendedor..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      value={contact.email}
                      onChange={(e) => updateContact(index, 'email', e.target.value)}
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Teléfono</Label>
                    <Input
                      value={contact.phone}
                      onChange={(e) => updateContact(index, 'phone', e.target.value)}
                      placeholder="(55) 1234-5678"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 4. Unidades de Negocio */}
      {businessUnits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Unidades de Negocio
            </CardTitle>
            <CardDescription>Selecciona las unidades de negocio que atiende este proveedor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {businessUnits.map(bu => (
                <div key={bu.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`bu-${bu.id}`}
                    checked={selectedBUs.includes(bu.id)}
                    onCheckedChange={() => toggleBU(bu.id)}
                  />
                  <Label htmlFor={`bu-${bu.id}`} className="cursor-pointer font-normal">
                    {bu.name}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Especialidades y Certificaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Especialidades y Certificaciones</CardTitle>
          <CardDescription>Servicios y acreditaciones del proveedor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Specialties */}
          <div className="space-y-2">
            <Label>Especialidades</Label>
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
            <div className="flex gap-2 mt-2">
              <Input
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                placeholder="Otra especialidad..."
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
              />
              <Button type="button" onClick={addSpecialty} size="sm" variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.specialties && formData.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.specialties.map((specialty, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {String(specialty).replace(/_/g, ' ')}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => removeSpecialty(String(specialty))} />
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
                placeholder="ISO 9001, OHSAS 18001..."
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
              />
              <Button type="button" onClick={addCertification} size="sm" variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.certifications && formData.certifications.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.certifications.map((cert, index) => (
                  <Badge key={index} variant="outline" className="flex items-center gap-1">
                    {cert}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => removeCertification(cert)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (supplier ? 'Actualizar Proveedor' : 'Crear Proveedor')}
        </Button>
      </div>
    </form>
  )
}
