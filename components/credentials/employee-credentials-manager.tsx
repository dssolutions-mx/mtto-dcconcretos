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
  const [photoFilter, setPhotoFilter] = useState<'all' | 'with' | 'without'>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [officeFilter, setOfficeFilter] = useState<string>('all')
  const [plantFilter, setPlantFilter] = useState<string>('all')
  
  const { profile, hasModuleAccess, hasWriteAccess } = useAuthZustand()
  const supabase = createClient()

  // Check if user can access this module
  const canManageCredentials = (
    profile?.role === 'GERENCIA_GENERAL' || 
    profile?.role === 'AREA_ADMINISTRATIVA' ||
    profile?.role === 'JEFE_UNIDAD_NEGOCIO'
  )

  const canEditCredentials = canManageCredentials

  // Get unique departments, offices, and plants for filters
  const uniqueDepartments = Array.from(new Set(employees
    .filter(emp => emp.departamento)
    .map(emp => emp.departamento)
  )).sort()

  const hasEmployeesWithoutDept = employees.some(emp => !emp.departamento)

  const uniquePlants = Array.from(new Set(employees
    .filter(emp => emp.plants)
    .map(emp => emp.plants?.id)
  )).filter(Boolean) as string[]

  const plantsData = Array.from(new Map(
    employees
      .filter(emp => emp.plants)
      .map(emp => [emp.plants?.id, emp.plants])
  ).values())

  useEffect(() => {
    if (canManageCredentials) {
      fetchEmployees()
      fetchOffices()
    }
  }, [canManageCredentials])

  useEffect(() => {
    const searchLower = searchTerm.toLowerCase()
    const filtered = employees.filter(emp => {
      const matchesSearch = (
        emp.nombre?.toLowerCase().includes(searchLower) ||
        emp.apellido?.toLowerCase().includes(searchLower) ||
        emp.employee_code?.toLowerCase().includes(searchLower) ||
        emp.position?.toLowerCase().includes(searchLower) ||
        emp.email?.toLowerCase().includes(searchLower)
      )
      if (!matchesSearch) return false
      
      if (photoFilter === 'with' && !emp.avatar_url) return false
      if (photoFilter === 'without' && emp.avatar_url) return false
      
      if (departmentFilter !== 'all') {
        if (departmentFilter === 'no-dept' && emp.departamento) return false
        if (departmentFilter !== 'no-dept' && emp.departamento !== departmentFilter) return false
      }
      if (officeFilter !== 'all' && emp.office_id !== officeFilter) return false
      if (plantFilter !== 'all' && emp.plants?.id !== plantFilter) return false
      
      return true
    })
    setFilteredEmployees(filtered)
  }, [searchTerm, employees, photoFilter, departmentFilter, officeFilter, plantFilter])

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
        .eq('is_active', true)

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

      // Normalize office and plant relations to single objects
      const mappedData = (data || []).map((emp: any) => {
        const mapped: any = { ...emp }

        // Office relation can come as object, array, or null
        if (typeof emp.offices !== 'undefined' && emp.offices !== null) {
          mapped.office = Array.isArray(emp.offices) ? (emp.offices[0] || null) : emp.offices
        } else if (typeof emp.office !== 'undefined') {
          mapped.office = emp.office
        } else {
          mapped.office = null
        }

        // Plants relation can come as object, array, or null
        if (typeof emp.plants !== 'undefined' && emp.plants !== null) {
          mapped.plants = Array.isArray(emp.plants) ? (emp.plants[0] || null) : emp.plants
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

    // Show loading state
    const loadingToastId = toast.loading('Preparando credenciales...')

    try {
      // Split into batches of 5 credentials per PDF
      const BATCH_SIZE = 5
      const batches = []
      for (let i = 0; i < toPrint.length; i += BATCH_SIZE) {
        batches.push(toPrint.slice(i, i + BATCH_SIZE))
      }

      console.log(`[Credentials] Starting PDF generation: ${toPrint.length} employees in ${batches.length} batches`)

      if (batches.length === 1) {
        // Single batch - process normally
        toast.dismiss(loadingToastId)
        await generatePDFForEmployees(batches[0], action, 1, 1)
      } else {
        // Multiple batches - process sequentially with progress
        for (let i = 0; i < batches.length; i++) {
          const batchNum = i + 1
          const totalBatches = batches.length
          console.log(`[Credentials] Processing batch ${batchNum} of ${totalBatches}...`)
          
          try {
            toast.dismiss(loadingToastId)
            toast.loading(`Generando lote ${batchNum} de ${totalBatches}...`)
            
            await generatePDFForEmployees(batches[i], action, batchNum, totalBatches)
            
            // Small delay between batch processing
            if (i < batches.length - 1) {
              await new Promise(r => setTimeout(r, 800))
            }
          } catch (error) {
            console.error(`[Credentials] Error processing batch ${batchNum}:`, error)
            toast.dismiss(loadingToastId)
            toast.error(`Error en lote ${batchNum} de ${totalBatches}: ${error instanceof Error ? error.message : 'Error desconocido'}`)
            throw error
          }
        }
        
        console.log('[Credentials] All batches processed successfully!')
        toast.dismiss(loadingToastId)
        toast.success(`${batches.length} lotes generados exitosamente`)
      }
    } catch (error) {
      console.error('[Credentials] Batch processing failed:', error)
      toast.dismiss(loadingToastId)
      if (!(error instanceof Error && error.message.includes('Falló'))) {
        toast.error('Error inesperado al generar credenciales')
      }
    }
  }

  const generatePDFForEmployees = async (rows: Employee[], action: 'print' | 'download', batchNum = 1, totalBatches = 1) => {
    console.log(`[PDF Gen] Starting PDF generation for batch ${batchNum}/${totalBatches} with ${rows.length} credentials`)
    
    const container = document.createElement('div')
    container.style.cssText = 'position:absolute;left:-10000px;top:-10000px;width:auto;height:auto;background:white;'
    document.body.appendChild(container)

    console.log('[PDF Gen] Container created and appended')

    const root = createRoot(container)
    root.render(
      <div id="__print_capture_bulk__" style={{ padding: '0', margin: '0' }}>
        {rows.map((emp, idx) => (
          <div 
            key={emp.id} 
            style={{
              marginBottom: idx === rows.length - 1 ? '0' : '8px',
              pageBreakInside: 'avoid',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <CredentialCard employeeData={emp} showBoth={true} />
          </div>
        ))}
      </div>
    )

    console.log('[PDF Gen] React component rendered')

    const waitNextFrame = () => new Promise(requestAnimationFrame)
    await waitNextFrame()

    console.log('[PDF Gen] Waiting for next frame complete')

    // Wait for wrapper and print-card elements to be rendered
    let wrapper: HTMLElement | null = null
    let attempts = 0
    const maxAttempts = 50 // 5 seconds max (50 * 100ms)
    
    while (!wrapper && attempts < maxAttempts) {
      wrapper = container.querySelector('#__print_capture_bulk__') as HTMLElement
      if (!wrapper || wrapper.querySelector('.print-card') === null) {
        console.log(`[PDF Gen] Waiting for cards to render... attempt ${attempts + 1}`)
        await new Promise(r => setTimeout(r, 100))
        attempts++
      } else {
        break
      }
    }

    if (!wrapper) {
      console.error('[PDF Gen] ERROR: Wrapper element not found after 5 seconds!')
      try { root.unmount() } catch {}
      document.body.removeChild(container)
      throw new Error('No se pudo preparar la vista de impresión - timeout')
    }

    const printCards = wrapper.querySelectorAll('.print-card')
    if (printCards.length === 0) {
      console.error(`[PDF Gen] ERROR: No print-card elements found! Wrapper HTML:`, wrapper.innerHTML.substring(0, 500))
      try { root.unmount() } catch {}
      document.body.removeChild(container)
      throw new Error('No se encontraron tarjetas para exportar')
    }

    console.log(`[PDF Gen] Wrapper found with ${printCards.length} cards, waiting for images...`)
    
    const waitForImages = async (scope: HTMLElement) => {
      const imgs = Array.from(scope.querySelectorAll('img')) as HTMLImageElement[]
      console.log(`[PDF Gen] Found ${imgs.length} images to wait for`)
      
      if (imgs.length === 0) {
        console.log('[PDF Gen] No images to wait for')
        return
      }
      
      const loadPromises = imgs.map((img, idx) => {
        if (img.complete && img.naturalWidth > 0) {
          console.log(`[PDF Gen] Image ${idx + 1} already loaded`)
          return Promise.resolve()
        }
        return new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`[PDF Gen] Image ${idx + 1} timeout after 15s`)
            resolve()
          }, 15000) // 15s timeout per image
          
          img.onload = () => {
            console.log(`[PDF Gen] Image ${idx + 1} loaded`)
            clearTimeout(timeout)
            resolve()
          }
          img.onerror = () => {
            console.warn(`[PDF Gen] Image ${idx + 1} failed to load`)
            clearTimeout(timeout)
            resolve()
          }
        })
      })
      await Promise.all(loadPromises)
      console.log('[PDF Gen] All images loaded')
    }
      
      await waitForImages(wrapper)
    
    // Wait time for 5 credentials: 600ms base + (5 × 200ms) = 1600ms
    // This is optimized since each PDF has max 5 credentials
    const waitTime = 600 + (rows.length * 200)
    await new Promise(resolve => setTimeout(resolve, waitTime))

    try {
      const pageW = 85.725
      const pageH = 133.35
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, pageH] })

      const cards = Array.from(wrapper.querySelectorAll('.print-card')) as HTMLElement[]
      if (cards.length === 0) {
        throw new Error('No se encontraron tarjetas para exportar')
      }

      const captureCard = async (el: HTMLElement, isFirstPage: boolean, retryCount = 0): Promise<void> => {
        try {
          // HIGH QUALITY: Keep scale at 3 since we limit to 5 per PDF
          const canvas = await html2canvas(el, {
            scale: 3,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            logging: false,
            timeout: 45000,
            windowHeight: el.offsetHeight || 1000,
            windowWidth: el.offsetWidth || 400,
          })
          
          // High quality PNG (no compression)
          const imgData = canvas.toDataURL('image/png')
          const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
          const w = canvas.width * ratio
          const h = canvas.height * ratio
          const x = (pageW - w) / 2
          const y = (pageH - h) / 2
          
          if (!isFirstPage) pdf.addPage()
          pdf.addImage(imgData, 'PNG', x, y, w, h)
        } catch (cardError) {
          if (retryCount < 2) {
            console.warn(`Retry ${retryCount + 1} for card capture:`, cardError)
            await new Promise(r => setTimeout(r, 500 * (retryCount + 1)))
            return captureCard(el, isFirstPage, retryCount + 1)
          }
          console.error(`Error capturing card after ${retryCount + 1} attempts:`, cardError)
          throw cardError
        }
      }

      for (let i = 0; i < cards.length; i++) {
        try {
          await captureCard(cards[i], i === 0)
        } catch (error) {
          console.error(`Failed to capture card ${i + 1} of ${cards.length}:`, error)
          throw new Error(`Falló al procesar credencial ${i + 1} de ${cards.length}`)
        }
        
        // Small delay between cards to prevent memory buildup
        if (i < cards.length - 1) {
          await new Promise(r => setTimeout(r, 100))
        }
      }

      console.log(`[PDF Gen] All ${cards.length} cards captured successfully, generating PDF...`)

      // Generate filename for all actions
      let filename: string
      if (rows.length === 1) {
        filename = `credencial-${rows[0].nombre}-${rows[0].apellido}.pdf`
      } else if (totalBatches === 1) {
        filename = `credenciales-${rows.length}-empleados.pdf`
      } else {
        // Multiple batches - include batch number in filename
        filename = `credenciales-lote-${batchNum}-de-${totalBatches}.pdf`
      }

      if (action === 'print') {
        console.log('[PDF Gen] Action is PRINT, saving for print: ' + filename)
        // Save the PDF - user can print from downloads
        pdf.save(filename)
        console.log('[PDF Gen] PDF saved, user can print from downloads folder')
      } else {
        console.log(`[PDF Gen] Action is DOWNLOAD, saving as: ${filename}`)
        // Download the PDF
        pdf.save(filename)
        console.log('[PDF Gen] PDF saved successfully')
      }
      
      // Show success message for each batch
      if (totalBatches > 1) {
        console.log(`[PDF Gen] Batch ${batchNum}/${totalBatches} completed successfully`)
        toast.success(`Lote ${batchNum} de ${totalBatches} completado (${rows.length} credenciales)`)
      } else {
        console.log('[PDF Gen] Single batch completed successfully')
        toast.success(`PDF generado exitosamente (${rows.length} credenciales)`)
      }
    } catch (error) {
      console.error('[PDF Gen] ERROR in PDF generation:', error)
      console.error('[PDF Gen] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      })
      if (totalBatches > 1) {
        throw error // Re-throw to be caught by batch handler
      }
      toast.error(`Error al generar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      console.log('[PDF Gen] Cleaning up - unmounting React and removing container')
      try { root.unmount() } catch {}
      try { document.body.removeChild(container) } catch {}
      console.log('[PDF Gen] Cleanup complete')
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
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar empleados..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Filters Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Foto</Label>
                <Select
                  value={photoFilter}
                  onValueChange={(value) => setPhotoFilter(value as 'all' | 'with' | 'without')}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="with">Con foto</SelectItem>
                    <SelectItem value="without">Sin foto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Departamento</Label>
                <Select
                  value={departmentFilter}
                  onValueChange={setDepartmentFilter}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {uniqueDepartments.map(dept => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                    {hasEmployeesWithoutDept && (
                       <SelectItem value="no-dept">Sin Departamento</SelectItem>
                     )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Oficina</Label>
                <Select
                  value={officeFilter}
                  onValueChange={setOfficeFilter}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {offices.map(office => (
                      <SelectItem key={office.id} value={office.id}>
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Planta</Label>
                <Select
                  value={plantFilter}
                  onValueChange={setPlantFilter}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {plantsData.map(plant => (
                      <SelectItem key={plant?.id} value={plant?.id || ''}>
                        {plant?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm('')
                    setPhotoFilter('all')
                    setDepartmentFilter('all')
                    setOfficeFilter('all')
                    setPlantFilter('all')
                  }}
                  className="w-full"
                >
                  Limpiar
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
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
                          {!employee.avatar_url && (
                            <div className="mt-1">
                              <Badge variant="outline" className="text-xs text-red-700 border-red-300">
                                Sin foto
                              </Badge>
                            </div>
                          )}
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

