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
  Building2,
} from "lucide-react"
import { UserNav } from "@/components/user-nav"
import { ModeToggle } from "@/components/mode-toggle"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  onLinkClick?: () => void
}

// Enhanced Logo Component
function AppLogo({ isCollapsed = false, className }: { isCollapsed?: boolean; className?: string }) {
  return (
    <Link 
      href="/dashboard" 
      className={cn(
        "flex items-center gap-3 font-semibold transition-all duration-200 hover:opacity-80 group",
        className
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg text-primary-foreground group-hover:scale-105 transition-transform">
        <Building2 className="h-5 w-5" />
      </div>
      {!isCollapsed && (
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight">MantenPro</span>
          <span className="text-xs text-muted-foreground -mt-0.5">Sistema de Gestión</span>
        </div>
      )}
    </Link>
  )
}

// Enhanced Toggle Button
function SidebarToggle({ 
  isCollapsed, 
  onClick, 
  className 
}: { 
  isCollapsed: boolean; 
  onClick: () => void; 
  className?: string 
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-lg border-2 border-transparent hover:border-border/50 transition-all",
            "hover:bg-accent/50 focus-visible:border-primary/50",
            className
          )}
          onClick={onClick}
        >
          {isCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        <p>{isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar({ className, onLinkClick }: SidebarProps) {
  const pathname = usePathname()
  const [equipmentOpen, setEquipmentOpen] = useState(false)
  const [operationsOpen, setOperationsOpen] = useState(false)
  const [procurementOpen, setProcurementOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)

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
                variant={isPathActive("/incidentes") ? "secondary" : "ghost"}
                className="w-full justify-start pl-8"
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/incidentes">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Incidentes
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

// Enhanced Collapsed Sidebar with better tooltips
export function CollapsedSidebar({ className, onLinkClick }: SidebarProps) {
  const pathname = usePathname()

  const handleLinkClick = () => {
    if (onLinkClick) {
      onLinkClick()
    }
  }

  const isPathActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + "/")
  }

  const isSectionActive = (paths: string[]) => {
    return paths.some(path => isPathActive(path))
  }

  const navigationSections = [
    {
      id: "dashboard",
      icon: Home,
      label: "Dashboard",
      href: "/dashboard",
      active: pathname === "/dashboard"
    },
    {
      id: "equipment",
      icon: Wrench,
      label: "Equipos",
      active: isSectionActive(["/modelos", "/activos"]),
      items: [
        { href: "/modelos", icon: Settings, label: "Modelos", active: isPathActive("/modelos") },
        { href: "/activos", icon: Package, label: "Activos", active: isPathActive("/activos") }
      ]
    },
    {
      id: "operations",
      icon: ClipboardCheck,
      label: "Operaciones",
      active: isSectionActive(["/checklists", "/incidentes", "/ordenes", "/calendario"]),
      items: [
        { href: "/checklists", icon: ClipboardCheck, label: "Checklists", active: isPathActive("/checklists") },
        { href: "/incidentes", icon: AlertTriangle, label: "Incidentes", active: isPathActive("/incidentes") },
        { href: "/ordenes", icon: Tool, label: "Órdenes de Trabajo", active: isPathActive("/ordenes") },
        { href: "/calendario", icon: Calendar, label: "Calendario", active: isPathActive("/calendario") }
      ]
    },
    {
      id: "procurement",
      icon: ShoppingCart,
      label: "Compras",
      active: isSectionActive(["/compras", "/inventario"]),
      items: [
        { href: "/compras", icon: CreditCard, label: "Órdenes de Compra", active: isPathActive("/compras") },
        { href: "/inventario", icon: Boxes, label: "Inventario", active: isPathActive("/inventario") }
      ]
    },
    {
      id: "records",
      icon: FileText,
      label: "Históricos",
      active: isSectionActive(["/servicios", "/reportes"]),
      items: [
        { href: "/servicios", icon: CheckCircle, label: "Órdenes de Servicio", active: isPathActive("/servicios") },
        { href: "/reportes", icon: BarChart3, label: "Reportes", active: isPathActive("/reportes") }
      ]
    }
  ]

  return (
    <div className={cn("pb-12", className)}>
      <TooltipProvider>
        <div className="space-y-1 py-4">
          {navigationSections.map((section, index) => {
            const Icon = section.icon
            
            if (section.href) {
              return (
                <div key={section.id}>
                  <div className="px-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={section.active ? "secondary" : "ghost"}
                          size="icon"
                          className="w-10 h-10 mx-auto"
                          asChild
                          onClick={handleLinkClick}
                        >
                          <Link href={section.href}>
                            <Icon className="h-4 w-4" />
                            <span className="sr-only">{section.label}</span>
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={10}>
                        <p>{section.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="mx-4 my-2 border-b border-border"></div>
                </div>
              )
            }

            return (
              <div key={section.id}>
                <div className="px-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={section.active ? "secondary" : "ghost"}
                        size="icon"
                        className="w-10 h-10 mx-auto group relative"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="sr-only">{section.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="p-0" sideOffset={10}>
                      <div className="bg-background border rounded-md shadow-md py-1 min-w-[200px]">
                        <div className="px-3 py-2 text-sm font-medium text-muted-foreground border-b">
                          {section.label}
                        </div>
                        {section.items?.map((item) => {
                          const ItemIcon = item.icon
                          return (
                            <Button
                              key={item.href}
                              variant={item.active ? "secondary" : "ghost"}
                              className="w-full justify-start px-3 py-2 h-auto rounded-none"
                              asChild
                              onClick={handleLinkClick}
                            >
                              <Link href={item.href}>
                                <ItemIcon className="mr-2 h-4 w-4" />
                                {item.label}
                              </Link>
                            </Button>
                          )
                        })}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {index < navigationSections.length - 1 && (
                  <div className="mx-4 my-2 border-b border-border"></div>
                )}
              </div>
            )
          })}
        </div>
      </TooltipProvider>
    </div>
  )
}

// Enhanced Sidebar Wrapper with improved layout
export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false) // Start expanded for better UX

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  if (pathname?.startsWith("/login") || pathname?.startsWith("/register")) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex md:flex-col border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "md:w-16" : "md:w-64"
      )}>
        <div className="flex h-full max-h-screen flex-col">
          {/* Enhanced Header with better spacing */}
          <div className="flex h-16 items-center justify-between border-b px-4 lg:px-6">
            <AppLogo isCollapsed={isSidebarCollapsed} />
            <SidebarToggle 
              isCollapsed={isSidebarCollapsed}
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={cn(
                "transition-all duration-200",
                isSidebarCollapsed && "ml-0"
              )}
            />
          </div>
          
          {/* Navigation Content */}
          <div className="flex-1 overflow-auto">
            {isSidebarCollapsed ? (
              <CollapsedSidebar 
                className="px-1" 
                onLinkClick={() => setIsMobileMenuOpen(false)} 
              />
            ) : (
              <Sidebar 
                className="px-2" 
                onLinkClick={() => setIsMobileMenuOpen(false)} 
              />
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Enhanced Header */}
        <header className="flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          {/* Mobile Menu & Logo */}
          <div className="flex items-center gap-4 md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Abrir menú</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col p-0 w-64">
                <div className="flex h-16 items-center border-b px-4">
                  <AppLogo />
                </div>
                <div className="flex-1 overflow-auto">
                  <Sidebar 
                    className="px-2" 
                    onLinkClick={() => setIsMobileMenuOpen(false)} 
                  />
                </div>
              </SheetContent>
            </Sheet>
            <AppLogo className="md:hidden" />
          </div>

          {/* Breadcrumb - takes remaining space */}
          <div className="flex-1 min-w-0">
            <BreadcrumbNav />
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <ModeToggle />
            <UserNav />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
} 