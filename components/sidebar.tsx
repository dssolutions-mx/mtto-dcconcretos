"use client"

import React from "react"
import { useState, useEffect } from "react"

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
  Wrench,
  Activity,
  DollarSign,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react"
import { UserNav } from "@/components/user-nav"
import { ModeToggle } from "@/components/mode-toggle"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  onLinkClick?: () => void
}

export function Sidebar({ className, onLinkClick }: SidebarProps) {
  const pathname = usePathname()
  const [equipmentOpen, setEquipmentOpen] = useState(true)
  const [operationsOpen, setOperationsOpen] = useState(true)
  const [procurementOpen, setProcurementOpen] = useState(true)
  const [recordsOpen, setRecordsOpen] = useState(true)

  const handleLinkClick = () => {
    if (onLinkClick) {
      onLinkClick()
    }
  }

  const isPathActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + "/")
  }

  return (
    <div className={cn("pb-12", className)}>
      <div className="space-y-4 py-4">
        {/* Dashboard */}
        <div className="px-4 py-2">
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
          </div>
        </div>

        {/* Equipment Section */}
        <div className="px-4">
          <Collapsible open={equipmentOpen} onOpenChange={setEquipmentOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-2 h-auto font-medium"
              >
                <div className="flex items-center">
                  <Wrench className="mr-2 h-4 w-4" />
                  Equipos
                </div>
                {equipmentOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              <Button
                variant={isPathActive("/modelos") ? "secondary" : "ghost"}
                className="w-full justify-start pl-8"
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/modelos">
                  <Settings className="mr-2 h-4 w-4" />
                  Modelos
                </Link>
              </Button>
              <Button
                variant={isPathActive("/activos") ? "secondary" : "ghost"}
                className="w-full justify-start pl-8"
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/activos">
                  <Package className="mr-2 h-4 w-4" />
                  Activos
                </Link>
              </Button>
              <Button
                variant={isPathActive("/preventivo") ? "secondary" : "ghost"}
                className="w-full justify-start pl-8"
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/preventivo">
                  <Activity className="mr-2 h-4 w-4" />
                  Mantenimiento Preventivo
                </Link>
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Operations Section */}
        <div className="px-4">
          <Collapsible open={operationsOpen} onOpenChange={setOperationsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-2 h-auto font-medium"
              >
                <div className="flex items-center">
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Operaciones
                </div>
                {operationsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              <Button
                variant={isPathActive("/checklists") ? "secondary" : "ghost"}
                className="w-full justify-start pl-8"
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/checklists">
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Checklists
                </Link>
              </Button>
              <Button
                variant={isPathActive("/ordenes") ? "secondary" : "ghost"}
                className="w-full justify-start pl-8"
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/ordenes">
                  <Tool className="mr-2 h-4 w-4" />
                  Órdenes de Trabajo
                </Link>
              </Button>
              <Button
                variant={isPathActive("/calendario") ? "secondary" : "ghost"}
                className="w-full justify-start pl-8"
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/calendario">
                  <Calendar className="mr-2 h-4 w-4" />
                  Calendario
                </Link>
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Procurement Section */}
        <div className="px-4">
          <Collapsible open={procurementOpen} onOpenChange={setProcurementOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-2 h-auto font-medium"
              >
                <div className="flex items-center">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Compras
                </div>
                {procurementOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              <Button
                variant={isPathActive("/compras") ? "secondary" : "ghost"}
                className="w-full justify-start pl-8"
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/compras">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Órdenes de Compra
                </Link>
              </Button>
              <Button
                variant={isPathActive("/inventario") ? "secondary" : "ghost"}
                className="w-full justify-start pl-8"
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/inventario">
                  <Boxes className="mr-2 h-4 w-4" />
                  Inventario
                </Link>
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Records Section */}
        <div className="px-4">
          <Collapsible open={recordsOpen} onOpenChange={setRecordsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-2 h-auto font-medium"
              >
                <div className="flex items-center">
                  <FileText className="mr-2 h-4 w-4" />
                  Históricos
                </div>
                {recordsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              <Button
                variant={isPathActive("/servicios") ? "secondary" : "ghost"}
                className="w-full justify-start pl-8"
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/servicios">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Órdenes de Servicio
                </Link>
              </Button>
              <Button
                variant={isPathActive("/reportes") ? "secondary" : "ghost"}
                className="w-full justify-start pl-8"
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/reportes">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Reportes
                </Link>
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  )
}

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Skip auth pages
  if (pathname?.startsWith("/login") || pathname?.startsWith("/register")) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex md:flex-col border-r bg-gray-50/40 transition-all duration-300",
        isSidebarCollapsed ? "md:w-16" : "md:w-64"
      )}>
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Package className="h-6 w-6" />
              {!isSidebarCollapsed && <span>Mantenimiento</span>}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            >
              {isSidebarCollapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            {!isSidebarCollapsed && (
              <Sidebar 
                className="px-2" 
                onLinkClick={() => setIsMobileMenuOpen(false)} 
              />
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 lg:h-[60px] items-center gap-4 border-b bg-gray-50/40 px-4 lg:px-6">
          {/* Mobile Menu Button */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 w-64">
              <div className="flex h-14 items-center border-b px-4">
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                  <Package className="h-6 w-6" />
                  <span>Mantenimiento</span>
                </Link>
              </div>
              <div className="flex-1 overflow-auto">
                <Sidebar 
                  className="px-2" 
                  onLinkClick={() => setIsMobileMenuOpen(false)} 
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Breadcrumb */}
          <div className="flex-1">
            <BreadcrumbNav />
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-4">
            <ModeToggle />
            <UserNav />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
