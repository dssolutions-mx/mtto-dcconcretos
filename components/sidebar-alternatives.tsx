"use client"

import React from "react"
import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Home,
  Package,
  Settings,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Building2,
  ChevronLeft,
  ChevronRight,
  Zap,
  Cog,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// ==============================================================================
// OPTION 2: Floating Toggle Button (Like VS Code)
// ==============================================================================

export function FloatingToggleSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={cn(
        "relative border-r bg-background transition-all duration-300 ease-in-out",
        isCollapsed ? "w-0" : "w-64"
      )}>
        {/* Floating Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "absolute top-4 -right-4 z-50 h-8 w-8 rounded-full bg-background border-2 shadow-lg",
            "hover:scale-110 transition-all duration-200"
          )}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>

        <div className={cn(
          "h-full flex flex-col transition-opacity duration-300",
          isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
          {/* Logo Header */}
          <div className="flex h-16 items-center px-6 border-b">
            <Link href="/dashboard" className="flex items-center gap-3 font-semibold">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white">
                <Zap className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold">MantenPro</span>
                <span className="text-xs text-muted-foreground -mt-0.5">Sistema Avanzado</span>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <div className="flex-1 p-4">
            <nav className="space-y-2">
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/dashboard">
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/activos">
                  <Package className="mr-2 h-4 w-4" />
                  Activos
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/modelos">
                  <Settings className="mr-2 h-4 w-4" />
                  Modelos
                </Link>
              </Button>
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b bg-background/95 backdrop-blur px-6 flex items-center">
          <h1 className="text-lg font-semibold">Sistema de Mantenimiento</h1>
        </header>
        <main className="flex-1 p-6">
          <div className="bg-muted/30 rounded-lg p-8 text-center">
            <p>Contenido principal aquí</p>
          </div>
        </main>
      </div>
    </div>
  )
}

// ==============================================================================
// OPTION 3: Header-Integrated Toggle (Like Notion)
// ==============================================================================

export function HeaderIntegratedSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed Header */}
      <header className="h-16 border-b bg-background flex items-center px-4 gap-4 z-10">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 font-semibold">
          <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">MantenPro</span>
        </Link>

        {/* Toggle Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isCollapsed ? "Mostrar sidebar" : "Ocultar sidebar"}</p>
          </TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">Configuración</Button>
          <Button size="sm">Perfil</Button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className={cn(
          "border-r bg-muted/30 transition-all duration-300 ease-in-out overflow-hidden",
          isCollapsed ? "w-0" : "w-64"
        )}>
          <div className="p-4">
            <nav className="space-y-2">
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/dashboard">
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/activos">
                  <Package className="mr-2 h-4 w-4" />
                  Activos
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/modelos">
                  <Settings className="mr-2 h-4 w-4" />
                  Modelos
                </Link>
              </Button>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="bg-background border rounded-lg p-8 text-center">
            <p>Contenido principal aquí</p>
          </div>
        </main>
      </div>
    </div>
  )
}

// ==============================================================================
// OPTION 4: Bottom Toggle with Compact Logo (Like Slack)
// ==============================================================================

export function BottomToggleSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={cn(
        "border-r bg-background transition-all duration-300 ease-in-out flex flex-col",
        isCollapsed ? "w-16" : "w-64"
      )}>
        {/* Logo Header */}
        <div className="flex h-16 items-center justify-center border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-3 font-semibold">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl text-white shadow-lg">
              <Cog className="h-6 w-6" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold">MantenPro</span>
                <span className="text-xs text-muted-foreground -mt-0.5">v2.0</span>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-auto">
          <div className="p-2">
            <TooltipProvider>
              <nav className="space-y-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className={cn(
                        "w-full",
                        isCollapsed ? "justify-center px-2" : "justify-start"
                      )} 
                      asChild
                    >
                      <Link href="/dashboard">
                        <Home className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                        {!isCollapsed && "Dashboard"}
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right" className="z-[99999]">
                      <p>Dashboard</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className={cn(
                        "w-full",
                        isCollapsed ? "justify-center px-2" : "justify-start"
                      )} 
                      asChild
                    >
                      <Link href="/activos">
                        <Package className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                        {!isCollapsed && "Activos"}
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right" className="z-[99999]">
                      <p>Activos</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className={cn(
                        "w-full",
                        isCollapsed ? "justify-center px-2" : "justify-start"
                      )} 
                      asChild
                    >
                      <Link href="/modelos">
                        <Settings className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                        {!isCollapsed && "Modelos"}
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right" className="z-[99999]">
                      <p>Modelos</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </nav>
            </TooltipProvider>
          </div>
        </div>

        {/* Bottom Toggle */}
        <div className="border-t p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-10"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                {isCollapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isCollapsed ? "right" : "top"} className="z-[99999]">
              <p>{isCollapsed ? "Expandir" : "Colapsar"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b bg-muted/20 px-6 flex items-center">
          <h1 className="text-lg font-semibold">Sistema de Mantenimiento</h1>
        </header>
        <main className="flex-1 p-6">
          <div className="bg-background border rounded-lg p-8 text-center">
            <p>Contenido principal aquí</p>
          </div>
        </main>
      </div>
    </div>
  )
}

// ==============================================================================
// OPTION 5: Split Logo and Toggle (Like Linear)
// ==============================================================================

export function SplitLogoToggleSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={cn(
        "border-r bg-background transition-all duration-300 ease-in-out flex flex-col",
        isCollapsed ? "w-16" : "w-64"
      )}>
        {/* Split Header */}
        <div className="flex h-16 items-center border-b">
          {/* Logo Section */}
          <div className={cn(
            "flex items-center px-4 transition-all duration-300",
            isCollapsed ? "justify-center w-full" : "flex-1"
          )}>
            <Link href="/dashboard" className="flex items-center gap-3 font-semibold">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg text-white">
                <Building2 className="h-5 w-5" />
              </div>
              {!isCollapsed && (
                <span className="text-lg font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                  MantenPro
                </span>
              )}
            </Link>
          </div>

          {/* Toggle Section */}
          {!isCollapsed && (
            <div className="px-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Collapsed Toggle */}
        {isCollapsed && (
          <div className="px-2 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-full h-8"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-auto p-2">
          <TooltipProvider>
            <nav className="space-y-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className={cn(
                      "w-full",
                      isCollapsed ? "justify-center px-2" : "justify-start"
                    )} 
                    asChild
                  >
                    <Link href="/dashboard">
                      <Home className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                      {!isCollapsed && "Dashboard"}
                    </Link>
                  </Button>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right" className="z-[99999]">
                    <p>Dashboard</p>
                  </TooltipContent>
                )}
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className={cn(
                      "w-full",
                      isCollapsed ? "justify-center px-2" : "justify-start"
                    )} 
                    asChild
                  >
                    <Link href="/activos">
                      <Package className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                      {!isCollapsed && "Activos"}
                    </Link>
                  </Button>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right" className="z-[99999]">
                    <p>Activos</p>
                  </TooltipContent>
                )}
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className={cn(
                      "w-full",
                      isCollapsed ? "justify-center px-2" : "justify-start"
                    )} 
                    asChild
                  >
                    <Link href="/modelos">
                      <Settings className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                      {!isCollapsed && "Modelos"}
                    </Link>
                  </Button>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right" className="z-[99999]">
                    <p>Modelos</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </nav>
          </TooltipProvider>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b bg-gradient-to-r from-orange-50 to-red-50 px-6 flex items-center">
          <h1 className="text-lg font-semibold">Sistema de Mantenimiento</h1>
        </header>
        <main className="flex-1 p-6">
          <div className="bg-background border rounded-lg p-8 text-center">
            <p>Contenido principal aquí</p>
          </div>
        </main>
      </div>
    </div>
  )
} 