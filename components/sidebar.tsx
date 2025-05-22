"use client"

import type React from "react"
import { useState } from "react"

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
  Menu,
  X,
} from "lucide-react"
import { UserNav } from "@/components/user-nav"
import { ModeToggle } from "@/components/mode-toggle"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  onLinkClick?: () => void
}

export function Sidebar({ className, onLinkClick }: SidebarProps) {
  const pathname = usePathname()

  const handleLinkClick = () => {
    if (onLinkClick) {
      onLinkClick()
    }
  }

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
              onClick={handleLinkClick}
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
              onClick={handleLinkClick}
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
              onClick={handleLinkClick}
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
              onClick={handleLinkClick}
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
              onClick={handleLinkClick}
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
              onClick={handleLinkClick}
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
              onClick={handleLinkClick}
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
              onClick={handleLinkClick}
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
              onClick={handleLinkClick}
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
              onClick={handleLinkClick}
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
            <Button 
              variant={pathname === "/reportes" ? "secondary" : "ghost"} 
              className="w-full justify-start" 
              asChild
              onClick={handleLinkClick}
            >
              <Link href="/reportes">
                <BarChart3 className="mr-2 h-4 w-4" />
                Reportes
              </Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={handleLinkClick}>
              <BarChart3 className="mr-2 h-4 w-4" />
              KPIs
            </Button>
          </div>
        </div>
        <div className="px-4 py-2">
          <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight">Configuración</h2>
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start" onClick={handleLinkClick}>
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={handleLinkClick}>
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
  const [isOpen, setIsOpen] = useState(false)

  const handleCloseMobileMenu = () => {
    setIsOpen(false)
  }

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
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 [&>button]:hidden" onInteractOutside={() => setIsOpen(false)}>
                <div className="flex h-16 items-center border-b px-4">
                  <Link href="/" className="flex items-center gap-2 font-semibold" onClick={() => setIsOpen(false)}>
                    <Truck className="h-6 w-6" />
                    <span className="">Mantenimiento</span>
                  </Link>
                  <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setIsOpen(false)}>
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close Menu</span>
                  </Button>
                </div>
                <div className="overflow-y-auto">
                  <Sidebar onLinkClick={handleCloseMobileMenu} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="md:hidden flex items-center ml-2">
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
