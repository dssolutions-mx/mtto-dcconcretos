"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CuentaLitrosGap } from "@/lib/diesel-cuenta-litros-gaps"
import { AlertTriangle, ArrowRight, Camera, Fuel } from "lucide-react"

interface CuentaLitrosGapModalProps {
  gap: CuentaLitrosGap | null
  isOpen: boolean
  onClose: () => void
  onViewEvidence: (txId: string) => void
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function gapTypeBadgeVariant(
  gapType: CuentaLitrosGap["gap_type"],
): "destructive" | "secondary" | "outline" {
  if (gapType === "unregistered_dispense") return "destructive"
  if (gapType === "over_registered") return "secondary"
  return "outline"
}

function AnchorCard({
  label,
  anchor,
  cuentaLitros,
  onViewEvidence,
}: {
  label: string
  anchor: CuentaLitrosGap["prev_anchor"]
  cuentaLitros: number
  onViewEvidence: (txId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Fuel className="h-4 w-4 text-muted-foreground" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="font-mono text-xs text-muted-foreground">{anchor.transaction_id}</div>
        <div>{formatDateTime(anchor.transaction_date)}</div>
        {anchor.asset_label && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">Equipo</span>
            <Badge variant="outline" className="text-xs font-mono">
              {anchor.asset_label}
            </Badge>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{anchor.quantity_liters.toFixed(1)} L registrados</Badge>
          <Badge variant="secondary">Cuenta litros: {cuentaLitros.toFixed(0)} L</Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={() => onViewEvidence(anchor.tx_id)}
        >
          <Camera className="h-3.5 w-3.5 mr-2" />
          Ver evidencia
        </Button>
      </CardContent>
    </Card>
  )
}

export function CuentaLitrosGapModal({
  gap,
  isOpen,
  onClose,
  onViewEvidence,
}: CuentaLitrosGapModalProps) {
  if (!gap) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Hueco cuenta litros
          </DialogTitle>
          <DialogDescription>
            Intervalo entre lecturas de medidor — solo visualización
          </DialogDescription>
        </DialogHeader>

        <Alert
          variant={gap.gap_type === "unregistered_dispense" ? "destructive" : "default"}
          className={
            gap.gap_type === "over_registered"
              ? "border-amber-300 bg-amber-50"
              : gap.gap_type === "within_tolerance"
                ? "border-green-300 bg-green-50"
                : undefined
          }
        >
          <AlertTitle className="flex flex-wrap items-center gap-2">
            <span>{gap.short_label}</span>
            <Badge variant={gapTypeBadgeVariant(gap.gap_type)}>{gap.gap_type}</Badge>
          </AlertTitle>
          <AlertDescription className="mt-2 text-sm leading-relaxed">
            {gap.narrative}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          <AnchorCard
            label="Ancla A (inicio)"
            anchor={gap.prev_anchor}
            cuentaLitros={gap.prev_cuenta_litros}
            onViewEvidence={onViewEvidence}
          />
          <div className="hidden sm:flex flex-col items-center text-xs text-muted-foreground gap-1">
            <ArrowRight className="h-5 w-5" />
            <span>{gap.time_window_label}</span>
          </div>
          <AnchorCard
            label="Ancla B (cierre)"
            anchor={gap.curr_anchor}
            cuentaLitros={gap.curr_cuenta_litros}
            onViewEvidence={onViewEvidence}
          />
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cómo se calcula</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>
                Se toman dos lecturas consecutivas de cuenta litros (anclas A y B).
              </li>
              <li>
                El avance del medidor es{" "}
                <span className="font-medium text-foreground">
                  {gap.curr_cuenta_litros.toFixed(0)} − {gap.prev_cuenta_litros.toFixed(0)} ={" "}
                  {gap.meter_delta.toFixed(0)} L
                </span>
                .
              </li>
              <li>
                Se suman los consumos registrados entre A (exclusivo) y B (inclusivo), sin
                transferencias ni ajustes:{" "}
                <span className="font-medium text-foreground">
                  {gap.registered_liters.toFixed(0)} L
                </span>
                .
              </li>
              <li>
                La diferencia{" "}
                <span className="font-medium text-foreground">
                  {gap.meter_delta.toFixed(0)} − {gap.registered_liters.toFixed(0)} ={" "}
                  {gap.gap_liters.toFixed(0)} L
                </span>{" "}
                indica litros no registrados (tolerancia ±2 L).
              </li>
            </ol>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            Transacciones en el intervalo ({gap.transactions_in_interval.length})
          </h4>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Litros</TableHead>
                  <TableHead className="text-right">Cuenta litros</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {gap.transactions_in_interval.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs">{tx.transaction_id}</TableCell>
                    <TableCell className="text-xs">
                      {tx.asset_label ? (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {tx.asset_label}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateTime(tx.transaction_date)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {tx.is_transfer ? "Transferencia" : tx.transaction_type}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {tx.quantity_liters.toFixed(1)} L
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {tx.cuenta_litros != null ? `${tx.cuenta_litros.toFixed(0)} L` : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onViewEvidence(tx.id)}
                      >
                        Evidencia
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
