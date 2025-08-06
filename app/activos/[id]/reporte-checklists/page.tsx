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
    // Hide navigation elements on mount for clean print view
    const hideNavigation = () => {
      const navigationElements = document.querySelectorAll('nav, header, .sidebar, .navigation, .nav, .header, [role="navigation"], [role="banner"], .navbar, .menu, .breadcrumb, .breadcrumbs')
      navigationElements.forEach(el => {
        const element = el as HTMLElement
        element.style.display = 'none'
      })
    }
    
    // Hide immediately and after a short delay to catch dynamically loaded nav
    hideNavigation()
    const timer = setTimeout(hideNavigation, 100)
    
    return () => {
      clearTimeout(timer)
      // Restore navigation on unmount
      const navigationElements = document.querySelectorAll('nav, header, .sidebar, .navigation, .nav, .header, [role="navigation"], [role="banner"], .navbar, .menu, .breadcrumb, .breadcrumbs')
      navigationElements.forEach(el => {
        const element = el as HTMLElement
        element.style.display = ''
      })
    }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <AssetChecklistEvidenceReport 
        assetId={assetId} 
        onClose={() => router.back()}
      />
    </div>
  )
}