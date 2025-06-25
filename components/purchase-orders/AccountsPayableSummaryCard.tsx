"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Calendar, Clock, DollarSign, ExternalLink, RefreshCw } from "lucide-react"
import { AccountsPayableSummary } from "@/types/purchase-orders"
import { formatCurrency } from "@/lib/utils"

export function AccountsPayableSummaryCard() {
  const [summary, setSummary] = useState<AccountsPayableSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/purchase-orders/accounts-payable?limit=10')
      const result = await response.json()
      
      if (result.success) {
        setSummary(result.data.summary)
      }
    } catch (error) {
      console.error('Error fetching accounts payable summary:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  if (loading) {
    return (
      <Card className="mb-6 border-orange-200 bg-gradient-to-r from-orange-50 to-red-50">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin text-orange-600" />
            <span className="text-orange-700">Cargando cuentas por pagar...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!summary) {
    return null
  }

  const hasUrgentItems = summary.total_overdue > 0 || summary.items_due_today > 0
  const totalPendingAmount = summary.total_amount_pending + summary.total_amount_overdue

  return (
    <Card className={`mb-6 ${hasUrgentItems ? 'border-red-200 bg-gradient-to-r from-red-50 to-orange-50' : 'border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <DollarSign className="h-6 w-6 text-orange-600" />
            <div>
              <CardTitle className="text-lg">Estado de Cuentas por Pagar</CardTitle>
              <p className="text-sm text-muted-foreground">
                Resumen de pagos pendientes y vencimientos
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {hasUrgentItems && (
              <Badge className="bg-red-100 text-red-800">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Requiere Atención
              </Badge>
            )}
            <Link href="/compras/cuentas-por-pagar">
              <Button size="sm" variant="outline">
                <ExternalLink className="h-4 w-4 mr-1" />
                Ver Detalle
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Overdue Items */}
          <div className={`flex items-center space-x-3 p-3 rounded-lg ${summary.total_overdue > 0 ? 'bg-red-100/60' : 'bg-white/60'}`}>
            <AlertTriangle className={`h-8 w-8 ${summary.total_overdue > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            <div>
              <h4 className="font-medium">Vencidos</h4>
              <div className="flex items-center space-x-2">
                <p className={`text-lg font-bold ${summary.total_overdue > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {summary.total_overdue}
                </p>
                {summary.total_amount_overdue > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(summary.total_amount_overdue)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Due Today */}
          <div className={`flex items-center space-x-3 p-3 rounded-lg ${summary.items_due_today > 0 ? 'bg-orange-100/60' : 'bg-white/60'}`}>
            <Clock className={`h-8 w-8 ${summary.items_due_today > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
            <div>
              <h4 className="font-medium">Vencen Hoy</h4>
              <p className={`text-lg font-bold ${summary.items_due_today > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                {summary.items_due_today}
              </p>
            </div>
          </div>

          {/* Due This Week */}
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/60">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div>
              <h4 className="font-medium">Esta Semana</h4>
              <p className="text-lg font-bold text-blue-600">
                {summary.items_due_this_week}
              </p>
            </div>
          </div>

          {/* Total Pending */}
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/60">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <h4 className="font-medium">Total Pendiente</h4>
              <div className="flex flex-col">
                <p className="text-lg font-bold text-green-600">
                  {summary.total_pending}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(totalPendingAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Urgent Actions Alert */}
        {hasUrgentItems && (
          <div className="mt-4 p-3 bg-red-100 rounded-lg border border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <p className="text-sm font-medium text-red-800">
                  {summary.total_overdue > 0 && summary.items_due_today > 0 
                    ? `${summary.total_overdue} pagos vencidos y ${summary.items_due_today} vencen hoy`
                    : summary.total_overdue > 0 
                      ? `${summary.total_overdue} pagos vencidos requieren atención inmediata`
                      : `${summary.items_due_today} pagos vencen hoy`
                  }
                </p>
              </div>
              <Link href="/compras/cuentas-por-pagar?filter=overdue">
                <Button size="sm" className="bg-red-600 hover:bg-red-700">
                  Revisar Urgentes
                </Button>
              </Link>
            </div>
          </div>
        )}
        
        {!hasUrgentItems && (summary.total_pending > 0 || summary.items_due_this_week > 0) && (
          <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              ✓ No hay pagos vencidos. {summary.items_due_this_week > 0 && `${summary.items_due_this_week} pagos programados para esta semana.`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 