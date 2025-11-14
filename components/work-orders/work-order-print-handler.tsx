"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WorkOrderPrintHandlerProps {
  workOrderId: string
  className?: string
}

export function WorkOrderPrintHandler({ workOrderId, className = "" }: WorkOrderPrintHandlerProps) {
  const handlePrint = () => {
    // Open print page in new window
    const printUrl = `/ordenes/${workOrderId}/imprimir`
    window.open(printUrl, '_blank')
  }

  return (
    <Button 
      variant="outline" 
      onClick={handlePrint}
      className={className}
    >
      <Printer className="mr-2 h-4 w-4" />
      Imprimir
    </Button>
  )
}
