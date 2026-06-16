"use client"

import Link from "next/link"
import { DollarSign, FileText, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface PoProcurementNavCardProps {
  purchaseOrderId: string
  orderIdDisplay: string
  showPostApproval?: boolean
}

/**
 * Entry points for post-approval procurement from a single OC — avoids orphan sidebar nav.
 */
export function PoProcurementNavCard({
  purchaseOrderId,
  orderIdDisplay,
  showPostApproval = true,
}: PoProcurementNavCardProps) {
  if (!showPostApproval) return null

  return (
    <Card className="rounded-2xl border border-border/60" id="po-procurement-nav">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Contabilidad y pagos</CardTitle>
        <CardDescription className="text-xs">
          Comprobantes, CFDI y cuentas por pagar de esta OC ({orderIdDisplay})
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button variant="outline" size="sm" className="justify-start" asChild>
          <a href="#po-comprobantes">
            <Receipt className="mr-2 h-4 w-4 shrink-0" />
            Comprobantes de compra
          </a>
        </Button>
        <Button variant="outline" size="sm" className="justify-start" asChild>
          <a href="#po-factura-cfdi">
            <FileText className="mr-2 h-4 w-4 shrink-0" />
            Factura proveedor (CFDI)
          </a>
        </Button>
        <Button variant="outline" size="sm" className="justify-start" asChild>
          <Link href={`/compras/cuentas-por-pagar?po=${purchaseOrderId}`}>
            <DollarSign className="mr-2 h-4 w-4 shrink-0" />
            Estado de pago (CxP)
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" asChild>
          <Link href={`/compras/comprobantes?po=${purchaseOrderId}`}>
            Ver todos los comprobantes filtrados
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
