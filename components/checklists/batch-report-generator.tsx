"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar as CalendarIcon, Download, FileArchive, Loader2, FileText } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { toast } from "sonner"

interface BatchReportGeneratorProps {
  plants: string[]
}

export function BatchReportGenerator({ plants }: BatchReportGeneratorProps) {
  const [selectedPlant, setSelectedPlant] = useState<string>("")
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleGenerateBatchReport = async () => {
    if (!selectedPlant) {
      toast.error("Selecciona una planta para generar el reporte")
      return
    }

    setIsGenerating(true)
    try {
      const params = new URLSearchParams()
      params.append('plant', selectedPlant)
      if (startDate) params.append('start_date', startDate.toISOString().split('T')[0])
      if (endDate) params.append('end_date', endDate.toISOString().split('T')[0])

      const response = await fetch(`/api/checklists/batch-evidence-report?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Error al generar el reporte en lote')
      }

      // Get the HTML content from the response
      const htmlContent = await response.text()
      
      // Open the report in a new window for printing
      const reportWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes')
      if (reportWindow) {
        reportWindow.document.write(htmlContent)
        reportWindow.document.close()
        
        // Focus the new window
        reportWindow.focus()
        
        toast.success(`Reporte consolidado generado exitosamente para ${selectedPlant}`)
      } else {
        // If popup was blocked, create a download link
        const blob = new Blob([htmlContent], { type: 'text/html' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = `reporte-evidencias-${selectedPlant}-${new Date().toISOString().split('T')[0]}.html`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast.success(`Reporte descargado como HTML. Ábrelo en tu navegador para imprimir.`)
      }
      
      setIsDialogOpen(false)
      
    } catch (error: any) {
      console.error('Error generating batch report:', error)
      toast.error(`Error al generar reporte: ${error.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const formatDateForDisplay = (date: Date | undefined) => {
    if (!date) return "Seleccionar fecha"
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: es })
  }

  // Set default dates (last 30 days)
  const defaultEndDate = new Date()
  const defaultStartDate = new Date()
  defaultStartDate.setDate(defaultStartDate.getDate() - 30)

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileArchive className="mr-2 h-4 w-4" />
          Reportes en Lote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generar Reporte Consolidado</DialogTitle>
          <DialogDescription>
            Genera un reporte consolidado con todas las evidencias de checklists completados para una planta específica. El reporte se abre en una nueva ventana lista para imprimir como PDF.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="plant">Planta</Label>
            <Select value={selectedPlant} onValueChange={setSelectedPlant}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una planta" />
              </SelectTrigger>
              <SelectContent>
                {plants.map((plant) => (
                  <SelectItem key={plant} value={plant}>
                    {plant}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Rango de Fechas (Opcional)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label htmlFor="start-date" className="text-xs">Fecha Inicio</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Inicio"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="grid gap-1">
                <Label htmlFor="end-date" className="text-xs">Fecha Fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Fin"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Si no seleccionas fechas, se incluirán todos los checklists completados de los últimos 30 días en un reporte consolidado.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleGenerateBatchReport} 
            disabled={isGenerating || !selectedPlant}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generar Reporte
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}