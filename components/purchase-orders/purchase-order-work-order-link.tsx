import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ExternalLinkIcon, WrenchIcon } from 'lucide-react';
import Link from 'next/link';

interface WorkOrder {
  id: string;
  order_id: string;
  description: string;
  estimated_cost?: number | string | null;
  status: string;
  type: string;
  priority: string;
  asset?: {
    id: string;
    name: string;
    asset_id: string;
  };
}

interface PurchaseOrderWorkOrderLinkProps {
  workOrder?: WorkOrder | null;
  purchaseOrderType?: 'original' | 'adjustment';
  isAdjustment?: boolean;
  className?: string;
}

function formatCurrency(amount: string | number | null | undefined): string {
  if (!amount) return "0.00";
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return numAmount.toFixed(2);
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'completada':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'in_progress':
    case 'en_ejecucion':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'pending':
    case 'pendiente':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'approved':
    case 'aprobada':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'critical':
    case 'critica':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
    case 'alta':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
    case 'media':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
    case 'baja':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function PurchaseOrderWorkOrderLink({ 
  workOrder, 
  purchaseOrderType = 'original',
  isAdjustment = false,
  className = "" 
}: PurchaseOrderWorkOrderLinkProps) {
  
  if (!workOrder) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2">
          <WrenchIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {isAdjustment ? 'Ajuste sin orden de trabajo asociada' : 'No hay orden de trabajo asociada'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WrenchIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {isAdjustment ? 'Orden de Trabajo (Ajuste)' : 'Orden de Trabajo Relacionada'}
          </span>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/ordenes/${workOrder.id}`}>
            <ExternalLinkIcon className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      {/* Work Order Information */}
      <div className="bg-muted/30 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">{workOrder.order_id}</h4>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {workOrder.description}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Badge 
              variant="outline" 
              className={getStatusColor(workOrder.status)}
            >
              {workOrder.status}
            </Badge>
            <Badge 
              variant="outline" 
              className={getPriorityColor(workOrder.priority)}
            >
              {workOrder.priority}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Tipo:</span>
            <p className="font-medium">{workOrder.type}</p>
          </div>
          
          {workOrder.estimated_cost && (
            <div>
              <span className="text-muted-foreground">Costo estimado:</span>
              <p className="font-medium">${formatCurrency(workOrder.estimated_cost)}</p>
            </div>
          )}
        </div>

        {/* Asset Information */}
        {workOrder.asset && (
          <>
            <Separator />
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Activo
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{workOrder.asset.name}</p>
                  <p className="text-sm text-muted-foreground">{workOrder.asset.asset_id}</p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/activos/${workOrder.asset.id}`}>
                    <ExternalLinkIcon className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Context Information */}
      {isAdjustment && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
          <span>
            Esta orden de compra fue generada para cubrir gastos adicionales durante la ejecución del trabajo
          </span>
        </div>
      )}
    </div>
  );
} 