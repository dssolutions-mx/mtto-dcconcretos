"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, FileText, Star } from "lucide-react"
import { PurchaseOrderQuotation, QuotationComparison } from "@/types/purchase-orders"
import { QuotationStatus } from "@/types/purchase-orders"

interface QuotationComparisonTableProps {
  comparison: QuotationComparison
  onSelect?: (quotationId: string) => void
  onViewFile?: (quotationId: string) => void
}

type SortField = 'supplier' | 'price' | 'delivery' | 'rating'
type SortDirection = 'asc' | 'desc'

export function QuotationComparisonTable({
  comparison,
  onSelect,
  onViewFile
}: QuotationComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>('price')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const sortedQuotations = useMemo(() => {
    const sorted = [...comparison.quotations]
    
    sorted.sort((a, b) => {
      let aValue: any
      let bValue: any
      
      switch (sortField) {
        case 'supplier':
          aValue = a.supplier_name.toLowerCase()
          bValue = b.supplier_name.toLowerCase()
          break
        case 'price':
          aValue = a.quoted_amount
          bValue = b.quoted_amount
          break
        case 'delivery':
          aValue = a.delivery_days ?? 999
          bValue = b.delivery_days ?? 999
          break
        case 'rating':
          aValue = (a.supplier as any)?.rating ?? 0
          bValue = (b.supplier as any)?.rating ?? 0
          break
        default:
          return 0
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    
    return sorted
  }, [comparison.quotations, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium"
      onClick={() => handleSort(field)}
    >
      {label}
      {sortField === field ? (
        sortDirection === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  )

  const lowestPrice = Math.min(...comparison.quotations.map(q => q.quoted_amount))
  const fastestDelivery = Math.min(
    ...comparison.quotations
      .filter(q => q.delivery_days !== null && q.delivery_days !== undefined)
      .map(q => q.delivery_days!)
  )

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortButton field="supplier" label="Proveedor" />
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="price" label="Precio" />
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="delivery" label="Entrega" />
            </TableHead>
            <TableHead className="text-center">
              <SortButton field="rating" label="Calificación" />
            </TableHead>
            <TableHead>Condiciones</TableHead>
            <TableHead className="text-center">Estado</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedQuotations.map((quotation) => {
            const isSelected = quotation.status === QuotationStatus.SELECTED
            const isBestPrice = quotation.quoted_amount === lowestPrice
            const isFastestDelivery = quotation.delivery_days === fastestDelivery
            const supplier = quotation.supplier as any
            
            return (
              <TableRow
                key={quotation.id}
                className={isSelected ? 'bg-green-50' : ''}
              >
                <TableCell>
                  <div>
                    <div className="font-medium">{quotation.supplier_name}</div>
                    {supplier?.business_name && (
                      <div className="text-xs text-muted-foreground">
                        {supplier.business_name}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <span className="font-semibold">
                      ${quotation.quoted_amount.toLocaleString('es-MX', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                    {isBestPrice && (
                      <Badge variant="default" className="bg-green-600 text-xs">
                        Mejor
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <span>
                      {quotation.delivery_days ? `${quotation.delivery_days} días` : 'N/A'}
                    </span>
                    {isFastestDelivery && quotation.delivery_days && (
                      <Badge variant="default" className="bg-blue-600 text-xs">
                        Rápido
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {supplier?.rating ? (
                    <div className="flex items-center justify-center space-x-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{supplier.rating.toFixed(1)}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">N/A</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">{quotation.payment_terms || 'N/A'}</span>
                </TableCell>
                <TableCell className="text-center">
                  {isSelected ? (
                    <Badge className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Seleccionada
                    </Badge>
                  ) : quotation.status === QuotationStatus.REJECTED ? (
                    <Badge variant="destructive">Rechazada</Badge>
                  ) : (
                    <Badge variant="outline">Pendiente</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center space-x-2">
                    {quotation.file_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewFile?.(quotation.id)}
                        asChild
                      >
                        <a href={quotation.file_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {!isSelected && quotation.status === QuotationStatus.PENDING && onSelect && (
                      <Button
                        size="sm"
                        onClick={() => onSelect(quotation.id)}
                      >
                        Seleccionar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      
      {/* Summary Row */}
      <div className="border-t bg-muted/30 p-3">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total Cotizaciones: </span>
            <span className="font-medium">{comparison.summary.total_quotations}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Precio Más Bajo: </span>
            <span className="font-medium">
              ${comparison.summary.lowest_price.toLocaleString('es-MX')}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Entrega Más Rápida: </span>
            <span className="font-medium">
              {comparison.summary.fastest_delivery > 0 
                ? `${comparison.summary.fastest_delivery} días`
                : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Precio Promedio: </span>
            <span className="font-medium">
              ${comparison.summary.average_price.toLocaleString('es-MX', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
          </div>
        </div>
        
        {/* Recommendation */}
        {comparison.recommendation && !comparison.selected_quotation && (
          <div className="mt-3 p-2 bg-blue-50 rounded-md">
            <p className="text-xs font-medium text-blue-900 mb-1">
              💡 Recomendación del Sistema:
            </p>
            <p className="text-sm text-blue-800">
              {comparison.quotations.find(q => q.id === comparison.recommendation?.quotation_id)?.supplier_name}
              {' - '}
              {comparison.recommendation.reasoning.join(', ')}
              {' '}
              (Puntuación: {comparison.recommendation.score}/100)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
