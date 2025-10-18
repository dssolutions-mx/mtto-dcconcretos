'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/components/ui/use-toast'

type PendingRow = {
  id: string
  work_order_id: string
  work_order_code: string
  asset_name: string
  asset_code: string
  plant: string
  description: string
  amount: number
  status: string
  created_at: string
}

export default function PendingAdjustmentExpenses({ pending }: { pending: PendingRow[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const grouped = useMemo(() => {
    const m = new Map<string, PendingRow[]>()
    for (const r of pending) {
      if (!m.has(r.work_order_id)) m.set(r.work_order_id, [])
      m.get(r.work_order_id)!.push(r)
    }
    return m
  }, [pending])

  const toggle = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const generatePO = async (workOrderId: string, ids: string[]) => {
    if (!ids.length) return
    setLoading(true)
    try {
      const res = await fetch('/api/maintenance/generate-adjustment-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workOrderId, additionalExpenseIds: ids })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error')
      toast({ title: 'OC de ajuste creada', description: `OC ${json.orderId || json.purchaseOrderId}` })
      window.location.reload()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <div className="space-y-8">
          {[...grouped.entries()].map(([woId, rows]) => {
            const woSelection = rows.filter(r => selectedIds.includes(r.id)).map(r => r.id)
            return (
              <div key={woId} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">OT {rows[0]?.work_order_code} • {rows[0]?.asset_name} ({rows[0]?.asset_code}) • {rows[0]?.plant}</div>
                  <Button size="sm" disabled={loading || woSelection.length === 0} onClick={() => generatePO(woId, woSelection)}>
                    Generar OC de Ajuste ({woSelection.length})
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(r => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Checkbox checked={selectedIds.includes(r.id)} onCheckedChange={() => toggle(r.id)} />
                          </TableCell>
                          <TableCell>{r.description}</TableCell>
                          <TableCell className="text-right">${r.amount.toLocaleString('es-MX')}</TableCell>
                          <TableCell>{new Date(r.created_at).toLocaleDateString('es-MX')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
