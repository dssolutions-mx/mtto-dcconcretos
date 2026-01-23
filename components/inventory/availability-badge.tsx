"use client"

import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface AvailabilityBadgeProps {
  part_id: string
  part_name: string
  required_quantity: number
  availability: {
    part_id: string
    part_number: string
    part_name: string
    required_quantity: number
    available_by_warehouse: Array<{
      warehouse_id: string
      warehouse_name: string
      available_quantity: number
      current_quantity: number
      reserved_quantity: number
    }>
    total_available: number
    sufficient: boolean
  }
}

export function AvailabilityBadge({
  part_id,
  part_name,
  required_quantity,
  availability
}: AvailabilityBadgeProps) {
  const { sufficient, total_available, available_by_warehouse } = availability

  if (sufficient) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Disponible ({total_available})
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <div className="font-medium">Disponible en:</div>
              {available_by_warehouse.map((w) => (
                <div key={w.warehouse_id} className="text-sm">
                  {w.warehouse_name}: {w.available_quantity} disp. 
                  (Total: {w.current_quantity}, Reservado: {w.reserved_quantity})
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (total_available > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Parcial ({total_available}/{required_quantity})
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <div className="font-medium">Stock insuficiente:</div>
              <div className="text-sm">Requerido: {required_quantity}</div>
              <div className="text-sm">Disponible: {total_available}</div>
              <div className="text-sm">Faltante: {required_quantity - total_available}</div>
              {available_by_warehouse.length > 0 && (
                <>
                  <div className="font-medium mt-2">Disponible en:</div>
                  {available_by_warehouse.map((w) => (
                    <div key={w.warehouse_id} className="text-sm">
                      {w.warehouse_name}: {w.available_quantity} disp.
                    </div>
                  ))}
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Sin Stock
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div className="font-medium">Sin stock disponible</div>
            <div className="text-sm">Requerido: {required_quantity}</div>
            <div className="text-sm">Disponible: 0</div>
            <div className="text-sm mt-2">Se requiere orden de compra</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
