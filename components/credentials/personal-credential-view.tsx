"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Printer, Download, User, AlertCircle, CheckCircle } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { createClient } from '@/lib/supabase'
import { CredentialCard } from './credential-card'
import { PrintSpecifications } from './print-specifications'
import { toast } from 'sonner'
import { createRoot } from 'react-dom/client'

interface PersonalCredentialData {
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
  emergency_contact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  plants?: {
    name: string;
    contact_phone?: string;
    contact_email?: string;
    address?: string;
  }[];
}

export function PersonalCredentialView() {
  const [credentialData, setCredentialData] = useState<PersonalCredentialData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null)
  const [completionStatus, setCompletionStatus] = useState({
    basicInfo: false,
    systemCredentials: false,
    emergencyContact: false,
    overall: 0
  })
  
  const { profile, user } = useAuthZustand()
  const supabase = createClient()

  useEffect(() => {
    if (user?.id) {
      fetchPersonalCredentialData()
    }
  }, [user?.id])

  useEffect(() => {
    if (credentialData) {
      calculateCompletionStatus()
    }
  }, [credentialData])

  // Resolve signed URL for avatar_url if it's a storage path
  useEffect(() => {
    const resolveAvatar = async () => {
      if (!credentialData?.avatar_url) {
        setResolvedAvatarUrl(null)
        return
      }
      const val = credentialData.avatar_url
      if (val.startsWith('http') || val.startsWith('data:')) {
        setResolvedAvatarUrl(val)
        return
      }
      try {
        const { data, error } = await supabase.storage
          .from('profiles')
          .createSignedUrl(val, 3600)
        if (!error && data?.signedUrl) {
          setResolvedAvatarUrl(data.signedUrl)
        } else {
          setResolvedAvatarUrl(null)
        }
      } catch (_e) {
        setResolvedAvatarUrl(null)
      }
    }
    resolveAvatar()
    // Re-resolve on user change to refresh token context
  }, [credentialData?.avatar_url, user?.id])

  const fetchPersonalCredentialData = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
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
          emergency_contact,
          plants:plant_id (
            name,
            contact_phone,
            contact_email,
            address
          )
        `)
        .eq('id', user!.id)
        .single()

      if (error) {
        console.error('Error fetching credential data:', error)
        toast.error('Error al cargar datos de credencial')
        return
      }

      setCredentialData(data)
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Error inesperado al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  const calculateCompletionStatus = () => {
    if (!credentialData) return

    const basicInfo = !!(
      credentialData.nombre && 
      credentialData.apellido && 
      credentialData.employee_code && 
      credentialData.position &&
      credentialData.hire_date
    )

    const systemCredentials = !!(
      credentialData.system_username && 
      credentialData.system_password &&
      credentialData.imss_number
    )

    const emergencyContact = !!(
      credentialData.emergency_contact?.name &&
      credentialData.emergency_contact?.phone &&
      credentialData.emergency_contact?.relationship
    )

    const completedSections = [basicInfo, systemCredentials, emergencyContact].filter(Boolean).length
    const overall = Math.round((completedSections / 3) * 100)

    setCompletionStatus({
      basicInfo,
      systemCredentials,
      emergencyContact,
      overall
    })
  }

  const generateCredentialPDF = async (action: 'print' | 'download') => {
    if (!credentialData) return

    // Create hidden container and render the real component (ensures styles match preview)
    const container = document.createElement('div')
    container.style.cssText = 'position:absolute;left:-10000px;top:-10000px;width:auto;height:auto;background:white;'
    document.body.appendChild(container)

    const root = createRoot(container)
    root.render(
      <div id="__print_capture__">
        <CredentialCard employeeData={{ ...credentialData, avatar_url: resolvedAvatarUrl || credentialData.avatar_url }} showBoth={true} />
      </div>
    )

    // Allow layout/paint and image loading
    const waitNextFrame = () => new Promise(requestAnimationFrame)
    await waitNextFrame()

    // Ensure images are loaded
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

    const wrapper = container.querySelector('#__print_capture__') as HTMLElement
    await waitForImages(wrapper)

    try {
      // Identify front and back by structure to preserve order
      const pages = Array.from(wrapper.querySelectorAll('h3'))
        .filter(h => h.textContent?.includes('LADO'))
        .map(h => h.parentElement as HTMLElement)
        .filter(Boolean)
      let targets: HTMLElement[] = []
      if (pages.length === 2) {
        targets = [
          pages[0].querySelector('.print-card') as HTMLElement,
          pages[1].querySelector('.print-card') as HTMLElement,
        ].filter(Boolean)
      } else {
        // Fallback: collect print-card elements in DOM order
        targets = Array.from(wrapper.querySelectorAll('.print-card')) as HTMLElement[]
      }

      if (targets.length === 0) {
        throw new Error('No se encontraron tarjetas para exportar')
      }

      // Normalize font rendering by forcing exact computed styles on root
      const normalize = (el: HTMLElement) => {
        const cs = getComputedStyle(el)
        el.style.fontFamily = cs.fontFamily
        el.style.fontWeight = cs.fontWeight
        el.style.fontSize = cs.fontSize
        el.style.letterSpacing = cs.letterSpacing
        el.style.lineHeight = cs.lineHeight
      }
      targets.forEach(t => normalize(t))

      // Create PDF with exact staff-card size (3.375in x 5.25in)
      const pageW = 85.725
      const pageH = 133.35
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, pageH] })

      const captureCard = async (el: HTMLElement, isFirstPage: boolean) => {
        const canvas = await html2canvas(el, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0
        })
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.imageSmoothingEnabled = false
          ctx.imageSmoothingQuality = 'high'
        }
        const imgData = canvas.toDataURL('image/png')
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
        const w = canvas.width * ratio
        const h = canvas.height * ratio
        const x = (pageW - w) / 2
        const y = (pageH - h) / 2
        if (!isFirstPage) pdf.addPage()
        pdf.addImage(imgData, 'PNG', x, y, w, h)
      }

      for (let i = 0; i < targets.length; i++) {
        await captureCard(targets[i], i === 0)
      }

      if (action === 'print') {
        pdf.autoPrint()
        const blobUrl = pdf.output('bloburl')
        window.open(blobUrl)
      } else {
        const filename = `credencial-${credentialData.nombre}-${credentialData.apellido}.pdf`
        pdf.save(filename)
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Error al generar el PDF/Impresión')
    } finally {
      try { root.unmount() } catch {}
      document.body.removeChild(container)
    }
  }

  const handlePrintCredential = async () => {
    await generateCredentialPDF('print')
  }

  const handleDownloadPDF = async () => {
    await generateCredentialPDF('download')
  }

  const handleContactHR = () => {
    const subject = encodeURIComponent('Actualización de información para credencial de empleado')
    const body = encodeURIComponent(`Hola,

Solicito actualizar la siguiente información para mi credencial de empleado:

- Nombre: ${credentialData?.nombre} ${credentialData?.apellido}
- Código de empleado: ${credentialData?.employee_code || 'No asignado'}

Información a actualizar:
[ ] Número IMSS
[ ] Credenciales del sistema
[ ] Contacto de emergencia
[ ] Foto de perfil
[ ] Otro: ____________

Saludos,
${credentialData?.nombre} ${credentialData?.apellido}`)
    
    window.open(`mailto:rh.tj@dcconcretos.com.mx?subject=${subject}&body=${body}`)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!credentialData) {
    return (
      <Card className="p-6 text-center">
        <CardContent>
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error de Datos</h3>
          <p className="text-gray-600">
            No se pudieron cargar los datos de tu credencial. 
            Contacta al administrador del sistema.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mi Credencial de Empleado</h1>
        <p className="text-gray-600 mt-1">
          Visualiza e imprime tu credencial de empleado oficial
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Estado de Completitud
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium">Progreso general</span>
            <span className="text-sm text-gray-500">{completionStatus.overall}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${completionStatus.overall}%` }}
            ></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              {completionStatus.basicInfo ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              )}
              <span className="text-sm">Información básica</span>
            </div>
            <div className="flex items-center gap-2">
              {completionStatus.systemCredentials ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              )}
              <span className="text-sm">Credenciales del sistema</span>
            </div>
            <div className="flex items-center gap-2">
              {completionStatus.emergencyContact ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              )}
              <span className="text-sm">Contacto de emergencia</span>
            </div>
          </div>

          {completionStatus.overall < 100 && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">
                Tu credencial está incompleta. Contacta al área de Recursos Humanos para 
                actualizar la información faltante.
              </p>
              <Button 
                onClick={handleContactHR}
                variant="outline" 
                size="sm" 
                className="mt-2"
              >
                Contactar RH
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 justify-center">
            <Button onClick={handlePrintCredential} className="flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Imprimir Credencial
            </Button>
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Descargar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Credential Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Vista Previa de Credencial</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <CredentialCard employeeData={{ ...credentialData, avatar_url: resolvedAvatarUrl || credentialData.avatar_url }} showBoth={true} />
          </div>
        </CardContent>
      </Card>

      {/* Employee Info Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Empleado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Nombre completo:</span>
              <p>{credentialData.nombre} {credentialData.apellido}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Código de empleado:</span>
              <p>{credentialData.employee_code || 'No asignado'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Puesto:</span>
              <p>{credentialData.position || 'No especificado'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Fecha de ingreso:</span>
              <p>{credentialData.hire_date ? new Date(credentialData.hire_date).toLocaleDateString('es-MX') : 'No especificada'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Correo electrónico:</span>
              <p>{credentialData.email || 'No especificado'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Estado:</span>
              <Badge variant={credentialData.status === 'active' ? 'default' : 'secondary'}>
                {credentialData.status === 'active' ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <PrintSpecifications />
    </div>
  )
}
