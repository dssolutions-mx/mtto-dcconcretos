"use client"

import { useState, useEffect } from 'react'
import { X, Building2, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import type { Office } from '@/types'

interface OfficeManagementModalProps {
  isOpen: boolean
  onClose: () => void
  onOfficeUpdate: () => void
}

export function OfficeManagementModal({ isOpen, onClose, onOfficeUpdate }: OfficeManagementModalProps) {
  const [offices, setOffices] = useState<Office[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editingOffice, setEditingOffice] = useState<Office | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    email: '',
    phone: '',
    hr_phone: ''
  })

  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      fetchOffices()
    }
  }, [isOpen])

  const fetchOffices = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('offices')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching offices:', error)
        toast.error('Error al cargar oficinas')
        return
      }

      setOffices(data || [])
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Error inesperado al cargar oficinas')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name || !formData.address || !formData.email || !formData.phone || !formData.hr_phone) {
      toast.error('Todos los campos son requeridos')
      return
    }

    try {
      setIsLoading(true)

      if (editingOffice) {
        // Update existing office
        const { error } = await supabase
          .from('offices')
          .update({
            name: formData.name,
            address: formData.address,
            email: formData.email,
            phone: formData.phone,
            hr_phone: formData.hr_phone,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingOffice.id)

        if (error) {
          console.error('Error updating office:', error)
          toast.error('Error al actualizar oficina')
          return
        }

        toast.success('Oficina actualizada exitosamente')
      } else {
        // Create new office
        const { error } = await supabase
          .from('offices')
          .insert({
            name: formData.name,
            address: formData.address,
            email: formData.email,
            phone: formData.phone,
            hr_phone: formData.hr_phone
          })

        if (error) {
          console.error('Error creating office:', error)
          toast.error('Error al crear oficina')
          return
        }

        toast.success('Oficina creada exitosamente')
      }

      // Reset form
      setFormData({ name: '', address: '', email: '', phone: '', hr_phone: '' })
      setEditingOffice(null)
      setIsCreating(false)
      await fetchOffices()
      onOfficeUpdate()
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Error inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (office: Office) => {
    setEditingOffice(office)
    setFormData({
      name: office.name,
      address: office.address,
      email: office.email,
      phone: office.phone,
      hr_phone: office.hr_phone
    })
    setIsCreating(true)
  }

  const handleDelete = async (officeId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar esta oficina? Esto puede afectar a las credenciales de los empleados asignados.')) {
      return
    }

    try {
      setIsLoading(true)
      const { error } = await supabase
        .from('offices')
        .delete()
        .eq('id', officeId)

      if (error) {
        console.error('Error deleting office:', error)
        toast.error('Error al eliminar oficina')
        return
      }

      toast.success('Oficina eliminada exitosamente')
      await fetchOffices()
      onOfficeUpdate()
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Error inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({ name: '', address: '', email: '', phone: '', hr_phone: '' })
    setEditingOffice(null)
    setIsCreating(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Gestión de Oficinas</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="mb-6 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva Oficina
            </button>
          )}

          {/* Form */}
          {isCreating && (
            <form onSubmit={handleSubmit} className="mb-8 p-6 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">
                {editingOffice ? 'Editar Oficina' : 'Nueva Oficina'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la Oficina *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Oficina Tijuana"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: rh.tj@dcconcretos.com.mx"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección *
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Calle Caracas #12428, El Paraíso 22106"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono de Oficina *
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: 664 905 1813"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono RH *
                  </label>
                  <input
                    type="text"
                    value={formData.hr_phone}
                    onChange={(e) => setFormData({ ...formData, hr_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: 477 288 0120"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Guardando...' : editingOffice ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Offices List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Oficinas Registradas</h3>
            
            {isLoading && !isCreating && (
              <div className="text-center py-8 text-gray-500">Cargando oficinas...</div>
            )}

            {!isLoading && offices.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No hay oficinas registradas. Crea una nueva oficina para comenzar.
              </div>
            )}

            {offices.map((office) => (
              <div
                key={office.id}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-2">{office.name}</h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><span className="font-medium">Dirección:</span> {office.address}</p>
                      <p><span className="font-medium">Correo:</span> {office.email}</p>
                      <p><span className="font-medium">Teléfono:</span> {office.phone}</p>
                      <p><span className="font-medium">RH:</span> {office.hr_phone}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(office)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(office.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

