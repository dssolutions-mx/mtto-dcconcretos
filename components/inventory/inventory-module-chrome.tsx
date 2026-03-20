import type { ReactNode } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  LayoutGrid,
  Package,
  Warehouse,
  FileText,
  BarChart3,
  Plus,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const SHORTCUTS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/inventario", label: "Existencias", icon: LayoutGrid },
  { href: "/inventario/catalogo", label: "Catálogo", icon: Package },
  { href: "/inventario/almacenes", label: "Almacenes", icon: Warehouse },
  { href: "/inventario/movimientos", label: "Movimientos", icon: FileText },
  { href: "/inventario/reportes", label: "Reportes", icon: BarChart3 },
]

interface InventoryModuleChromeProps {
  title: string
  description: string
  /** Ruta activa para resaltar el acceso (p. ej. /inventario/catalogo) */
  activeHref: string
  children: ReactNode
}

export function InventoryModuleChrome({
  title,
  description,
  activeHref,
  children,
}: InventoryModuleChromeProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 sm:space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold sm:text-2xl tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Módulo inventario
        </p>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-background to-transparent sm:hidden" />
          <div className="flex overflow-x-auto scrollbar-none gap-2 pb-1 sm:flex-wrap sm:gap-3">
            {SHORTCUTS.map(({ href, label, icon: Icon }) => {
              const active = href === activeHref
              return (
                <Button
                  key={href}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "shrink-0 min-h-[44px] rounded-xl cursor-pointer",
                    !active &&
                      "border-border/60 bg-card transition-all hover:border-border hover:shadow-sm"
                  )}
                  asChild
                >
                  <Link href={href}>
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </Link>
                </Button>
              )
            })}
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 min-h-[44px] rounded-xl border-border/60 bg-card cursor-pointer transition-all hover:border-border hover:shadow-sm"
              asChild
            >
              <Link href="/inventario/catalogo">
                <Plus className="mr-2 h-4 w-4" />
                Nueva parte
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {children}
    </div>
  )
}
