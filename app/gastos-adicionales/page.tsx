import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PendingAdjustmentExpenses from '@/components/admin/pending-adjustment-expenses'

export const dynamic = 'force-dynamic'

export default async function PendingAdjustmentsPage() {
  const supabase = await createServerSupabase()

  const { data: rows } = await supabase
    .from('additional_expenses')
    .select(`
      id, work_order_id, asset_id, description, amount, status, created_at,
      work_orders(order_id),
      assets(asset_id, name, plants(name))
    `)
    .is('adjustment_po_id', null)
    .order('created_at', { ascending: false })

  const pending = (rows || []).map((r: any) => ({
    id: r.id,
    work_order_id: r.work_order_id,
    work_order_code: r.work_orders?.order_id || 'OT',
    asset_name: r.assets?.name || 'Activo',
    asset_code: r.assets?.asset_id || '',
    plant: r.assets?.plants?.name || '',
    description: r.description || 'Gasto adicional',
    amount: Number(r.amount || 0),
    status: r.status,
    created_at: r.created_at
  }))

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gastos Adicionales pendientes</h1>
        <p className="text-muted-foreground">Convierte gastos aprobados o pendientes en Órdenes de Compra de ajuste con un clic.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
          <CardDescription>
            Los costos se registran únicamente por Orden de Compra. Aquí sólo aparecen gastos sin OC de ajuste.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Pendientes</Badge>
              <span className="text-lg font-semibold">{pending.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Total</Badge>
              <span className="text-lg font-semibold">
                ${pending.reduce((s, r) => s + r.amount, 0).toLocaleString('es-MX')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <PendingAdjustmentExpenses pending={pending} />
    </div>
  )
}


