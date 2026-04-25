"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type BuRow = {
  business_unit_id: string
  business_units: { id: string; name: string } | null
}

type UsageResponse = {
  business_units: BuRow[]
  purchase_orders: { total: number; by_status: Record<string, number> }
  quotations_count: number
  inventory_parts: { count: number; sample: Array<{ id: string; name: string | null; part_number: string | null }> }
  linked_as_alias: Array<{ id: string; name: string }>
  supplier: { serves_all_business_units?: boolean | null }
}

export function SupplierUsagePanel({ supplierId }: { supplierId: string }) {
  const [data, setData] = useState<UsageResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let c = true
    void (async () => {
      const r = await fetch(`/api/suppliers/${supplierId}/usage`)
      if (!r.ok) {
        if (c) setErr("No se pudo cargar el alcance")
        return
      }
      const j = (await r.json()) as UsageResponse
      if (c) setData(j)
    })()
    return () => {
      c = false
    }
  }, [supplierId])

  if (err) {
    return <p className="text-sm text-destructive">{err}</p>
  }
  if (!data) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Alcance en UN</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {data.supplier.serves_all_business_units && (
              <p className="font-medium">Todas las unidades de negocio</p>
            )}
            <ul className="list-disc pl-4 mt-1">
              {(data.business_units || []).map((b) => (
                <li key={b.business_unit_id}>
                  {(b as BuRow).business_units?.name || b.business_unit_id}
                </li>
              ))}
            </ul>
            {!data.supplier.serves_all_business_units && (data.business_units || []).length === 0 && (
              <p className="text-muted-foreground">Sin unidades adicionales en la relación</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Órdenes de compra (muestra)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Total reciente (hasta 500 en servidor): {data.purchase_orders.total}</p>
            {Object.entries(data.purchase_orders.by_status).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Cotizaciones / inventario</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Cotizaciones: {data.quotations_count}</p>
            <p>Partes de inventario: {data.inventory_parts.count}</p>
          </CardContent>
        </Card>
      </div>

      {data.linked_as_alias.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Registros que apuntan aquí como canónico</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-4 text-sm">
              {data.linked_as_alias.map((l) => (
                <li key={l.id}>
                  <Link className="underline" href={`/suppliers/${l.id}`}>
                    {l.name}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data.inventory_parts.sample.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Muestra de partes de inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parte</TableHead>
                  <TableHead>Número</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.inventory_parts.sample.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.part_number || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
