"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Printer, Download, Eye, Edit, Users, FileText, UserPlus, Upload, X, Camera, Save, XCircle, Building2 } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { createRoot } from 'react-dom/client'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { createClient } from '@/lib/supabase'
import { CredentialCard } from './credential-card'
import { PrintSpecifications } from './print-specifications'
import { OfficeManagementModal } from './office-management-modal'
import type { Office } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

interface Employee {
  id: string;
  nombre: string;
  apellido: string;
  email?: string;
  employee_code?: string;
  position?: string;
  role?: string;
  hire_date?: string;
  status?: string;
  avatar_url?: string;
  telefono?: string;
  phone_secondary?: string;
  imss_number?: string;
  system_username?: string;
  system_password?: string;
  system_access_password?: string;
  credential_notes?: string;
  departamento?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  estado_civil?: string;
  nivel_educacion?: string;
  experiencia_anos?: number;
  tipo_contrato?: string;
  shift?: string;
  notas_rh?: string;
  emergency_contact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  plants?: {
    id: string;
    name: string;
    contact_phone?: string;
    contact_email?: string;
    address?: string;
  } | null;
  business_units?: {
    id: string;
    name: string;
  };
  office_id?: string;
  office?: Office;
}

export function EmployeeCredentialsManager() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'credentials'>('table')
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [stagedAvatarFile, setStagedAvatarFile] = useState<File | null>(null)
  const [stagedAvatarPreview, setStagedAvatarPreview] = useState<string | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [isBulkOperation, setIsBulkOperation] = useState(false)
  const [offices, setOffices] = useState<Office[]>([])
  const [isOfficeModalOpen, setIsOfficeModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { profile, hasModuleAccess, hasWriteAccess } = useAuthZustand()
  const supabase = createClient()

  // Check if user can access this module
  const canManageCredentials = (
    profile?.role === 'GERENCIA_GENERAL' || 
    profile?.role === 'AREA_ADMINISTRATIVA' ||
    profile?.role === 'JEFE_UNIDAD_NEGOCIO'
  )

  const canEditCredentials = canManageCredentials


  useEffect(() => {
    if (canManageCredentials) {
      fetchEmployees()
      fetchOffices()
    }
  }, [canManageCredentials])

  useEffect(() => {
    const filtered = employees.filter(emp => {
      const searchLower = searchTerm.toLowerCase()
      return (
        emp.nombre?.toLowerCase().includes(searchLower) ||
        emp.apellido?.toLowerCase().includes(searchLower) ||
        emp.employee_code?.toLowerCase().includes(searchLower) ||
        emp.position?.toLowerCase().includes(searchLower) ||
        emp.email?.toLowerCase().includes(searchLower)
      )
    })
    setFilteredEmployees(filtered)
  }, [searchTerm, employees])

  // Simple in-memory cache for signed URLs
  const signedUrlCache = useRef<Map<string, { url: string; expiresAt: number }>>(new Map())

  const getSignedUrl = async (path: string, ttlSeconds = 3600): Promise<string | null> => {
    try {
      const cacheEntry = signedUrlCache.current.get(path)
      const now = Date.now()
      if (cacheEntry && cacheEntry.expiresAt > now + 15_000) {
        return cacheEntry.url
      }
      const { data, error } = await supabase.storage
        .from('profiles')
        .createSignedUrl(path, ttlSeconds)
      if (error || !data?.signedUrl) {
        return null
      }
      signedUrlCache.current.set(path, { url: data.signedUrl, expiresAt: now + ttlSeconds * 1000 })
      return data.signedUrl
    } catch (_err) {
      return null
    }
  }

  const resolveAvatarUrls = async (rows: Employee[]): Promise<Employee[]> => {
    // Collect storage paths
    const pathToIndexes: Record<string, number[]> = {}
    rows.forEach((emp, idx) => {
      const val = emp.avatar_url || ''
      // Treat values that look like storage paths: avatars/{id}/...
      if (val && !val.startsWith('http') && !val.startsWith('data:')) {
        if (!pathToIndexes[val]) pathToIndexes[val] = []
        pathToIndexes[val].push(idx)
      }
    })

    const paths = Object.keys(pathToIndexes)
    if (paths.length === 0) return rows

    // Batch where possible
    const batchedResults: Record<string, string> = {}
    try {
      const { data, error } = await supabase.storage
        .from('profiles')
        .createSignedUrls(paths, 3600)
      if (!error && Array.isArray(data)) {
        data.forEach((res, i) => {
          if (res?.signedUrl) batchedResults[paths[i]] = res.signedUrl
        })
      }
    } catch (_e) {}

    // Fallback individually for any missing
    await Promise.all(paths.map(async (p) => {
      if (!batchedResults[p]) {
        const url = await getSignedUrl(p)
        if (url) batchedResults[p] = url
      }
    }))

    const out = [...rows]
    Object.entries(pathToIndexes).forEach(([p, idxs]) => {
      const url = batchedResults[p]
      if (url) {
        idxs.forEach((i) => {
          out[i] = { ...out[i], avatar_url: url }
        })
      }
    })
    return out
  }

  const fetchOffices = async () => {
    try {
      const { data, error } = await supabase
        .from('offices')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching offices:', error)
        return
      }

      setOffices(data || [])
    } catch (error) {
      console.error('Unexpected error:', error)
    }
  }

  const fetchEmployees = async () => {
    try {
      setIsLoading(true)
      let query = supabase
        .from('profiles')
        .select(`
          id,
          nombre,
          apellido,
          email,
          employee_code,
          position,
          role,
          hire_date,
          status,
          avatar_url,
          telefono,
          phone_secondary,
          imss_number,
          system_username,
          system_password,
          system_access_password,
          credential_notes,
          departamento,
          direccion,
          fecha_nacimiento,
          estado_civil,
          nivel_educacion,
          experiencia_anos,
          tipo_contrato,
          shift,
          notas_rh,
          emergency_contact,
          office_id,
          plants:plant_id (
            id,
            name,
            contact_phone,
            contact_email,
            address
          ),
          business_units:business_unit_id (
            id,
            name
          ),
          offices:office_id (
            id,
            name,
            address,
            email,
            phone,
            hr_phone
          )
        `)
        .eq('status', 'active')

      // Apply RLS filters based on user's role and scope
      if (profile?.role !== 'GERENCIA_GENERAL') {
        if (profile?.plant_id) {
          query = query.eq('plant_id', profile.plant_id)
        } else if (profile?.business_unit_id) {
          query = query.eq('business_unit_id', profile.business_unit_id)
        }
      }

      const { data, error } = await query.order('nombre')

      if (error) {
        console.error('Error fetching employees:', error)
        toast.error('Error al cargar empleados')
        return
      }

      // Map offices and plants arrays to single objects
      const mappedData = (data || []).map((emp: any) => {
        const mapped: any = { ...emp }
        if (emp.offices && Array.isArray(emp.offices) && emp.offices.length > 0) {
          mapped.office = emp.offices[0]
        }
        if (emp.plants && Array.isArray(emp.plants) && emp.plants.length > 0) {
          mapped.plants = emp.plants[0]
        } else {
          mapped.plants = null
        }
        delete mapped.offices
        return mapped
      })
      const withAvatars = await resolveAvatarUrls(mappedData)
      setEmployees(withAvatars as Employee[])
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Error inesperado al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrintCredentials = async (employeeIds: string[] = [], action: 'print' | 'download' = 'print') => {
    const toPrint = employeeIds.length > 0 
      ? employees.filter(emp => employeeIds.includes(emp.id))
      : filteredEmployees

    if (toPrint.length === 0) {
      toast.error('No hay empleados para imprimir')
      return
    }

    await generatePDFForEmployees(toPrint, action)
  }

  const generatePDFForEmployees = async (rows: Employee[], action: 'print' | 'download') => {
    const container = document.createElement('div')
    container.style.cssText = 'position:absolute;left:-10000px;top:-10000px;width:auto;height:auto;background:white;'
    document.body.appendChild(container)

    const root = createRoot(container)
    root.render(
      <div id="__print_capture_bulk__">
        {rows.map((emp) => (
          <div key={emp.id} className="mb-6">
            <div className="flex justify-center">
              <CredentialCard employeeData={emp} showBoth={true} />
            </div>
          </div>
        ))}
      </div>
    )

    const waitNextFrame = () => new Promise(requestAnimationFrame)
    await waitNextFrame()

    const wrapper = container.querySelector('#__print_capture_bulk__') as HTMLElement
    if (!wrapper) {
      try { root.unmount() } catch {}
      document.body.removeChild(container)
      toast.error('No se pudo preparar la vista de impresión')
      return
    }

    const waitForImages = async (scope: HTMLElement) => {
      const imgs = Array.from(scope.querySelectorAll('img')) as HTMLImageElement[]
      await Promise.all(
        imgs.map(img => (
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>(resolve => {
                img.onload = () => resolve()
                img.onerror = () => resolve()
              })
        ))
      )
    }
    await waitForImages(wrapper)

    try {
      const pageW = 85.725
      const pageH = 133.35
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, pageH] })

      const cards = Array.from(wrapper.querySelectorAll('.print-card')) as HTMLElement[]
      if (cards.length === 0) {
        throw new Error('No se encontraron tarjetas para exportar')
      }

      const captureCard = async (el: HTMLElement, isFirstPage: boolean) => {
        const canvas = await html2canvas(el, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0
        })
        const imgData = canvas.toDataURL('image/png')
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
        const w = canvas.width * ratio
        const h = canvas.height * ratio
        const x = (pageW - w) / 2
        const y = (pageH - h) / 2
        if (!isFirstPage) pdf.addPage()
        pdf.addImage(imgData, 'PNG', x, y, w, h)
      }

      for (let i = 0; i < cards.length; i++) {
        await captureCard(cards[i], i === 0)
      }

      if (action === 'print') {
        pdf.autoPrint()
        const blobUrl = pdf.output('bloburl')
        window.open(blobUrl)
      } else {
        const filename = rows.length === 1
          ? `credencial-${rows[0].nombre}-${rows[0].apellido}.pdf`
          : `credenciales-${rows.length}-empleados.pdf`
        pdf.save(filename)
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Error al generar PDF de credenciales')
    } finally {
      try { root.unmount() } catch {}
      document.body.removeChild(container)
    }
  }

  const generateCredentialHTML = (employee: Employee) => {
    // This would generate the HTML for a credential card
    // For now, return a placeholder
    return `
      <div class="print-card">
        <div style="background: linear-gradient(135deg, #2563eb, #1e40af); height: 140px; color: white; text-align: center; padding: 20px;">
          <h2 style="margin: 0; font-size: 18px; font-weight: bold;">DC CONCRETOS</h2>
          <p style="margin: 5px 0 0 0; font-size: 12px;">CREDENCIAL DE EMPLEADO</p>
        </div>
        <div style="padding: 20px; text-align: center;">
          <h3 style="margin: 0 0 5px 0; font-size: 20px;">${employee.nombre} ${employee.apellido}</h3>
          <p style="margin: 0 0 20px 0; color: #2563eb; font-weight: 600;">${employee.position || 'Empleado'}</p>
          <div style="text-align: left; font-size: 12px; line-height: 1.5;">
            <p><strong>ID:</strong> ${employee.employee_code || 'DC-2025-001'}</p>
            <p><strong>Ingreso:</strong> ${employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('es-MX') : 'N/A'}</p>
            ${employee.imss_number ? `<p><strong>IMSS:</strong> ${employee.imss_number}</p>` : ''}
          </div>
        </div>
      </div>
    `
  }

  const handleStageAvatar = (file: File, _employeeId: string) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Solo se permiten archivos JPG, JPEG, PNG o WebP')
      return
    }
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('El archivo es demasiado grande. Máximo 5MB')
      return
    }
    // Stage locally: preview without uploading yet
    try {
      if (stagedAvatarPreview) {
        URL.revokeObjectURL(stagedAvatarPreview)
      }
      const url = URL.createObjectURL(file)
      setStagedAvatarFile(file)
      setStagedAvatarPreview(url)
      toast.message('Vista previa lista', { description: 'Guarda para aplicar cambios' })
    } catch (_e) {
      toast.error('No se pudo preparar la vista previa')
    }
  }

  const handleSaveCredentials = async (employeeData: Employee) => {
    try {
      let newAvatarStoragePath: string | undefined
      // If there is a staged avatar, upload it now
      if (stagedAvatarFile) {
        const employeeId = employeeData.id
        // Clean previous files in employee folder
        try {
          const { data: existingFiles } = await supabase.storage
            .from('profiles')
            .list(`avatars/${employeeId}/`, { limit: 100, offset: 0 })
          if (existingFiles && existingFiles.length > 0) {
            const filesToDelete = existingFiles.map(f => `avatars/${employeeId}/${f.name}`)
            await supabase.storage.from('profiles').remove(filesToDelete)
          }
        } catch (_e) {}

        // Upload new file
        const timestamp = Date.now()
        const fileExt = stagedAvatarFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `avatars/${employeeId}/profile_${timestamp}.${fileExt}`
        const { error: uploadErr } = await supabase.storage
          .from('profiles')
          .upload(fileName, stagedAvatarFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: stagedAvatarFile.type
          })
        if (uploadErr) {
          console.error('Upload error:', uploadErr)
          toast.error('Error al subir la nueva foto')
          return
        }
        newAvatarStoragePath = fileName
      }

      const updatePayload: any = {
        nombre: employeeData.nombre,
        apellido: employeeData.apellido,
        email: employeeData.email,
        employee_code: employeeData.employee_code,
        position: employeeData.position,
        role: employeeData.role,
        hire_date: employeeData.hire_date,
        status: employeeData.status,
        telefono: employeeData.telefono,
        phone_secondary: employeeData.phone_secondary,
        imss_number: employeeData.imss_number,
        system_access_password: employeeData.system_access_password,
        credential_notes: employeeData.credential_notes,
        departamento: employeeData.departamento,
        direccion: employeeData.direccion,
        fecha_nacimiento: employeeData.fecha_nacimiento,
        estado_civil: employeeData.estado_civil,
        nivel_educacion: employeeData.nivel_educacion,
        experiencia_anos: employeeData.experiencia_anos,
        tipo_contrato: employeeData.tipo_contrato,
        shift: employeeData.shift,
        notas_rh: employeeData.notas_rh,
        emergency_contact: employeeData.emergency_contact,
        office_id: employeeData.office_id || null,
        updated_at: new Date().toISOString()
      }
      if (newAvatarStoragePath) {
        updatePayload.avatar_url = newAvatarStoragePath
      }

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', employeeData.id)

      if (error) {
        console.error('Error updating employee:', error)
        toast.error('Error al guardar información del empleado')
        return
      }

      toast.success('Información del empleado actualizada exitosamente')
      // Clean staged preview
      if (stagedAvatarPreview) {
        URL.revokeObjectURL(stagedAvatarPreview)
      }
      setStagedAvatarFile(null)
      setStagedAvatarPreview(null)
      setEditingEmployee(null)
      await fetchEmployees()
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Error inesperado al guardar')
    }
  }

  const handleSelectEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  const handleSelectAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([])
    } else {
      setSelectedEmployees(filteredEmployees.map(emp => emp.id))
    }
  }

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedEmployees.length === 0) {
      toast.error('Selecciona al menos un empleado')
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .in('id', selectedEmployees)

      if (error) {
        console.error('Error updating status:', error)
        toast.error('Error al actualizar estado de empleados')
        return
      }

      toast.success(`${selectedEmployees.length} empleados actualizados exitosamente`)
      setSelectedEmployees([])
      await fetchEmployees()
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Error inesperado al actualizar')
    }
  }

  const handleBulkPrint = async () => {
    if (selectedEmployees.length === 0) {
      toast.error('Selecciona al menos un empleado')
      return
    }
    const selectedEmployeesData = filteredEmployees.filter(emp => selectedEmployees.includes(emp.id))
    await generatePDFForEmployees(selectedEmployeesData, 'print')
  }

  if (!canManageCredentials) {
    return (
      <Card className="p-6 text-center">
        <CardContent>
          <Users className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Acceso Restringido</h3>
          <p className="text-gray-600">
            No tienes permisos para gestionar credenciales de empleados.
            Contacta a un administrador si necesitas acceso.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Credenciales</h1>
          <p className="text-gray-600 mt-1">
            Administra las credenciales de empleados para impresión
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => setViewMode('table')}
            size="sm"
          >
            <FileText className="w-4 h-4 mr-2" />
            Tabla
          </Button>
          <Button
            variant={viewMode === 'credentials' ? 'default' : 'outline'}
            onClick={() => setViewMode('credentials')}
            size="sm"
          >
            <Eye className="w-4 h-4 mr-2" />
            Vista Previa
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsOfficeModalOpen(true)}
            size="sm"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Gestionar Oficinas
          </Button>
        </div>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar empleados..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handlePrintCredentials()}
                disabled={filteredEmployees.length === 0}
                variant="default"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir Todos ({filteredEmployees.length})
              </Button>
              <Button
                onClick={() => {/* Handle bulk export */}}
                disabled={filteredEmployees.length === 0}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {viewMode === 'table' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Empleados ({filteredEmployees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Bulk Operations Controls */}
            {selectedEmployees.length > 0 && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-blue-900">
                      {selectedEmployees.length} empleado(s) seleccionado(s)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkStatusUpdate('active')}
                      >
                        Activar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkStatusUpdate('inactive')}
                      >
                        Desactivar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkPrint}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir
                      </Button>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedEmployees([])}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Credenciales</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(employee.id)}
                        onChange={() => handleSelectEmployee(employee.id)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                          {employee.avatar_url ? (
                            <img 
                              src={employee.avatar_url} 
                              alt={`${employee.nombre} ${employee.apellido}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Users className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{employee.nombre} {employee.apellido}</p>
                          <p className="text-sm text-gray-500">{employee.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {employee.employee_code || 'Sin código'}
                      </Badge>
                    </TableCell>
                    <TableCell>{employee.position || 'Sin puesto'}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={employee.status === 'active' ? 'default' : 'secondary'}
                      >
                        {employee.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        {employee.imss_number && <Badge variant="outline" className="text-xs">IMSS</Badge>}
                        {employee.system_access_password && <Badge variant="outline" className="text-xs">Acceso</Badge>}
                        {employee.emergency_contact && <Badge variant="outline" className="text-xs">Emergencia</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>
                                Credencial de {employee.nombre} {employee.apellido}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="mt-4">
                              <CredentialCard employeeData={employee} />
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Edit className="w-4 h-4 mr-1" />
                                Editar
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl w-[90vw] sm:w-[800px] max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>
                                  Editar Credenciales - {employee.nombre} {employee.apellido}
                                </DialogTitle>
                              </DialogHeader>
                              <EmployeeCredentialEditForm
                                employee={employee}
                                onSave={handleSaveCredentials}
                                onCancel={() => {
                                  setEditingEmployee(null)
                                  setStagedAvatarPreview(null)
                                }}
                                onStageAvatar={handleStageAvatar}
                                stagedPreview={stagedAvatarPreview}
                                offices={offices}
                              />
                            </DialogContent>
                          </Dialog>
                        
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handlePrintCredentials([employee.id])}
                        >
                          <Printer className="w-4 h-4 mr-1" />
                          Imprimir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {filteredEmployees.map((employee) => (
            <Card key={employee.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{employee.nombre} {employee.apellido}</span>
                  <Button 
                    onClick={() => handlePrintCredentials([employee.id])}
                    size="sm"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CredentialCard employeeData={employee} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PrintSpecifications />
      
      {/* Office Management Modal */}
      <OfficeManagementModal
        isOpen={isOfficeModalOpen}
        onClose={() => setIsOfficeModalOpen(false)}
        onOfficeUpdate={() => {
          fetchOffices()
          fetchEmployees()
        }}
      />
    </div>
  )
}

// Employee Credential Edit Form Component
interface EmployeeCredentialEditFormProps {
  employee: Employee;
  onSave: (employee: Employee) => void;
  onCancel: () => void;
  onStageAvatar: (file: File, employeeId: string) => void;
  stagedPreview: string | null;
  offices: Office[];
}

function EmployeeCredentialEditForm({ 
  employee, 
  onSave, 
  onCancel, 
  onStageAvatar, 
  stagedPreview,
  offices
}: EmployeeCredentialEditFormProps) {
  const [formData, setFormData] = useState<Employee>(employee)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onStageAvatar(file, employee.id)
    }
  }

  const currentAvatar = stagedPreview || formData.avatar_url

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Picture Section */}
      <div className="flex items-center space-x-6 p-4 bg-gray-50 rounded-lg">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 border-4 border-gray-300">
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={`${formData.nombre} ${formData.apellido}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Camera className="w-8 h-8" />
              </div>
            )}
          </div>
          
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {formData.nombre} {formData.apellido}
          </h3>
          <p className="text-sm text-gray-600">{formData.position}</p>
          <div className="mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Cambiar Foto
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={formData.nombre || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  value={formData.apellido || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, apellido: e.target.value }))}
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email (Usuario del Sistema)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="usuario@dcconcretos.com.mx"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  El email será usado como usuario del sistema
                </p>
              </div>
              <div>
                <Label htmlFor="employee_code">Código de Empleado</Label>
                <Input
                  id="employee_code"
                  value={formData.employee_code || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, employee_code: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="telefono">Teléfono Principal</Label>
                <Input
                  id="telefono"
                  value={formData.telefono || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="phone_secondary">Teléfono Secundario</Label>
                <Input
                  id="phone_secondary"
                  value={formData.phone_secondary || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone_secondary: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="imss_number">Número IMSS</Label>
                <Input
                  id="imss_number"
                  value={formData.imss_number || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, imss_number: e.target.value }))}
                  placeholder="12345678910"
                />
              </div>
              <div>
                <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                <Input
                  id="fecha_nacimiento"
                  type="date"
                  value={formData.fecha_nacimiento || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, fecha_nacimiento: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información Laboral</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="position">Posición/Cargo</Label>
                <Input
                  id="position"
                  value={formData.position || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="departamento">Departamento</Label>
                <Input
                  id="departamento"
                  value={formData.departamento || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, departamento: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Rol</Label>
                <Select
                  value={formData.role || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GERENCIA_GENERAL">Gerencia General</SelectItem>
                    <SelectItem value="JEFE_UNIDAD_NEGOCIO">Jefe de Unidad de Negocio</SelectItem>
                    <SelectItem value="AREA_ADMINISTRATIVA">Área Administrativa</SelectItem>
                    <SelectItem value="JEFE_PLANTA">Jefe de Planta</SelectItem>
                    <SelectItem value="ENCARGADO_MANTENIMIENTO">Encargado de Mantenimiento</SelectItem>
                    <SelectItem value="DOSIFICADOR">Dosificador</SelectItem>
                    <SelectItem value="OPERADOR">Operador</SelectItem>
                    <SelectItem value="AUXILIAR_COMPRAS">Auxiliar de Compras</SelectItem>
                    <SelectItem value="EJECUTIVO">Ejecutivo</SelectItem>
                    <SelectItem value="VISUALIZADOR">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={formData.status || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                    <SelectItem value="suspended">Suspendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hire_date">Fecha de Contratación</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={formData.hire_date || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, hire_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="tipo_contrato">Tipo de Contrato</Label>
                <Select
                  value={formData.tipo_contrato || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tipo_contrato: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tiempo_completo">Tiempo Completo</SelectItem>
                    <SelectItem value="medio_tiempo">Medio Tiempo</SelectItem>
                    <SelectItem value="temporal">Temporal</SelectItem>
                    <SelectItem value="por_proyecto">Por Proyecto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Credenciales del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="system_access_password">Código de Acceso (Planta)</Label>
              <Input
                id="system_access_password"
                type="text"
                value={formData.system_access_password || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, system_access_password: e.target.value }))}
                placeholder="Planta01DC"
              />
              <p className="text-xs text-gray-500 mt-1">
                Código específico mostrado en credencial (ej: Planta01DC, Planta02DC)
              </p>
            </div>

            <div>
              <Label htmlFor="office_id">Oficina Asignada</Label>
              <Select
                value={formData.office_id || 'none'}
                onValueChange={(value) => setFormData(prev => ({ ...prev, office_id: value === 'none' ? null : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una oficina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin oficina asignada</SelectItem>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                La información de contacto de la oficina aparecerá en la credencial
              </p>
            </div>

            <div>
              <Label htmlFor="credential_notes">Notas Adicionales</Label>
              <Textarea
                id="credential_notes"
                value={formData.credential_notes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, credential_notes: e.target.value }))}
                placeholder="Notas adicionales para la credencial"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contacto de Emergencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="emergency_name">Nombre Completo</Label>
                <Input
                  id="emergency_name"
                  value={formData.emergency_contact?.name || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    emergency_contact: { ...prev.emergency_contact, name: e.target.value }
                  }))}
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <Label htmlFor="emergency_relationship">Relación</Label>
                <Input
                  id="emergency_relationship"
                  value={formData.emergency_contact?.relationship || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    emergency_contact: { ...prev.emergency_contact, relationship: e.target.value }
                  }))}
                  placeholder="Familiar, amigo, etc."
                />
              </div>
              <div>
                <Label htmlFor="emergency_phone">Teléfono</Label>
                <Input
                  id="emergency_phone"
                  value={formData.emergency_contact?.phone || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    emergency_contact: { ...prev.emergency_contact, phone: e.target.value }
                  }))}
                  placeholder="Número de teléfono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button type="submit">
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </form>
    </div>
  )
}

