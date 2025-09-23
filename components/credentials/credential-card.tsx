"use client"

import { useState } from 'react'
import { User, Phone, Shield, Calendar, CreditCard, Key, QrCode, Building2, Mail, MapPin } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
// Removed UserProfile import as we're now using our own interface

interface CredentialCardProps {
  employeeData: {
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
  };
  showBoth?: boolean;
  companyInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
}

const defaultCompanyInfo = {
  name: "DC CONCRETOS",
  address: "Calle Caracas #12428 Fracc. El Paraíso, C.P. 22106",
  phone: "664 905 1813",
  email: "rh.tj@dcconcretos.com.mx"
}

// Brand palette
const BRAND_DARK_BLUE = '#1f3a5c'
const BRAND_GREEN = '#21b163'

export function CredentialCard({ 
  employeeData, 
  showBoth = false, 
  companyInfo = defaultCompanyInfo 
}: CredentialCardProps) {
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');

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
      {/* Top thin dark blue bar */}
      <div style={{ height: '4px', backgroundColor: BRAND_DARK_BLUE }} className="absolute inset-x-0 top-0 z-10" />

      {/* Header Section - Professional */}
      <div className="bg-gray-50 h-[70px] flex flex-col items-center justify-center px-4 pt-4 pb-2">
        <div className="max-w-[180px] h-[36px] flex items-center justify-center">
          <img
            src="/logo.png"
            alt="DC CONCRETOS"
            className="h-full w-auto block"
          />
        </div>
        <div className="h-px w-full bg-gray-200 mt-2"></div>
      </div>

      {/* Professional Photo Section */}
      <div className="flex justify-center py-6">
        <div className="w-28 h-28 rounded-full bg-gray-50 flex items-center justify-center overflow-hidden" style={{ borderWidth: 4, borderColor: BRAND_DARK_BLUE }}>
          {employeeData.avatar_url ? (
            <img
              src={employeeData.avatar_url}
              alt={`${employeeData.nombre} ${employeeData.apellido}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={40} className="text-gray-300" />
          )}
        </div>
      </div>
      
      {/* Employee Information - Executive Style */}
      <div className="px-6 pb-14">{/* extra bottom padding to avoid overlapping footer */}
        {/* Name Section */}
        <div className="text-center space-y-1 pt-4">
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
            <span className="text-gray-500 font-medium label-inline"><Shield size={12} className="text-gray-400 icon-inline" /> Cargo</span>
            <span className="font-semibold text-gray-900 text-[10px]">
              {employeeData.position || 'Empleado'}
            </span>
          </div>
          <div className="h-px w-full bg-gray-200"></div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-gray-500 font-medium label-inline"><Calendar size={12} className="text-gray-400 icon-inline" /> Ingreso</span>
            <span className="font-semibold text-gray-900 text-[10px]">
              {employeeData.hire_date ? new Date(employeeData.hire_date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
            </span>
          </div>
          {employeeData.imss_number && (
            <>
              <div className="h-px w-full bg-gray-200"></div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 font-medium label-inline"><CreditCard size={12} className="text-gray-400 icon-inline" /> IMSS</span>
                <span className="font-mono font-semibold text-gray-900 text-[10px]">
                  {employeeData.imss_number}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom footer using CSS shapes (html2canvas compatible) */}
      <div className="absolute bottom-0 left-0 w-full" style={{ height: '12px' }}>
        {/* Base blue bar */}
        <div className="absolute inset-0" style={{ backgroundColor: BRAND_DARK_BLUE, zIndex: 1 }} />
        {/* Green left rectangle */}
        <div 
          className="absolute bottom-0 left-0" 
          style={{ 
            width: '135px', 
            height: '12px', 
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
            borderTop: '12px solid transparent',
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
        {/* Top thin dark blue bar */}
        <div style={{ height: '4px', backgroundColor: BRAND_DARK_BLUE }} className="absolute inset-x-0 top-0 z-10" />

        {/* Header with Logo */}
        <div className="bg-gray-50 h-[50px] flex flex-col items-center justify-center px-4 pt-4 pb-2">
          <div className="max-w-[180px] h-[32px] flex items-center justify-center">
            <img
              src="/logo.png"
              alt="DC CONCRETOS"
              className="h-full w-auto block"
            />
          </div>
          <div className="h-px w-full bg-gray-200 mt-2"></div>
        </div>

        {/* Employee Personal Information - Compact */}
        <div className="px-6 py-2 pb-14">{/* extra bottom padding */}
          <div className="p-0 mb-2">
            <h3 className="font-semibold text-gray-800 text-[10px] mb-1.5 uppercase tracking-wider text-center">
              INFORMACIÓN PERSONAL
            </h3>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 font-medium label-inline"><Mail size={12} className="text-gray-400 icon-inline" /> Correo</span>
                <span className="text-gray-900 text-[10px] max-w-[200px] break-all whitespace-normal text-right">
                  {employeeData.email || 'N/A'}
                </span>
              </div>
              {employeeData.telefono && (
                <>
                  <div className="h-px w-full bg-gray-200"></div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-gray-500 font-medium label-inline"><Phone size={12} className="text-gray-400 icon-inline" /> Teléfono</span>
                    <span className="text-gray-900 text-[10px]">{employeeData.telefono}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* System Access - Compact */}
          <div className="mb-2">
            <h3 className="font-semibold text-gray-800 text-[10px] mb-1.5 uppercase tracking-wider text-center">
              ACCESO AL SISTEMA
            </h3>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 font-medium label-inline"><Key size={12} className="text-gray-400 icon-inline" /> Código de Acceso</span>
                <span className="text-gray-900 text-[10px]">{credentials.accessPassword}</span>
              </div>
            </div>
          </div>

          {/* Emergency Contact - Compact */}
          <div className="mb-2">
            <h3 className="font-semibold text-gray-800 text-[10px] mb-1.5 uppercase tracking-wider text-center">
              CONTACTO DE EMERGENCIA
            </h3>
            {employeeData.emergency_contact ? (
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-gray-500 font-medium label-inline"><Phone size={12} className="text-gray-400 icon-inline" /> Teléfono</span>
                  <span className="text-gray-900 text-[10px]">{employeeData.emergency_contact.phone}</span>
                </div>
                <div className="h-px w-full bg-gray-200"></div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-gray-500 font-medium label-inline"><User size={12} className="text-gray-400 icon-inline" /> Contacto</span>
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
            <h3 className="font-semibold text-gray-800 text-[10px] mb-1.5 uppercase tracking-wider text-center">
              CONTACTO DE LA EMPRESA
            </h3>
            <div className="space-y-1 text-[11px]">
              <div className="py-0.5">
                <div className="flex justify-between items-start">
                  <span className="text-gray-500 font-medium label-inline"><MapPin size={12} className="text-gray-400 icon-inline" /> Dirección</span>
                  <span className="text-gray-900 text-[10px] text-right max-w-[200px] leading-snug">
                    Calle Caracas #12428, El Paraíso 22106
                  </span>
                </div>
              </div>
              <div className="h-px w-full bg-gray-200"></div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 font-medium label-inline"><Mail size={12} className="text-gray-400 icon-inline" /> Correo</span>
                <span className="text-gray-900 text-[10px] max-w-[200px] break-all whitespace-normal text-right">rh.tj@dcconcretos.com.mx</span>
              </div>
              <div className="h-px w-full bg-gray-200"></div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 font-medium label-inline"><Phone size={12} className="text-gray-400 icon-inline" /> Teléfono</span>
                <span className="text-gray-900 text-[10px]">664 905 1813 (Oficina)</span>
              </div>
              <div className="h-px w-full bg-gray-200"></div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 font-medium label-inline"><Phone size={12} className="text-gray-400 icon-inline" /> RH</span>
                <span className="text-gray-900 text-[10px]">477 288 0120</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom footer using CSS shapes (html2canvas compatible) */}
        <div className="absolute bottom-0 left-0 w-full" style={{ height: '12px' }}>
          {/* Base blue bar */}
          <div className="absolute inset-0" style={{ backgroundColor: BRAND_DARK_BLUE, zIndex: 1 }} />
          {/* Green left rectangle */}
          <div 
            className="absolute bottom-0 left-0" 
            style={{ 
              width: '150px', 
              height: '12px', 
              backgroundColor: BRAND_GREEN,
              zIndex: 2
            }} 
          />
          {/* Green triangle for diagonal */}
          <div 
            className="absolute bottom-0" 
            style={{ 
              left: '150px',
              width: 0,
              height: 0,
              borderLeft: '25px solid ' + BRAND_GREEN,
              borderBottom: '12px solid transparent',
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
        /* Force consistent baseline and icon alignment during html2canvas/print */
        .label-inline { display: inline-flex; align-items: center; gap: 4px; line-height: 1; position: relative; z-index: 2; overflow: visible; }
        .icon-inline { vertical-align: middle; position: relative; top: 1px; display: inline-block; z-index: 3; }
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