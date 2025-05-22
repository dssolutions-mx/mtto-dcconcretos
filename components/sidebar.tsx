"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  BarChart3,
  Boxes,
  Calendar,
  ClipboardCheck,
  Home,
  Package,
  Settings,
  ShoppingCart,
  PenToolIcon as Tool,
  Truck,
  CreditCard,
  CheckCircle,
} from "lucide-react"
import { UserNav } from "@/components/user-nav"
import { ModeToggle } from "@/components/mode-toggle"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn("pb-12", className)}>
      <div className="space-y-4 py-4">
        <div className="px-4 py-2">
          <h2 className="mb-2 px-2 text-xl font-semibold tracking-tight">Mantenimiento</h2>
          <div className="space-y-1">
            <Button
              variant={pathname === "/dashboard" ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button
              variant={pathname === "/activos" || pathname.startsWith("/activos/") ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/activos">
                <Boxes className="mr-2 h-4 w-4" />
                Activos
              </Link>
            </Button>
            <Button
              variant={pathname === "/modelos" || pathname.startsWith("/modelos/") ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/modelos">
                <Package className="mr-2 h-4 w-4" />
                Modelos
              </Link>
            </Button>
            <Button
              variant={pathname === "/ordenes" || pathname.startsWith("/ordenes/") ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/ordenes">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Órdenes de Trabajo
              </Link>
            </Button>
            <Button
              variant={pathname === "/servicios" || pathname.startsWith("/servicios/") ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/servicios">
                <CheckCircle className="mr-2 h-4 w-4" />
                Órdenes de Servicio
              </Link>
            </Button>
            <Button
              variant={pathname === "/preventivo" || pathname.startsWith("/preventivo/") ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/preventivo">
                <Tool className="mr-2 h-4 w-4" />
                Mantenimiento Preventivo
              </Link>
            </Button>
            <Button
              variant={pathname === "/checklists" || pathname.startsWith("/checklists/") ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/checklists">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Checklists
              </Link>
            </Button>
            <Button
              variant={pathname === "/calendario" ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/calendario">
                <Calendar className="mr-2 h-4 w-4" />
                Calendario
              </Link>
            </Button>
            <Button
              variant={pathname === "/inventario" ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/inventario">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Inventario
              </Link>
            </Button>
            <Button
              variant={pathname === "/compras" || pathname.startsWith("/compras/") ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/compras">
                <CreditCard className="mr-2 h-4 w-4" />
                Compras
              </Link>
            </Button>
          </div>
        </div>
        <div className="px-4 py-2">
          <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight">Análisis</h2>
          <div className="space-y-1">
            <Button variant={pathname === "/reportes" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
              <Link href="/reportes">
                <BarChart3 className="mr-2 h-4 w-4" />
                Reportes
              </Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <BarChart3 className="mr-2 h-4 w-4" />
              KPIs
            </Button>
          </div>
        </div>
        <div className="px-4 py-2">
          <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight">Configuración</h2>
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Truck className="mr-2 h-4 w-4" />
              Proveedores
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthRoute = pathname?.startsWith("/login") || pathname?.startsWith("/register")

  if (isAuthRoute) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden border-r md:block w-64">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-16 items-center border-b px-4 lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Truck className="h-6 w-6" />
              <span className="">Mantenimiento</span>
            </Link>
            <div className="ml-auto flex items-center space-x-2">
              <UserNav />
            </div>
          </div>
          <div className="flex-1 overflow-auto py-2">
            <Sidebar className="px-4" />
          </div>
        </div>
      </div>
      <div className="flex flex-col w-full">
        <header className="sticky top-0 z-40 border-b bg-background">
          <div className="container flex h-16 items-center">
            <div className="md:hidden flex items-center">
              <Truck className="h-6 w-6 mr-2" />
              <span className="font-semibold">Mantenimiento</span>
            </div>
            <div className="flex flex-1 items-center justify-end space-x-4">
              <nav className="flex items-center space-x-2">
                <div className="md:hidden">
                  <UserNav />
                </div>
                <ModeToggle />
              </nav>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
