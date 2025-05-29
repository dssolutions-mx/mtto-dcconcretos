"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Home } from "lucide-react"

interface BreadcrumbNavProps {
  className?: string
}

interface BreadcrumbItemData {
  label: string
  href: string
  icon?: React.ReactNode
}

export function BreadcrumbNav({ className }: BreadcrumbNavProps) {
  const pathname = usePathname()

  // Skip breadcrumbs for auth pages
  if (pathname?.startsWith("/login") || pathname?.startsWith("/register")) {
    return null
  }

  const pathSegments = pathname.split("/").filter(Boolean)
  
  // Build breadcrumb items based on current navigation structure
  const getBreadcrumbItems = (): BreadcrumbItemData[] => {
    const items: BreadcrumbItemData[] = [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: <Home className="h-4 w-4" />
      }
    ]

    if (pathSegments.length === 0 || pathSegments[0] === "dashboard") {
      return items
    }

    const firstSegment = pathSegments[0]
    
    // Equipment section
    if (["modelos", "activos", "preventivo"].includes(firstSegment)) {
      items.push({
        label: "Equipos",
        href: "#"
      })
      
      if (firstSegment === "modelos") {
        items.push({
          label: "Modelos",
          href: "/modelos"
        })
      } else if (firstSegment === "activos") {
        items.push({
          label: "Activos",
          href: "/activos"
        })
      } else if (firstSegment === "preventivo") {
        items.push({
          label: "Mantenimiento Preventivo",
          href: "/preventivo"
        })
      }
    }
    // Operations section
    else if (["checklists", "ordenes", "calendario"].includes(firstSegment)) {
      items.push({
        label: "Operaciones",
        href: "#"
      })
      
      if (firstSegment === "checklists") {
        items.push({
          label: "Checklists",
          href: "/checklists"
        })
      } else if (firstSegment === "ordenes") {
        items.push({
          label: "Órdenes de Trabajo",
          href: "/ordenes"
        })
      } else if (firstSegment === "calendario") {
        items.push({
          label: "Calendario",
          href: "/calendario"
        })
      }
    }
    // Procurement section
    else if (["compras", "inventario"].includes(firstSegment)) {
      items.push({
        label: "Compras",
        href: "#"
      })
      
      if (firstSegment === "compras") {
        items.push({
          label: "Órdenes de Compra",
          href: "/compras"
        })
      } else if (firstSegment === "inventario") {
        items.push({
          label: "Inventario",
          href: "/inventario"
        })
      }
    }
    // Records section
    else if (["servicios", "reportes"].includes(firstSegment)) {
      items.push({
        label: "Históricos",
        href: "#"
      })
      
      if (firstSegment === "servicios") {
        items.push({
          label: "Órdenes de Servicio",
          href: "/servicios"
        })
      } else if (firstSegment === "reportes") {
        items.push({
          label: "Reportes",
          href: "/reportes"
        })
      }
    }

    // Add additional path segments for sub-pages
    if (pathSegments.length > 1) {
      const remainingSegments = pathSegments.slice(1)
      
      remainingSegments.forEach((segment, index) => {
        const segmentPath = "/" + pathSegments.slice(0, index + 2).join("/")
        
        // Handle specific sub-page labels
        let label = segment
        if (segment === "crear") label = "Crear"
        else if (segment === "editar") label = "Editar"
        else if (segment === "historial") label = "Historial"
        else if (segment === "incidentes") label = "Incidentes"
        else if (segment === "mantenimiento") label = "Mantenimiento"
        else if (segment === "completar") label = "Completar"
        else if (segment === "aprobar") label = "Aprobar"
        else if (segment === "rechazar") label = "Rechazar"
        else if (segment === "ejecutar") label = "Ejecutar"
        else if (segment === "programar") label = "Programar"
        else if (segment === "diarios") label = "Diarios"
        else if (segment === "semanales") label = "Semanales"
        else if (segment === "mensuales") label = "Mensuales"
        else if (segment === "completado") label = "Completado"
        
        items.push({
          label,
          href: segmentPath
        })
      })
    }

    return items
  }

  const breadcrumbItems = getBreadcrumbItems()

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <React.Fragment key={item.href}>
            <BreadcrumbItem>
              {index === breadcrumbItems.length - 1 ? (
                <BreadcrumbPage className="flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href} className="flex items-center gap-2">
                    {item.icon}
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {index < breadcrumbItems.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
} 