"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const links = [
  { href: "/portal-proveedores/dashboard", label: "Panel" },
  { href: "/portal-proveedores/ordenes", label: "Órdenes de compra" },
  { href: "/portal-proveedores/facturas", label: "Facturas" },
  { href: "/portal-proveedores/pagos", label: "Pagos" },
]

export function PortalNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-2 border-t pt-3">
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
