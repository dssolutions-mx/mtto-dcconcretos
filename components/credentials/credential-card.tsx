"use client"

import { useState, useEffect } from 'react'
import { User } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Office } from '@/types'

interface CredentialCardProps {
  employeeData: {
    id: string;
    nombre: string;
    apellido: string;
    email?: string;
    employee_code?: string;
    position?: string;
    departamento?: string;
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
      name?: string;
      relationship?: string;
      phone?: string;
    };
    office?: Office;
  };
  showBoth?: boolean;
}

// Brand palette
const BRAND_DARK_BLUE = '#1f3a5c'
const BRAND_GREEN = '#079e2e' // RGB(7, 158, 46) - exact logo green

export function CredentialCard({ 
  employeeData, 
  showBoth = false
}: CredentialCardProps) {
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [processedAvatarUrl, setProcessedAvatarUrl] = useState<string | null>(null);

  // Process avatar image with brightness enhancement baked into pixels
  // This ensures the enhancement appears in both screen view and PDF export
  useEffect(() => {
    const sourceUrl = employeeData.avatar_url;
    if (!sourceUrl) {
      setProcessedAvatarUrl(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = sourceUrl;

    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 256;
        canvas.height = img.naturalHeight || 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw image without filters for natural appearance
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const enhancedUrl = canvas.toDataURL('image/png');
        setProcessedAvatarUrl(enhancedUrl);
      } catch (error) {
        console.error('Error processing avatar image:', error);
        setProcessedAvatarUrl(null);
      }
    };

    img.onerror = () => {
      console.error('Error loading avatar image');
      setProcessedAvatarUrl(null);
    };

    return () => { cancelled = true; };
  }, [employeeData.avatar_url]);

  // Get office info or use defaults
  const officeInfo = employeeData.office || {
    name: 'DC CONCRETOS',
    address: 'Calle Caracas #12428, El Paraíso 22106',
    email: 'rh.tj@dcconcretos.com.mx',
    phone: '664 905 1813',
    hr_phone: '477 288 0120'
  };

  const formatEmployeeId = (code: string | null | undefined) => {
    if (!code) return 'DC-2025-001';
    return code.startsWith('DC-') ? code : `DC-${new Date().getFullYear()}-${code}`;
  };

  const getSystemCredentials = () => {
    return {
      accessPassword: employeeData.system_access_password || 'Planta01DC'
    };
  };

  const handleDownloadPDF = async () => {
    const element = document.querySelector('.print-stack') as HTMLElement;
    if (!element) {
      console.error('Print stack element not found');
      return;
    }

    try {
      // Generate canvas from the HTML element
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 300,
        height: 800,
        scrollX: 0,
        scrollY: 0
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [85.6, 53.98] // Standard credit card size in mm
      });

      // Calculate dimensions to fit the card
      const cardWidth = 85.6;
      const cardHeight = 53.98;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(cardWidth / imgWidth, cardHeight / imgHeight);

      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      const x = (cardWidth - finalWidth) / 2;
      const y = (cardHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);

      // Download the PDF
      const filename = `credencial-${employeeData.nombre}-${employeeData.apellido}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const CredentialCardFront = () => {
    return (
    <div className="w-[300px] h-[468px] bg-white rounded-lg shadow-lg overflow-hidden border-2 border-gray-200 print-card relative">
      {/* Top dark blue bar */}
      <div style={{ height: '12px', backgroundColor: BRAND_DARK_BLUE }} className="absolute inset-x-0 top-0 z-10" />

      {/* Header spacer (removed top logo) */}
      <div className="bg-gray-50 h-[20px] w-full" />

      {/* Professional Photo Section */}
      <div className="flex justify-center pt-10 pb-2">
        <div className="w-32 h-32 bg-white flex items-center justify-center">
          {processedAvatarUrl ? (
            <img
              src={processedAvatarUrl}
              alt={`${employeeData.nombre} ${employeeData.apellido}`}
              className="h-full w-auto block"
              crossOrigin="anonymous"
              style={{ objectFit: 'contain' }}
            />
          ) : (
            <User size={40} className="text-gray-300" />
          )}
        </div>
      </div>
      
      {/* Employee Information - Executive Style */}
      <div className="px-6 pb-20">{/* extra bottom padding to avoid overlapping enlarged footer/logo */}
        {/* Name Section */}
        <div className="text-center space-y-1 pt-2">
          <h2 className="text-base font-bold text-gray-900 leading-tight">
            {employeeData.nombre} {employeeData.apellido}
          </h2>
          <p className="text-gray-600 font-medium text-[11px]">
            {employeeData.position || 'Empleado'}
          </p>
        </div>

        {/* Details - Compact */}
        <div className="space-y-1 text-[11px] mt-4">
          <div className="flex justify-between items-center py-0.5">
            <span className="text-gray-500 font-medium">Empleado #</span>
            <span className="font-semibold text-gray-900 text-[12px]">
              {employeeData.employee_code || employeeData.id}
            </span>
          </div>
          <div className="h-px w-full bg-gray-200"></div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-gray-500 font-medium">Departamento</span>
            <span className="font-semibold text-gray-900 text-[10px]">
              {employeeData.departamento || 'N/A'}
            </span>
          </div>
          <div className="h-px w-full bg-gray-200"></div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-gray-500 font-medium">Ingreso</span>
            <span className="font-semibold text-gray-900 text-[10px]">
              {employeeData.hire_date ? new Date(employeeData.hire_date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
            </span>
          </div>
          {employeeData.imss_number && (
            <>
              <div className="h-px w-full bg-gray-200"></div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 font-medium">IMSS</span>
                <span className="font-mono font-semibold text-gray-900 text-[10px]">
                  {employeeData.imss_number}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom logo strip + footer using CSS shapes (html2canvas compatible) */}
      <div className="absolute bottom-0 left-0 w-full" style={{ height: '80px' }}>
        {/* Bottom logo area */}
        <div className="bg-white w-full flex items-center justify-center px-4" style={{ height: '68px' }}>
          <div className="max-w-[280px] h-[56px] flex items-center justify-center">
            <img src="/logo.png" alt="DC CONCRETOS" className="h-full w-auto block" />
          </div>
        </div>
        {/* Base blue bar */}
        <div className="absolute left-0 right-0 bottom-0" style={{ height: '16px', backgroundColor: BRAND_DARK_BLUE, zIndex: 1 }} />
        {/* Green left rectangle */}
        <div 
          className="absolute bottom-0 left-0" 
          style={{ 
            width: '135px', 
            height: '16px', 
            backgroundColor: BRAND_GREEN,
            zIndex: 2
          }} 
        />
        {/* Green triangle for diagonal */}
        <div 
          className="absolute bottom-0" 
          style={{ 
            left: '135px',
            width: 0,
            height: 0,
            borderLeft: '20px solid ' + BRAND_GREEN,
            borderTop: '16px solid transparent',
            zIndex: 2
          }} 
        />
      </div>
    </div>
    )
  };

  const CredentialCardBack = () => {
    const credentials = getSystemCredentials();
    
    return (
      <div className="w-[300px] h-[468px] bg-white rounded-lg shadow-lg overflow-hidden border-2 border-gray-200 print-card relative">
        {/* Top dark blue bar */}
        <div style={{ height: '12px', backgroundColor: BRAND_DARK_BLUE }} className="absolute inset-x-0 top-0 z-10" />

        {/* Header spacer (removed top logo) */}
        <div className="bg-gray-50 h-[16px] w-full" />

        {/* Employee Personal Information - Compact */}
        <div className="p-5 pb-24" style={{ marginTop: '20px' }}>{/* extra bottom padding to avoid overlapping enlarged footer/logo */}
          <div className="p-0 mb-2">
            <h3 className="font-semibold text-gray-800 text-[10px] mb-1 uppercase tracking-wider text-center">
              INFORMACIÓN PERSONAL
            </h3>
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-gray-500 font-medium">Correo</span>
                  <span className="text-gray-900 text-[10px] max-w-[200px] break-all whitespace-normal text-right">
                    {employeeData.email || 'N/A'}
                  </span>
                </div>
              {employeeData.telefono && (
                <>
                  <div className="h-px w-full bg-gray-200"></div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-gray-500 font-medium">Teléfono</span>
                    <span className="text-gray-900 text-[10px]">{employeeData.telefono}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* System Access - Compact */}
          <div className="mb-2">
            <h3 className="font-semibold text-gray-800 text-[10px] mb-1 uppercase tracking-wider text-center">
              ACCESO AL SISTEMA
            </h3>
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 font-medium">Código de Acceso</span>
                <span className="text-gray-900 text-[10px]">{credentials.accessPassword}</span>
              </div>
            </div>
          </div>

          {/* Emergency Contact - Compact */}
          <div className="mb-2">
            <h3 className="font-semibold text-gray-800 text-[10px] mb-1 uppercase tracking-wider text-center">
              CONTACTO DE EMERGENCIA
            </h3>
            {employeeData.emergency_contact ? (
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-gray-500 font-medium">Teléfono</span>
                  <span className="text-gray-900 text-[10px]">{employeeData.emergency_contact.phone}</span>
                </div>
                <div className="h-px w-full bg-gray-200"></div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-gray-500 font-medium">Contacto</span>
                  <span className="font-semibold text-gray-900 text-[10px]">
                    {employeeData.emergency_contact.name}
                    {employeeData.emergency_contact.relationship ? ` (${employeeData.emergency_contact.relationship})` : ''}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-gray-500 text-center">No registrado</div>
            )}
          </div>

          {/* Company Contact - Compact */}
          <div>
            <h3 className="font-semibold text-gray-800 text-[10px] mb-1 uppercase tracking-wider text-center">
              CONTACTO DE LA EMPRESA
            </h3>
            <div className="space-y-0.5 text-[11px]">
              <div className="py-0.5">
                <div className="flex justify-between items-start">
                  <span className="text-gray-500 font-medium">Dirección</span>
                  <span className="text-gray-900 text-[10px] text-right max-w-[200px] leading-snug">
                    {officeInfo.address}
                  </span>
                </div>
              </div>
              <div className="h-px w-full bg-gray-200"></div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 font-medium">Correo</span>
                <span className="text-gray-900 text-[10px] max-w-[200px] break-all whitespace-normal text-right">{officeInfo.email}</span>
              </div>
              <div className="h-px w-full bg-gray-200"></div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 font-medium">Teléfono</span>
                <span className="text-gray-900 text-[10px]">{officeInfo.phone} (Oficina)</span>
              </div>
              <div className="h-px w-full bg-gray-200"></div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 font-medium">RH</span>
                <span className="text-gray-900 text-[10px]">{officeInfo.hr_phone}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom logo strip + footer using CSS shapes (html2canvas compatible) */}
        <div className="absolute bottom-0 left-0 w-full" style={{ height: '80px' }}>
          {/* Bottom logo area */}
          <div className="bg-white w-full flex items-center justify-center px-4" style={{ height: '68px' }}>
            <div className="max-w-[220px] h-[44px] flex items-center justify-center">
              <img src="/logo.png" alt="DC CONCRETOS" className="h-full w-auto block" />
            </div>
          </div>
          {/* Base blue bar - same thickness as green */}
          <div className="absolute left-0 right-0 bottom-0" style={{ height: '16px', backgroundColor: BRAND_DARK_BLUE, zIndex: 1 }} />
          {/* Green left rectangle */}
          <div 
            className="absolute bottom-0 left-0" 
            style={{ 
              width: '148px', 
              height: '16px', 
              backgroundColor: BRAND_GREEN,
              zIndex: 2
            }} 
          />
          {/* Green triangle for diagonal */}
          <div 
            className="absolute bottom-0" 
            style={{ 
              left: '148px',
              width: 0,
              height: 0,
              borderLeft: '25px solid ' + BRAND_GREEN,
              borderBottom: '16px solid transparent',
              zIndex: 2
            }} 
          />
        </div>
        
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Screen + print adjustments */}
      <style jsx global>{`
        @media screen {
          .print-card { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); }
        }
        /* Force stacking context for print-card */
        .print-card { position: relative; }
      `}</style>

      {/* View Toggle */}
      <div className="flex justify-center print:hidden">
        <div className="bg-white rounded-lg p-1 shadow-sm border inline-flex">
          <button
            onClick={() => setCurrentView('front')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              currentView === 'front'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {showBoth ? 'Lado Frontal' : 'Solo Frente'}
          </button>
          <button
            onClick={() => setCurrentView('back')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              currentView === 'back'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Lado Posterior
          </button>
        </div>
      </div>

      {/* Credential Preview */}
      <div className="flex justify-center items-start gap-8">
        {showBoth ? (
          <>
            <div>
              <h3 className="text-sm font-medium text-green-600 mb-4 text-center print:hidden">LADO FRONTAL</h3>
              <CredentialCardFront />
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-600 mb-4 text-center print:hidden">LADO POSTERIOR</h3>
              <CredentialCardBack />
            </div>
          </>
        ) : (
          <div>
            <h3 className="text-sm font-medium text-center mb-4 text-gray-600 print:hidden">
              {currentView === 'front' ? 'Vista Previa de Credencial' : 'Información Adicional'}
            </h3>
            {currentView === 'front' ? <CredentialCardFront /> : <CredentialCardBack />}
          </div>
        )}
      </div>
    </div>
  );
}