import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { PortalNav } from "@/components/portal-proveedores/portal-nav"
import { PortalNotifications } from "@/components/portal-proveedores/portal-notifications"

interface PortalProveedoresShellProps {
  children: ReactNode
  className?: string
  showNav?: boolean
}

/** Layout mínimo para el portal externo de proveedores (sin sidebar interno). */
export function PortalProveedoresShell({
  children,
  className,
  showNav = false,
}: PortalProveedoresShellProps) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-5xl space-y-3 px-4 py-4 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                DC Concretos
              </p>
              <h1 className="text-lg font-semibold tracking-tight">
                Portal de proveedores
              </h1>
            </div>
            {showNav ? <PortalNotifications /> : null}
          </div>
          {showNav ? <PortalNav /> : null}
        </div>
      </header>
      <main className={cn("mx-auto max-w-5xl px-4 py-8 md:px-6", className)}>
        {children}
      </main>
    </div>
  )
}
