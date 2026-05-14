"use client"

import React from "react"
import { useState, useEffect } from "react"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { useSystemSettings } from "@/hooks/use-system-settings"
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
  CreditCard,
  Clock,
  Menu,
  X,
  Wrench,
  Activity,
  DollarSign,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Building2,
  Users,
  UserCheck,
  Sparkles,
  Shield,
  Fuel,
  Droplet,
  IdCard,
  Target,
} from "lucide-react"
import { UserNav } from "@/components/user-nav"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import type { ModulePermissions } from "@/lib/auth/role-permissions"
import {
  canAccessRHReportingNav,
  canManageUserAuthorizationClient,
} from "@/lib/auth/client-authorization"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  onLinkClick?: () => void
}

// Shared nav styles per Apple HIG: transitions, touch targets, reduced-motion support
const navItemClasses = "transition-colors duration-200 motion-reduce:transition-none"
const navSectionTriggerClasses = "font-semibold"

// Enhanced Logo Component that acts as toggle button
function AppLogo({ 
  isCollapsed = false, 
  className, 
  onClick 
}: { 
  isCollapsed?: boolean; 
  className?: string;
  onClick?: () => void;
}) {
  const LogoContent = () => (
    <div className={cn(
      "flex items-center gap-3 font-semibold transition-all duration-200 hover:opacity-80 group cursor-pointer",
      className
    )}>
      <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg text-primary-foreground group-hover:scale-105 transition-transform">
        <Building2 className="h-5 w-5" />
      </div>
      {!isCollapsed && (
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight">MantenPro</span>
          <span className="text-xs text-muted-foreground -mt-0.5">Sistema de Gestión</span>
        </div>
      )}
    </div>
  )

  if (onClick) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onClick} className="text-left">
            <LogoContent />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10} className="z-sidebar-tooltip">
          <p>{isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Link href="/dashboard">
      <LogoContent />
    </Link>
  )
}

export function Sidebar({ className, onLinkClick }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { profile, ui } = useAuthZustand()
  const { isComplianceSystemEnabled } = useSystemSettings()
  const [equipmentOpen, setEquipmentOpen] = useState(false)
  const operationsDefaultOpen = ['OPERADOR', 'DOSIFICADOR', 'COORDINADOR_MANTENIMIENTO', 'JEFE_PLANTA', 'GERENTE_MANTENIMIENTO', 'JEFE_UNIDAD_NEGOCIO'].includes(profile?.role || '')
  const [operationsOpen, setOperationsOpen] = useState(operationsDefaultOpen)
  const [procurementOpen, setProcurementOpen] = useState(profile?.role === 'AREA_ADMINISTRATIVA')
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [trabajosOpen, setTrabajosOpen] = useState(operationsDefaultOpen)
  const [organizationOpen, setOrganizationOpen] = useState(false)
  const [hrOpen, setHrOpen] = useState(false)
  const [complianceOpen, setComplianceOpen] = useState(false)

  // Auto-open procurement section for AREA_ADMINISTRATIVA
  useEffect(() => {
    if (profile?.role === 'AREA_ADMINISTRATIVA') {
      setProcurementOpen(true)
    }
  }, [profile])

  // Auto-open Operations section for roles that primarily use checklists (operators, coordinators, plant managers)
  useEffect(() => {
    if (['OPERADOR', 'DOSIFICADOR', 'COORDINADOR_MANTENIMIENTO', 'JEFE_PLANTA', 'GERENTE_MANTENIMIENTO', 'JEFE_UNIDAD_NEGOCIO'].includes(profile?.role || '')) {
      setOperationsOpen(true)
    }
  }, [profile])

  const handleLinkClick = () => {
    if (onLinkClick) {
      onLinkClick()
    }
  }

  const isPathActive = (path: string) => {
    // Special handling for /suppliers to avoid matching /suppliers/analytics
    if (path === "/suppliers") {
      return pathname === path || (pathname.startsWith(path + "/") && !pathname.startsWith("/suppliers/analytics"))
    }
    return pathname === path || pathname.startsWith(path + "/")
  }

  // Check if user is an operator (or dosificador — shared checklist/incident nav)
  const isOperator = profile?.role && ['OPERADOR', 'DOSIFICADOR'].includes(profile.role)

  // Return loading state if no profile yet
  if (!profile) {
    return (
      <div className={cn("pb-12", className)}>
        <div className="space-y-4 py-4">
          <div className="px-4 py-2">
            <div className="space-y-1">
              <Button
                variant="ghost"
                className="w-full justify-start"
                disabled
              >
                <Home className="mr-2 h-4 w-4" />
                Cargando...
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const dashboardHomeHref =
    profile.role === 'DOSIFICADOR'
      ? '/dashboard/dosificador'
      : profile.role === 'OPERADOR'
        ? '/dashboard/operator'
        : '/dashboard'
  const isDashboardNavActive =
    pathname === '/dashboard' ||
    pathname === '/dashboard/operator' ||
    pathname === '/dashboard/dosificador'

  /** HR Organización vs. asset-only: coordinador has personnel:none but assets:read_write — show section without HR links. */
  const showOrganizationNav =
    ui.shouldShowInNavigation('personnel') || ui.canShowEditButton('assets')

  return (
    <div className={cn("pb-12", className)} role="navigation" aria-label="Navegación principal">
      <div className="space-y-4 py-4" data-tour="sidebar" id="sidebar-nav">
        {/* Dashboard */}
        <div className="px-4 py-2" data-tour="sidebar-first-item">
          <div className="space-y-1">
            <Button
              variant={isDashboardNavActive ? "secondary" : "ghost"}
              className={cn("w-full justify-start", navItemClasses)}
              asChild
              onClick={handleLinkClick}
            >
              <Link href={dashboardHomeHref} aria-current={isDashboardNavActive ? "page" : undefined}>
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
        </div>

        {/* Personal Credential - Available to all users */}
        <div className="px-4 py-2">
          <div className="space-y-1">
            <Button
              variant={pathname === "/credencial" ? "secondary" : "ghost"}
              className={cn("w-full justify-start", navItemClasses)}
              asChild
              onClick={handleLinkClick}
            >
              <Link href="/credencial" aria-current={pathname === "/credencial" ? "page" : undefined}>
                <IdCard className="mr-2 h-4 w-4" />
                Mi Credencial
              </Link>
            </Button>
          </div>
        </div>

        {/* Simplified Navigation for Operators */}
        {isOperator && (
          <>
            {/* Checklists Section - Only section for operators */}
            <div className="px-4">
              <Collapsible open={operationsOpen} onOpenChange={setOperationsOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn("w-full justify-between p-2 h-auto", navSectionTriggerClasses, navItemClasses)}
                  >
                    <div className="flex items-center">
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      Mis Checklists
                    </div>
                    {operationsOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-2 transition-all duration-200 ease-in-out motion-reduce:transition-none">
                  <Button
                    variant={isPathActive("/checklists") ? "secondary" : "ghost"}
                    className={cn("w-full justify-start pl-8", navItemClasses)}
                    asChild
                    onClick={handleLinkClick}
                    data-tour="checklists-nav"
                  >
                    <Link href="/checklists">
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      Checklists
                    </Link>
                  </Button>
                  <Button
                    variant={pathname.startsWith("/dashboard/operator/incidentes") ? "secondary" : "ghost"}
                    className={cn("w-full justify-start pl-8", navItemClasses)}
                    asChild
                    onClick={handleLinkClick}
                  >
                    <Link
                      href="/dashboard/operator/incidentes?estado=abiertos"
                      aria-current={pathname.startsWith("/dashboard/operator/incidentes") ? "page" : undefined}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Incidentes del equipo
                    </Link>
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </>
        )}

        {/* For AREA_ADMINISTRATIVA: Show Procurement first, then Organization, then others */}
        {profile.role === 'AREA_ADMINISTRATIVA' ? (
          <>
            {/* Procurement Section - Priority for AREA_ADMINISTRATIVA */}
            {(ui.shouldShowInNavigation('purchases') || ui.shouldShowInNavigation('inventory')) && (
              <div className="px-4" data-tour="purchases-nav">
                <Collapsible open={procurementOpen} onOpenChange={setProcurementOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn("w-full justify-between p-2 h-auto", navSectionTriggerClasses, navItemClasses)}
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
                  <CollapsibleContent className="space-y-1 mt-2 transition-all duration-200 ease-in-out motion-reduce:transition-none">
                    {ui.shouldShowInNavigation('purchases') && (
                      <Button
                        variant={isPathActive("/compras") ? "secondary" : "ghost"}
                        className={cn("w-full justify-start pl-8", navItemClasses)}
                        asChild
                        onClick={handleLinkClick}
                      >
                        <Link href="/compras">
                          <CreditCard className="mr-2 h-4 w-4" />
                          Órdenes de Compra
                        </Link>
                      </Button>
                    )}
                    {ui.shouldShowInNavigation('inventory') && (
                      <Button
                        variant={isPathActive("/inventario") ? "secondary" : "ghost"}
                        className={cn("w-full justify-start pl-8", navItemClasses)}
                        asChild
                        onClick={handleLinkClick}
                        data-tour="warehouse-nav"
                      >
                        <Link href="/inventario">
                          <Boxes className="mr-2 h-4 w-4" />
                          Inventario
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant={isPathActive("/diesel") ? "secondary" : "ghost"}
                      className={cn("w-full justify-start pl-8", navItemClasses)}
                      asChild
                      onClick={handleLinkClick}
                    >
                      <Link href="/diesel">
                        <Fuel className="mr-2 h-4 w-4" />
                        Gestión de Diesel
                      </Link>
                    </Button>
                    <Button
                      variant={isPathActive("/urea") ? "secondary" : "ghost"}
                      className={cn("w-full justify-start pl-8", navItemClasses)}
                      asChild
                      onClick={handleLinkClick}
                    >
                      <Link href="/urea">
                        <Droplet className="mr-2 h-4 w-4" />
                        Gestión de UREA
                      </Link>
                    </Button>
                    <Button
                      variant={isPathActive("/suppliers") ? "secondary" : "ghost"}
                      className={cn("w-full justify-start pl-8", navItemClasses)}
                      asChild
                      onClick={handleLinkClick}
                    >
                      <Link href="/suppliers">
                        <Users className="mr-2 h-4 w-4" />
                        Padrón de Proveedores
                      </Link>
                    </Button>
                    <Button
                      variant={isPathActive("/suppliers/analytics") ? "secondary" : "ghost"}
                      className={cn("w-full justify-start pl-8", navItemClasses)}
                      asChild
                      onClick={handleLinkClick}
                    >
                      <Link href="/suppliers/analytics">
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Análisis de Proveedores
                      </Link>
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Organization Section */}
            {showOrganizationNav && (
              <div className="px-4">
                <Collapsible open={organizationOpen} onOpenChange={setOrganizationOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn("w-full justify-between p-2 h-auto", navSectionTriggerClasses, navItemClasses)}
                      data-tour="gestion-organizacional-nav"
                    >
                      <div className="flex items-center">
                        <Building2 className="mr-2 h-4 w-4" />
                        Organización
                      </div>
                      {organizationOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 mt-2 transition-all duration-200 ease-in-out motion-reduce:transition-none">
                    {ui.shouldShowInNavigation('personnel') && (
                      <>
                        <Button
                          variant={isPathActive("/gestion/asignaciones") ? "secondary" : "ghost"}
                          className="w-full justify-start pl-8 font-semibold"
                          asChild
                          onClick={handleLinkClick}
                          data-tour="asignaciones-organizacionales-nav"
                        >
                          <Link href="/gestion/asignaciones">
                            <Target className="mr-2 h-4 w-4" />
                            Asignaciones Organizacionales
                            <Badge variant="secondary" className="ml-auto text-xs">Nuevo</Badge>
                          </Link>
                        </Button>
                        <div className="pl-8 pt-1 pb-2">
                          <p className="text-xs text-gray-500 mb-2">Páginas individuales:</p>
                        </div>
                        <Button
                          variant={isPathActive("/gestion/personal") || isPathActive("/personal") ? "secondary" : "ghost"}
                          className={cn("w-full justify-start pl-8", navItemClasses)}
                          asChild
                          onClick={handleLinkClick}
                        >
                          <Link href="/gestion/personal">
                            <Users className="mr-2 h-4 w-4" />
                            Gestión de Personal
                          </Link>
                        </Button>
                      </>
                    )}
                    {(ui.canShowEditButton('assets') || profile.role === 'AREA_ADMINISTRATIVA') && (
                      <>
                        <Button
                          variant={isPathActive("/gestion/activos/asignacion-plantas") ? "secondary" : "ghost"}
                          className={cn("w-full justify-start pl-8", navItemClasses)}
                          asChild
                          onClick={handleLinkClick}
                        >
                          <Link href="/gestion/activos/asignacion-plantas">
                            <Package className="mr-2 h-4 w-4" />
                            Activos a Plantas
                          </Link>
                        </Button>
                        <Button
                          variant={isPathActive("/activos/asignacion") ? "secondary" : "ghost"}
                          className={cn("w-full justify-start pl-8", navItemClasses)}
                          asChild
                          onClick={handleLinkClick}
                        >
                          <Link href="/activos/asignacion">
                            <UserCheck className="mr-2 h-4 w-4" />
                            Asignación de Activos
                          </Link>
                        </Button>
                      </>
                    )}
                    {['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'].includes(profile.role) && (
                      <Button
                        variant={isPathActive("/plantas") ? "secondary" : "ghost"}
                        className={cn("w-full justify-start pl-8", navItemClasses)}
                        asChild
                        onClick={handleLinkClick}
                      >
                        <Link href="/plantas">
                          <Building2 className="mr-2 h-4 w-4" />
                          Configuración de Plantas
                        </Link>
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Equipment Section - Lower priority for AREA_ADMINISTRATIVA */}
            {(ui.shouldShowInNavigation('assets') || ui.shouldShowInNavigation('maintenance')) && (
              <div className="px-4">
                <Collapsible open={equipmentOpen} onOpenChange={setEquipmentOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn("w-full justify-between p-2 h-auto", navSectionTriggerClasses, navItemClasses)}
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
                  <CollapsibleContent className="space-y-1 mt-2 transition-all duration-200 ease-in-out motion-reduce:transition-none">
                    {ui.canShowCreateButton('maintenance') && (
                      <Button
                        variant={isPathActive("/modelos") ? "secondary" : "ghost"}
                        className={cn("w-full justify-start pl-8", navItemClasses)}
                        asChild
                        onClick={handleLinkClick}
                      >
                        <Link href="/modelos">
                          <Settings className="mr-2 h-4 w-4" />
                          Modelos
                        </Link>
                      </Button>
                    )}
                    {ui.shouldShowInNavigation('assets') && (
                      <Button
                        variant={isPathActive("/activos") ? "secondary" : "ghost"}
                        className={cn("w-full justify-start pl-8", navItemClasses)}
                        asChild
                        onClick={handleLinkClick}
                        data-tour="assets-nav"
                      >
                        <Link href="/activos">
                          <Package className="mr-2 h-4 w-4" />
                          Activos
                        </Link>
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Standard order for other roles */}
            {/* Equipment Section */}
            {(ui.shouldShowInNavigation('assets') || ui.shouldShowInNavigation('maintenance')) && (
              <div className="px-4">
                <Collapsible open={equipmentOpen} onOpenChange={setEquipmentOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn("w-full justify-between p-2 h-auto", navSectionTriggerClasses, navItemClasses)}
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
                  <CollapsibleContent className="space-y-1 mt-2 transition-all duration-200 ease-in-out motion-reduce:transition-none">
                    {ui.canShowCreateButton('maintenance') && (
                      <Button
                        variant={isPathActive("/modelos") ? "secondary" : "ghost"}
                        className={cn("w-full justify-start pl-8", navItemClasses)}
                        asChild
                        onClick={handleLinkClick}
                      >
                        <Link href="/modelos">
                          <Settings className="mr-2 h-4 w-4" />
                          Modelos
                        </Link>
                      </Button>
                    )}
                    {ui.shouldShowInNavigation('assets') && (
                      <Button
                        variant={isPathActive("/activos") ? "secondary" : "ghost"}
                        className={cn("w-full justify-start pl-8", navItemClasses)}
                        asChild
                        onClick={handleLinkClick}
                        data-tour="assets-nav"
                      >
                        <Link href="/activos">
                          <Package className="mr-2 h-4 w-4" />
                          Activos
                        </Link>
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Trabajos Section - groups OT (pendientes) and OS (ejecutados) */}
            {ui.shouldShowInNavigation('work_orders') && (
              <div className="px-4">
                <Collapsible open={trabajosOpen} onOpenChange={setTrabajosOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn("w-full justify-between p-2 h-auto", navSectionTriggerClasses, navItemClasses)}
                    >
                      <div className="flex items-center">
                        <Tool className="mr-2 h-4 w-4" />
                        Trabajos
                      </div>
                      {trabajosOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 mt-2 transition-all duration-200 ease-in-out motion-reduce:transition-none">
                    <Button
                      variant={isPathActive("/ordenes") ? "secondary" : "ghost"}
                      className={cn("w-full justify-start pl-8", navItemClasses)}
                      asChild
                      onClick={handleLinkClick}
                      data-tour="work-orders-nav"
                    >
                      <Link href="/ordenes">
                        <Clock className="mr-2 h-4 w-4" />
                        Órdenes de Trabajo
                      </Link>
                    </Button>
                    {ui.shouldShowInNavigation('maintenance') && (
                      <Button
                        variant={isPathActive("/incidentes") ? "secondary" : "ghost"}
                        className={cn("w-full justify-start pl-8", navItemClasses)}
                        asChild
                        onClick={handleLinkClick}
                      >
                        <Link href="/incidentes">
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          Incidentes
                        </Link>
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Operations Section - Checklists y Calendario */}
            {(ui.shouldShowInNavigation('checklists') || ui.shouldShowInNavigation('maintenance')) && (
              <div className="px-4">
                <Collapsible open={operationsOpen} onOpenChange={setOperationsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn("w-full justify-between p-2 h-auto", navSectionTriggerClasses, navItemClasses)}
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
                  <CollapsibleContent className="space-y-1 mt-2 transition-all duration-200 ease-in-out motion-reduce:transition-none">
                    {ui.shouldShowInNavigation('checklists') && (
                      <Button
                        variant={pathname === "/checklists" ? "secondary" : "ghost"}
                        className={cn("w-full justify-start pl-8", navItemClasses)}
                        asChild
                        onClick={handleLinkClick}
                        data-tour="checklists-nav"
                        id="checklists-nav-manager"
                      >
                        <Link href="/checklists">
                          <ClipboardCheck className="mr-2 h-4 w-4" />
                          Checklists
                        </Link>
                      </Button>
                    )}
                    {ui.shouldShowInNavigation('maintenance') && (
                      <Button
                        variant={isPathActive("/calendario") ? "secondary" : "ghost"}
                        className={cn("w-full justify-start pl-8", navItemClasses)}
                        asChild
                        onClick={handleLinkClick}
                      >
                        <Link href="/calendario">
                          <Calendar className="mr-2 h-4 w-4" />
                          Calendario
                        </Link>
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Procurement Section */}
            {(ui.shouldShowInNavigation('purchases') || ui.shouldShowInNavigation('inventory')) && (
              <div className="px-4">
                <Collapsible open={procurementOpen} onOpenChange={setProcurementOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn("w-full justify-between p-2 h-auto", navSectionTriggerClasses, navItemClasses)}
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
                  <CollapsibleContent className="space-y-1 mt-2 transition-all duration-200 ease-in-out motion-reduce:transition-none">
                    {ui.shouldShowInNavigation('purchases') && (
                      <Button
                        variant={isPathActive("/compras") ? "secondary" : "ghost"}
                        className={cn("w-full justify-start pl-8", navItemClasses)}
                        asChild
                        onClick={handleLinkClick}
                      >
                        <Link href="/compras">
                          <CreditCard className="mr-2 h-4 w-4" />
                          Órdenes de Compra
                        </Link>
                      </Button>
                    )}
                    {ui.shouldShowInNavigation('inventory') && (
                      <Button
                        variant={isPathActive("/inventario") ? "secondary" : "ghost"}
                        className={cn("w-full justify-start pl-8", navItemClasses)}
                        asChild
                        onClick={handleLinkClick}
                      >
                        <Link href="/inventario">
                          <Boxes className="mr-2 h-4 w-4" />
                          Inventario
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant={isPathActive("/diesel") ? "secondary" : "ghost"}
                      className={cn("w-full justify-start pl-8", navItemClasses)}
                      asChild
                      onClick={handleLinkClick}
                    >
                      <Link href="/diesel">
                        <Fuel className="mr-2 h-4 w-4" />
                        Gestión de Diesel
                      </Link>
                    </Button>
                    <Button
                      variant={isPathActive("/urea") ? "secondary" : "ghost"}
                      className={cn("w-full justify-start pl-8", navItemClasses)}
                      asChild
                      onClick={handleLinkClick}
                    >
                      <Link href="/urea">
                        <Droplet className="mr-2 h-4 w-4" />
                        Gestión de UREA
                      </Link>
                    </Button>
                    <Button
                      variant={isPathActive("/suppliers") ? "secondary" : "ghost"}
                      className={cn("w-full justify-start pl-8", navItemClasses)}
                      asChild
                      onClick={handleLinkClick}
                    >
                      <Link href="/suppliers">
                        <Users className="mr-2 h-4 w-4" />
                        Padrón de Proveedores
                      </Link>
                    </Button>
                    <Button
                      variant={isPathActive("/suppliers/analytics") ? "secondary" : "ghost"}
                      className={cn("w-full justify-start pl-8", navItemClasses)}
                      asChild
                      onClick={handleLinkClick}
                    >
                      <Link href="/suppliers/analytics">
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Análisis de Proveedores
                      </Link>
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </>
        )}



        {/* Records Section */}
        {ui.shouldShowInNavigation('reports') && (
          <div className="px-4">
            <Collapsible open={recordsOpen} onOpenChange={setRecordsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn("w-full justify-between p-2 h-auto", navSectionTriggerClasses, navItemClasses)}
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
              <CollapsibleContent className="space-y-1 mt-2 transition-all duration-200 ease-in-out motion-reduce:transition-none">
                <Button
                  variant={isReportesHubPathActive(pathname) ? "secondary" : "ghost"}
                  className={cn("w-full justify-start pl-8", navItemClasses)}
                  asChild
                  onClick={handleLinkClick}
                >
                  <Link href="/reportes">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Reportes
                  </Link>
                </Button>
                <Button
                  variant={isPathActive("/reportes/eficiencia-diesel") ? "secondary" : "ghost"}
                  className={cn("w-full justify-start pl-8", navItemClasses)}
                  asChild
                  onClick={handleLinkClick}
                >
                  <Link href="/reportes/eficiencia-diesel">
                    <Fuel className="mr-2 h-4 w-4" />
                    Eficiencia de Diesel
                  </Link>
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Organization Section */}
        {showOrganizationNav && (
          <div className="px-4">
            <Collapsible open={organizationOpen} onOpenChange={setOrganizationOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn("w-full justify-between p-2 h-auto", navSectionTriggerClasses, navItemClasses)}
                  data-tour="gestion-organizacional-nav"
                >
                  <div className="flex items-center">
                    <Building2 className="mr-2 h-4 w-4" />
                    Organización
                  </div>
                  {organizationOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-2 transition-all duration-200 ease-in-out motion-reduce:transition-none">
                {ui.shouldShowInNavigation('personnel') && (
                  <>
                    <Button
                      variant={isPathActive("/gestion/asignaciones") ? "secondary" : "ghost"}
                      className="w-full justify-start pl-8 font-semibold"
                      asChild
                      onClick={handleLinkClick}
                      data-tour="asignaciones-organizacionales-nav"
                    >
                      <Link href="/gestion/asignaciones">
                        <Target className="mr-2 h-4 w-4" />
                        Asignaciones Organizacionales
                        <Badge variant="secondary" className="ml-auto text-xs">Nuevo</Badge>
                      </Link>
                    </Button>
                    <div className="pl-8 pt-1 pb-2">
                      <p className="text-xs text-gray-500 mb-2">Páginas individuales:</p>
                    </div>
                    <Button
                      variant={isPathActive("/gestion/personal") || isPathActive("/personal") ? "secondary" : "ghost"}
                      className={cn("w-full justify-start pl-8", navItemClasses)}
                      asChild
                      onClick={handleLinkClick}
                    >
                      <Link href="/gestion/personal">
                        <Users className="mr-2 h-4 w-4" />
                        Gestión de Personal
                      </Link>
                    </Button>
                  </>
                )}
                {(ui.canShowEditButton('assets') || profile.role === 'AREA_ADMINISTRATIVA') && (
                  <>
                    <Button
                      variant={isPathActive("/gestion/activos/asignacion-plantas") ? "secondary" : "ghost"}
                      className={cn("w-full justify-start pl-8", navItemClasses)}
                      asChild
                      onClick={handleLinkClick}
                    >
                      <Link href="/gestion/activos/asignacion-plantas">
                        <Package className="mr-2 h-4 w-4" />
                        Activos a Plantas
                      </Link>
                    </Button>
                    <Button
                      variant={isPathActive("/activos/asignacion") ? "secondary" : "ghost"}
                      className={cn("w-full justify-start pl-8", navItemClasses)}
                      asChild
                      onClick={handleLinkClick}
                    >
                      <Link href="/activos/asignacion">
                        <UserCheck className="mr-2 h-4 w-4" />
                        Asignación de Activos
                      </Link>
                    </Button>
                  </>
                )}
                {['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'].includes(profile.role) && (
                  <Button
                    variant={isPathActive("/plantas") ? "secondary" : "ghost"}
                    className={cn("w-full justify-start pl-8", navItemClasses)}
                    asChild
                    onClick={handleLinkClick}
                  >
                    <Link href="/plantas">
                      <Building2 className="mr-2 h-4 w-4" />
                      Configuración de Plantas
                    </Link>
                  </Button>
                )}
                {canManageUserAuthorizationClient(profile) && (
                  <Button
                    variant={isPathActive("/gestion/autorizaciones") ? "secondary" : "ghost"}
                    className={cn("w-full justify-start pl-8", navItemClasses)}
                    asChild
                    onClick={handleLinkClick}
                  >
                    <Link href="/gestion/autorizaciones">
                      <Shield className="mr-2 h-4 w-4" />
                      Gestión de Autorizaciones
                    </Link>
                  </Button>
                )}
                {['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA', 'JEFE_UNIDAD_NEGOCIO'].includes(profile.role) && (
                  <Button
                    variant={isPathActive("/gestion/credenciales") ? "secondary" : "ghost"}
                    className={cn("w-full justify-start pl-8", navItemClasses)}
                    asChild
                    onClick={handleLinkClick}
                  >
                    <Link href="/gestion/credenciales">
                      <IdCard className="mr-2 h-4 w-4" />
                      Credenciales de Empleados
                    </Link>
                  </Button>
                )}
                {!isComplianceSystemEnabled && ['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'].includes(profile?.role || '') && (
                  <Button
                    variant={isPathActive("/compliance/configuracion") ? "secondary" : "ghost"}
                    className={cn("w-full justify-start pl-8", navItemClasses)}
                    asChild
                    onClick={handleLinkClick}
                  >
                    <Link href="/compliance/configuracion">
                      <Settings className="mr-2 h-4 w-4" />
                      Configuración del Sistema
                    </Link>
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* HR Section — reporting (RH + GG); not all personnel module users */}
        {canAccessRHReportingNav(profile) && (
        <div className="px-4" data-tour="rh-nav">
          <Collapsible open={hrOpen} onOpenChange={setHrOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className={cn("w-full justify-between p-2 h-auto", navSectionTriggerClasses, navItemClasses)}
              >
                <div className="flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  Recursos Humanos
                </div>
                {hrOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2 transition-all duration-200 ease-in-out motion-reduce:transition-none">
              <Button
                variant={isPathActive("/rh/limpieza") ? "secondary" : "ghost"}
                className={cn("w-full justify-start pl-8", navItemClasses)}
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/rh/limpieza">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Reportes de Limpieza
                </Link>
              </Button>
              <Button
                variant={isPathActive("/rh/cumplimiento-checklists") ? "secondary" : "ghost"}
                className={cn("w-full justify-start pl-8", navItemClasses)}
                asChild
                onClick={handleLinkClick}
              >
                <Link href="/rh/cumplimiento-checklists">
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Cumplimiento de Checklists
                </Link>
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
        )}

        {/* Compliance Section */}
        {isComplianceSystemEnabled && ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'AREA_ADMINISTRATIVA', 'GERENTE_MANTENIMIENTO', 'COORDINADOR_MANTENIMIENTO', 'RECURSOS_HUMANOS'].includes(profile?.role || '') && (
          <div className="px-4" data-tour="compliance-section" id="compliance-section">
            <Collapsible open={complianceOpen} onOpenChange={setComplianceOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn("w-full justify-between p-2 h-auto", navSectionTriggerClasses, navItemClasses)}
                >
                  <div className="flex items-center">
                    <Shield className="mr-2 h-4 w-4" />
                    Cumplimiento
                  </div>
                  {complianceOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-2 transition-all duration-200 ease-in-out motion-reduce:transition-none">
                <Button
                  variant={isPathActive("/compliance") ? "secondary" : "ghost"}
                  className={cn("w-full justify-start pl-8", navItemClasses)}
                  asChild
                  onClick={handleLinkClick}
                >
                  <Link href="/compliance">
                    <Shield className="mr-2 h-4 w-4" />
                    Dashboard de Cumplimiento
                  </Link>
                </Button>
                <Button
                  variant={isPathActive("/compliance/activos-olvidados") ? "secondary" : "ghost"}
                  className={cn("w-full justify-start pl-8", navItemClasses)}
                  asChild
                  onClick={handleLinkClick}
                  data-tour="forgotten-assets-link"
                >
                  <Link href="/compliance/activos-olvidados">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Activos Olvidados
                  </Link>
                </Button>
                <Button
                  variant={isPathActive("/compliance/incidentes") ? "secondary" : "ghost"}
                  className={cn("w-full justify-start pl-8", navItemClasses)}
                  asChild
                  onClick={handleLinkClick}
                >
                  <Link href="/compliance/incidentes">
                    <FileText className="mr-2 h-4 w-4" />
                    Incidentes
                  </Link>
                </Button>
                {['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'].includes(profile?.role || '') && (
                  <Button
                    variant={isPathActive("/compliance/configuracion") ? "secondary" : "ghost"}
                    className={cn("w-full justify-start pl-8", navItemClasses)}
                    asChild
                    onClick={handleLinkClick}
                  >
                    <Link href="/compliance/configuracion">
                      <Settings className="mr-2 h-4 w-4" />
                      Configuración
                    </Link>
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>
    </div>
  )
}

/** Main "Reportes" nav item: /reportes and /reportes/* except eficiencia-diesel (separate sibling link). */
function isReportesHubPathActive(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname.startsWith("/reportes/eficiencia-diesel")) return false
  return pathname === "/reportes" || pathname.startsWith("/reportes/")
}

// Shared navigation config builder - single source of truth for both Sidebar and CollapsedSidebar
type NavItem = { href: string; icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; badge?: string }
type NavSection = 
  | { id: string; icon: React.ComponentType<{ className?: string }>; label: string; href: string; active: boolean; items?: never }
  | { id: string; icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; items: NavItem[]; href?: never }

function buildNavigationSections(
  profile: { role?: string; business_role?: string | null },
  ui: {
    shouldShowInNavigation: (m: keyof ModulePermissions) => boolean
    canShowCreateButton?: (m: keyof ModulePermissions) => boolean
    canShowEditButton?: (m: keyof ModulePermissions) => boolean
  },
  pathname: string,
  isPathActive: (path: string) => boolean,
  isSectionActive: (paths: string[]) => boolean,
  isComplianceSystemEnabled: boolean
): NavSection[] {
  const sections: NavSection[] = [
    { id: "dashboard", icon: Home, label: "Dashboard", href: "/dashboard", active: pathname === "/dashboard" },
    { id: "credential", icon: IdCard, label: "Mi Credencial", href: "/credencial", active: pathname === "/credencial" },
  ]

  // Equipment - filtered by ui
  if (ui.shouldShowInNavigation('assets') || ui.shouldShowInNavigation('maintenance')) {
    const equipmentItems: NavItem[] = []
    if (ui.canShowCreateButton?.('maintenance')) {
      equipmentItems.push({ href: "/modelos", icon: Settings, label: "Modelos", active: isPathActive("/modelos") })
    }
    if (ui.shouldShowInNavigation('assets')) {
      equipmentItems.push({ href: "/activos", icon: Package, label: "Activos", active: isPathActive("/activos") })
    }
    if (equipmentItems.length > 0) {
      sections.push({
        id: "equipment",
        icon: Wrench,
        label: "Equipos",
        active: isSectionActive(["/modelos", "/activos"]),
        items: equipmentItems,
      })
    }
  }

  // Trabajos - work orders + incidentes (Incidentes relacionado con Órdenes de trabajo)
  if (ui.shouldShowInNavigation('work_orders') || ui.shouldShowInNavigation('maintenance')) {
    const trabajosItems: NavItem[] = []
    if (ui.shouldShowInNavigation('work_orders')) {
      trabajosItems.push(
        { href: "/ordenes", icon: Clock, label: "Órdenes de Trabajo", active: isPathActive("/ordenes") }
      )
    }
    if (ui.shouldShowInNavigation('maintenance')) {
      trabajosItems.push({ href: "/incidentes", icon: AlertTriangle, label: "Incidentes", active: isPathActive("/incidentes") })
    }
    if (trabajosItems.length > 0) {
      sections.push({
        id: "trabajos",
        icon: Tool,
        label: "Trabajos",
        active: isSectionActive(["/ordenes", "/incidentes"]),
        items: trabajosItems,
      })
    }
  }

  // Operaciones - solo Checklists y Calendario (sub-páginas de checklist se acceden desde el dashboard)
  if (ui.shouldShowInNavigation('checklists') || ui.shouldShowInNavigation('maintenance')) {
    const operationsItems: NavItem[] = []
    if (ui.shouldShowInNavigation('checklists')) {
      operationsItems.push({ href: "/checklists", icon: ClipboardCheck, label: "Checklists", active: isPathActive("/checklists") })
    }
    if (ui.shouldShowInNavigation('maintenance')) {
      operationsItems.push({ href: "/calendario", icon: Calendar, label: "Calendario", active: isPathActive("/calendario") })
    }
    if (operationsItems.length > 0) {
      sections.push({
        id: "operations",
        icon: ClipboardCheck,
        label: "Operaciones",
        active: isSectionActive(["/checklists", "/calendario"]),
        items: operationsItems,
      })
    }
  }

  // Procurement
  if (ui.shouldShowInNavigation('purchases') || ui.shouldShowInNavigation('inventory')) {
    const procurementItems: NavItem[] = []
    if (ui.shouldShowInNavigation('purchases')) {
      procurementItems.push({ href: "/compras", icon: CreditCard, label: "Órdenes de Compra", active: isPathActive("/compras") })
    }
    if (ui.shouldShowInNavigation('inventory')) {
      procurementItems.push({ href: "/inventario", icon: Boxes, label: "Inventario", active: isPathActive("/inventario") })
    }
    procurementItems.push(
      { href: "/diesel", icon: Fuel, label: "Gestión de Diesel", active: isPathActive("/diesel") },
      { href: "/urea", icon: Droplet, label: "Gestión de UREA", active: isPathActive("/urea") },
      { href: "/suppliers", icon: Users, label: "Padrón de Proveedores", active: isPathActive("/suppliers") },
      { href: "/suppliers/analytics", icon: BarChart3, label: "Análisis de Proveedores", active: isPathActive("/suppliers/analytics") }
    )
    sections.push({
      id: "procurement",
      icon: ShoppingCart,
      label: "Compras",
      active: isSectionActive(["/compras", "/inventario", "/diesel", "/urea", "/suppliers"]),
      items: procurementItems,
    })
  }

  // Records (Históricos)
  if (ui.shouldShowInNavigation('reports')) {
    sections.push({
      id: "records",
      icon: FileText,
      label: "Históricos",
      active: isSectionActive(["/reportes"]),
      items: [
        { href: "/reportes", icon: BarChart3, label: "Reportes", active: isReportesHubPathActive(pathname) },
        {
          href: "/reportes/eficiencia-diesel",
          icon: Fuel,
          label: "Eficiencia de Diesel",
          active: isPathActive("/reportes/eficiencia-diesel"),
        },
      ],
    })
  }

  // Organization (full HR when personnel module; asset links only when assets write without personnel — e.g. Coordinador)
  const showOrganizationSection =
    ui.shouldShowInNavigation('personnel') || Boolean(ui.canShowEditButton?.('assets'))

  if (showOrganizationSection) {
    const orgItems: NavItem[] = []
    if (ui.shouldShowInNavigation('personnel')) {
      orgItems.push(
        { href: "/gestion/asignaciones", icon: Target, label: "Asignaciones Organizacionales", active: isPathActive("/gestion/asignaciones"), badge: "Nuevo" },
        { href: "/gestion/personal", icon: Users, label: "Gestión de Personal", active: isPathActive("/gestion/personal") || isPathActive("/personal") }
      )
    }
    if (ui.canShowEditButton?.('assets') || profile.role === 'AREA_ADMINISTRATIVA') {
      orgItems.push(
        { href: "/gestion/activos/asignacion-plantas", icon: Package, label: "Activos a Plantas", active: isPathActive("/gestion/activos/asignacion-plantas") },
        { href: "/activos/asignacion", icon: UserCheck, label: "Asignación de Activos", active: isPathActive("/activos/asignacion") }
      )
    }
    if (['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'].includes(profile.role || '')) {
      orgItems.push({ href: "/plantas", icon: Building2, label: "Configuración de Plantas", active: isPathActive("/plantas") })
    }
    if (canManageUserAuthorizationClient(profile)) {
      orgItems.push({
        href: "/gestion/autorizaciones",
        icon: Shield,
        label: "Gestión de Autorizaciones",
        active: isPathActive("/gestion/autorizaciones"),
      })
    }
    if (['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA', 'JEFE_UNIDAD_NEGOCIO'].includes(profile.role || '')) {
      orgItems.push({
        href: "/gestion/credenciales",
        icon: IdCard,
        label: "Credenciales de Empleados",
        active: isPathActive("/gestion/credenciales"),
      })
    }
    sections.push({
      id: "organization",
      icon: Building2,
      label: "Organización",
      active: isSectionActive(["/gestion/asignaciones", "/gestion/personal", "/personal", "/activos/asignacion", "/gestion/activos/asignacion-plantas", "/plantas", "/gestion/autorizaciones", "/gestion/credenciales"]),
      items: orgItems,
    })
  }

  if (canAccessRHReportingNav(profile)) {
    sections.push({
      id: "hr",
      icon: Users,
      label: "Recursos Humanos",
      active: isSectionActive(["/rh/limpieza", "/rh/cumplimiento-checklists"]),
      items: [
        { href: "/rh/limpieza", icon: Sparkles, label: "Reportes de Limpieza", active: isPathActive("/rh/limpieza") },
        { href: "/rh/cumplimiento-checklists", icon: ClipboardCheck, label: "Cumplimiento de Checklists", active: isPathActive("/rh/cumplimiento-checklists") },
      ],
    })
  }

  // Compliance
  if (isComplianceSystemEnabled) {
    sections.push({
      id: "compliance",
      icon: Shield,
      label: "Cumplimiento",
      active: isSectionActive(["/compliance"]),
      items: [
        { href: "/compliance", icon: Shield, label: "Dashboard de Cumplimiento", active: isPathActive("/compliance") },
        { href: "/compliance/activos-olvidados", icon: AlertTriangle, label: "Activos Olvidados", active: isPathActive("/compliance/activos-olvidados") },
        { href: "/compliance/incidentes", icon: FileText, label: "Incidentes", active: isPathActive("/compliance/incidentes") },
      ],
    })
  }

  return sections
}

// Enhanced Collapsed Sidebar with better tooltips
export function CollapsedSidebar({ className, onLinkClick }: SidebarProps) {
  const pathname = usePathname()
  const { profile, ui } = useAuthZustand()
  const { isComplianceSystemEnabled } = useSystemSettings()
  const [openTooltips, setOpenTooltips] = useState<Record<string, boolean>>({})

  const handleLinkClick = () => {
    if (onLinkClick) {
      onLinkClick()
    }
  }

  const toggleTooltip = (sectionId: string) => {
    setOpenTooltips(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const isPathActive = (path: string) => {
    if (path === "/suppliers") {
      return pathname === path || (pathname.startsWith(path + "/") && !pathname.startsWith("/suppliers/analytics"))
    }
    return pathname === path || pathname.startsWith(path + "/")
  }

  const isSectionActive = (paths: string[]) => paths.some(path => isPathActive(path))

  if (!profile) {
    return (
      <div className={cn("pb-12", className)}>
        <div className="flex justify-center items-center h-32">
          <div className="text-xs text-muted-foreground">Cargando...</div>
        </div>
      </div>
    )
  }

  const isOperator = profile.role && ['OPERADOR', 'DOSIFICADOR'].includes(profile.role)

  // Build navigation from shared config with ui filtering
  let navigationSections: NavSection[]
  if (isOperator) {
    navigationSections = [
      { id: "checklists", icon: ClipboardCheck, label: "Mis Checklists", href: "/checklists", active: isPathActive("/checklists") },
      {
        id: "mis-reportes",
        icon: AlertTriangle,
        label: "Incidentes del equipo",
        href: "/dashboard/operator/incidentes?estado=abiertos",
        active: isPathActive("/dashboard/operator/incidentes"),
      },
    ]
  } else if (profile.role === 'AREA_ADMINISTRATIVA') {
    navigationSections = buildNavigationSections(profile, ui, pathname, isPathActive, isSectionActive, isComplianceSystemEnabled)
      .filter(section => section.id !== 'operations')
      .sort((a, b) => {
        if (a.id === 'dashboard') return -1
        if (b.id === 'dashboard') return 1
        if (a.id === 'credential') return -1
        if (b.id === 'credential') return 1
        if (a.id === 'procurement') return -1
        if (b.id === 'procurement') return 1
        if (a.id === 'organization') return -1
        if (b.id === 'organization') return 1
        return 0
      })
  } else {
    navigationSections = buildNavigationSections(profile, ui, pathname, isPathActive, isSectionActive, isComplianceSystemEnabled)
  }

  // Add Configuración del Sistema to Organization when compliance is hidden (for admins)
  const isAdmin = ['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'].includes(profile?.role || '')
  if (!isComplianceSystemEnabled && isAdmin) {
    navigationSections = navigationSections.map((section) => {
      if (section.id === 'organization' && section.items) {
        return {
          ...section,
          active: section.active || isPathActive('/compliance/configuracion'),
          items: [
            ...section.items,
            { href: '/compliance/configuracion', icon: Settings, label: 'Configuración del Sistema', active: isPathActive('/compliance/configuracion') }
          ]
        }
      }
      return section
    })
  }

  return (
    <div className={cn("pb-12", className)} role="navigation" aria-label="Navegación principal">
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
                          className={cn("w-11 h-11 min-w-[44px] min-h-[44px] mx-auto", navItemClasses)}
                          asChild
                          onClick={handleLinkClick}
                        >
                          <Link href={section.href} aria-current={section.active ? "page" : undefined}>
                            <Icon className="h-5 w-5" />
                            <span className="sr-only">{section.label}</span>
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={10} className="z-sidebar-tooltip">
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
                  <Tooltip 
                    open={openTooltips[section.id]} 
                    onOpenChange={(open) => setOpenTooltips(prev => ({ ...prev, [section.id]: open }))}
                    delayDuration={0}
                  >
                    <TooltipTrigger asChild>
                      <Button
                        variant={section.active ? "secondary" : "ghost"}
                        size="icon"
                        className={cn("w-11 h-11 min-w-[44px] min-h-[44px] mx-auto", navItemClasses)}
                        onClick={(e) => {
                          e.preventDefault()
                          toggleTooltip(section.id)
                        }}
                        onMouseEnter={() => {}} // Disable hover
                        onMouseLeave={() => {}} // Disable hover
                      >
                        <Icon className="h-5 w-5" />
                        <span className="sr-only">{section.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="right" 
                      className="p-0" 
                      sideOffset={10}
                      style={{ zIndex: 9999999 }}
                      onPointerDownOutside={() => setOpenTooltips(prev => ({ ...prev, [section.id]: false }))}
                      onEscapeKeyDown={() => setOpenTooltips(prev => ({ ...prev, [section.id]: false }))}
                    >
                      <div className="bg-background border rounded-md shadow-lg py-1 min-w-[220px] max-w-[280px]" style={{ position: 'relative', zIndex: 9999999 }}>
                        <div className="px-3 py-2 text-sm font-medium text-muted-foreground border-b bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {section.label}
                          </div>
                          <div className="text-xs mt-1 text-muted-foreground/70">
                            Click any item to navigate
                          </div>
                        </div>
                        {section.items?.map((item) => {
                          const ItemIcon = item.icon
                          return (
                            <Button
                              key={item.href}
                              variant={item.active ? "secondary" : "ghost"}
                              className="w-full justify-start px-3 py-2 h-auto rounded-none hover:bg-accent/50 transition-colors"
                              asChild
                              onClick={handleLinkClick}
                            >
                              <Link href={item.href} className="flex items-center w-full" aria-current={item.active ? "page" : undefined}>
                                <ItemIcon className="mr-2 h-4 w-4 shrink-0" />
                                <span className="flex-1">{item.label}</span>
                                {item.badge && (
                                  <Badge variant="secondary" className="ml-auto text-xs">{item.badge}</Badge>
                                )}
                                {item.active && (
                                  <div className={cn("w-1.5 h-1.5 bg-primary rounded-full", item.badge ? "ml-1" : "ml-auto")} />
                                )}
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true) // Start collapsed by default

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const authChromeLessPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/auth/reset-password",
    "/auth/confirm",
    "/auth/callback",
  ]
  
  // Exclude print pages from sidebar/header layout
  if (pathname?.includes("/imprimir")) {
    return <>{children}</>
  }
  
  if (authChromeLessPaths.some((p) => pathname?.startsWith(p))) {
    return <>{children}</>
  }

  // Home dashboards (executive layout) manage their own horizontal padding and
  // edge-to-edge strips; avoid double-padding inside <main>.
  const isAppDashboardRoute =
    pathname === "/dashboard" || pathname?.startsWith("/dashboard/")

  return (
    <TooltipProvider>
      <div className="min-h-screen flex">
        {/* Desktop Sidebar */}
        <aside 
          id="main-sidebar"
          className={cn(
            "hidden md:flex md:flex-col border-r border-border/50 bg-background transition-all duration-300 ease-in-out relative z-sidebar-panel",
            isSidebarCollapsed ? "md:w-16" : "md:w-64"
          )}>
          <div className="flex h-full max-h-screen flex-col">
            {/* Enhanced Header with logo as toggle */}
            <div className="flex h-16 items-center border-b px-4 lg:px-6">
              <AppLogo 
                isCollapsed={isSidebarCollapsed} 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              />
            </div>
            
            {/* Navigation Content */}
            <div id="sidebar-navigation-content" className="flex-1 overflow-auto">
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
                    <span className="sr-only">Abrir men?</span>
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
              <UserNav />
            </div>
          </header>

          {/* Page Content — default padding; /dashboard* uses shell-internal padding */}
          <main
            className={cn(
              "flex-1 overflow-auto relative z-page-content",
              isAppDashboardRoute
                ? "p-0"
                : "px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-8"
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
