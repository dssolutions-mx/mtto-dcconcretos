"use client"

import { AssetProductionReport } from "@/components/assets/asset-production-report"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ReporteProduccionPage({ params }: PageProps) {
  const router = useRouter()
  
  useEffect(() => {
    // Hide navigation elements on mount
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
      <AssetProductionReport 
        assetId={(params as any).id} 
        onClose={() => router.back()}
      />
    </div>
  )
} 