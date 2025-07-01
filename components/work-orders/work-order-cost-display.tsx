import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { InfoIcon, ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';

interface PurchaseOrder {
  id: string;
  order_id: string;
  total_amount: string | number;
  actual_amount?: string | number | null;
  status: string;
  supplier: string;
  is_adjustment?: boolean;
}

interface WorkOrderCostDisplayProps {
  estimatedCost?: number | string | null;
  requiredPartsCost?: number;
  purchaseOrders?: PurchaseOrder[];
  workOrderId: string;
  className?: string;
}

function formatCurrency(amount: string | number | null | undefined): string {
  if (!amount) return "0.00";
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return numAmount.toFixed(2);
}

function getCostConfidence(hasReceipt: boolean, hasQuote: boolean, hasEstimate: boolean): {
  level: 'high' | 'medium' | 'low';
  label: string;
  description: string;
} {
  if (hasReceipt) {
    return {
      level: 'high',
      label: 'Comprobado',
      description: 'Costo final con comprobantes de compra'
    };
  }
  if (hasQuote) {
    return {
      level: 'medium', 
      label: 'Cotizado',
      description: 'Costo basado en cotizaciones de proveedores'
    };
  }
  if (hasEstimate) {
    return {
      level: 'low',
      label: 'Estimado',
      description: 'Costo estimado basado en repuestos requeridos'
    };
  }
  return {
    level: 'low',
    label: 'Sin costo',
    description: 'No se ha definido costo para esta orden'
  };
}

export function WorkOrderCostDisplay({ 
  estimatedCost, 
  requiredPartsCost, 
  purchaseOrders = [], 
  workOrderId,
  className = "" 
}: WorkOrderCostDisplayProps) {
  
  // Separate regular and adjustment purchase orders
  const regularPOs = purchaseOrders.filter(po => !po.is_adjustment);
  const adjustmentPOs = purchaseOrders.filter(po => po.is_adjustment);
  
  // Calculate costs from purchase orders
  const quotedCost = regularPOs.reduce((sum, po) => {
    const amount = typeof po.total_amount === 'string' ? parseFloat(po.total_amount) : po.total_amount;
    return sum + (amount || 0);
  }, 0);
  
  const actualCost = regularPOs.reduce((sum, po) => {
    if (po.actual_amount) {
      const amount = typeof po.actual_amount === 'string' ? parseFloat(po.actual_amount) : po.actual_amount;
      return sum + (amount || 0);
    }
    // Fall back to total_amount if no actual_amount
    const amount = typeof po.total_amount === 'string' ? parseFloat(po.total_amount) : po.total_amount;
    return sum + (amount || 0);
  }, 0);
  
  const adjustmentCost = adjustmentPOs.reduce((sum, po) => {
    const amount = po.actual_amount || po.total_amount;
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return sum + (numAmount || 0);
  }, 0);
  
  // Determine what to show as primary cost
  const hasReceipts = regularPOs.some(po => po.actual_amount || ['received', 'validated'].includes(po.status));
  const hasQuotes = regularPOs.length > 0;
  const hasEstimate = estimatedCost || requiredPartsCost;
  
  let primaryCost = 0;
  let costSource = '';
  
  if (hasReceipts) {
    primaryCost = actualCost + adjustmentCost;
    costSource = 'receipt';
  } else if (hasQuotes) {
    primaryCost = quotedCost + adjustmentCost;
    costSource = 'quote';
  } else if (hasEstimate) {
    const estCost = estimatedCost ? (typeof estimatedCost === 'string' ? parseFloat(estimatedCost) : estimatedCost) : 0;
    primaryCost = estCost || requiredPartsCost || 0;
    costSource = 'estimate';
  }
  
  const confidence = getCostConfidence(hasReceipts, hasQuotes, Boolean(hasEstimate));
  
  const confidenceColors = {
    high: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-blue-100 text-blue-800 border-blue-200',
    low: 'bg-yellow-100 text-yellow-800 border-yellow-200'
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Primary Cost Display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Costo Total</p>
          <Badge 
            variant="outline" 
            className={confidenceColors[confidence.level]}
            title={confidence.description}
          >
            {confidence.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">
            ${formatCurrency(primaryCost)}
          </span>
          {confidence.level !== 'high' && (
            <InfoIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Cost Breakdown */}
      {(hasQuotes || hasEstimate) && (
        <div className="space-y-2">
          <Separator />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Desglose de Costos
          </p>
          
          {hasEstimate && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estimado inicial:</span>
              <span>${formatCurrency(estimatedCost || requiredPartsCost)}</span>
            </div>
          )}
          
          {hasQuotes && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Cotizado ({regularPOs.length} OC):
              </span>
              <span>${formatCurrency(quotedCost)}</span>
            </div>
          )}
          
          {hasReceipts && actualCost !== quotedCost && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Costo real:</span>
              <span>${formatCurrency(actualCost)}</span>
            </div>
          )}
          
          {adjustmentCost > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Gastos adicionales ({adjustmentPOs.length}):
              </span>
              <span>${formatCurrency(adjustmentCost)}</span>
            </div>
          )}
        </div>
      )}

      {/* Related Purchase Orders */}
      {purchaseOrders.length > 0 && (
        <div className="space-y-2">
          <Separator />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Órdenes de Compra Relacionadas
          </p>
          <div className="space-y-2">
            {purchaseOrders.map((po) => (
              <div key={po.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{po.order_id}</span>
                    {po.is_adjustment && (
                      <Badge variant="secondary" className="text-xs">Ajuste</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{po.supplier}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    ${formatCurrency(po.actual_amount || po.total_amount)}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {po.status}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" asChild className="ml-2">
                  <Link href={`/compras/${po.id}`}>
                    <ExternalLinkIcon className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 