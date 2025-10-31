"use client"

import { AssetChecklistEvidenceReport } from "@/components/assets/asset-checklist-evidence-report"
import { useRouter } from "next/navigation"
import { useEffect, use } from "react"

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ReporteChecklistsPage({ params }: PageProps) {
  const router = useRouter()
  
  // Unwrap params using React.use()
  const resolvedParams = use(params)
  const assetId = resolvedParams.id
  
  useEffect(() => {
    // Minimal print styles - only hide sidebar, preserve ALL formatting
    const styleId = 'reporte-checklists-page-print-styles'
    if (document.getElementById(styleId)) {
      return
    }
    
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @media print {
        /* Hide sidebar and navigation */
        aside,
        nav,
        header:not(.print-header),
        [role="navigation"],
        [role="banner"],
        .breadcrumb,
        .breadcrumbs,
        .print\\:hidden {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Page margins */
        @page {
          margin: 1cm;
        }
        
        /* Prevent horizontal overflow */
        html,
        body {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow-x: hidden !important;
          overflow-y: visible !important;
        }
        
        /* Fix layout containers */
        body > div,
        body > div > div {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Flex container - remove sidebar space */
        div[class*="flex"][class*="min-h-screen"] {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        
        /* Sidebar zero space */
        aside {
          display: none !important;
          width: 0 !important;
          flex: 0 0 0 !important;
        }
        
        /* Main content wrapper */
        div.flex.flex-1 {
          width: 100% !important;
          max-width: 100% !important;
        }
        
        /* Main content */
        main {
          width: 100% !important;
          max-width: 100% !important;
        }
        
        /* Prevent horizontal overflow on containers */
        div, section, article {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
      }
    `
    document.head.appendChild(style)
    
    return () => {
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        document.head.removeChild(existingStyle)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-white print:w-full print:m-0 print:p-0">
      <AssetChecklistEvidenceReport 
        assetId={assetId} 
        onClose={() => router.back()}
      />
    </div>
  )
}