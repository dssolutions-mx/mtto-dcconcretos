"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, ClipboardList, Save } from "lucide-react"
import { cn } from "@/lib/utils"

// Datos de ejemplo para los selectores
const assets = [
  { id: "A001", name: "Compresor Industrial #12" },
  { id: "A002", name: "Montacargas Eléctrico #3" },
  { id: "A005", name: "Generador Eléctrico Principal" },
  { id: "A007", name: "Mezcladora de Concreto CR-15" },
  { id: "A008", name: "Grúa Torre GT-200" },
]

const providers = [
  { id: "P001", name: "TecnoServicios S.A." },
  { id: "P002", name: "LogiMant Ltda." },
  { id: "P003", name: "ClimaControl" },
  { id: "P004", name: "EnergySolutions" },
  { id: "P005", name: "Interno" },
]

const technicians = [
  { id: "T001", name: "Carlos Méndez" },
  { id: "T002", name: "Ana Gómez" },
  { id: "T003", name: "Roberto Sánchez" },
  { id: "T004", name: "María Torres" },
  { id: "T005", name: "Javier López" },
]

const checklists = [
  { id: "CL001", name: "Mantenimiento Preventivo 1000h - Mezcladora CR-15" },
  { id: "CL002", name: "Mantenimiento Preventivo 500h - Grúa Torre GT-200" },
  { id: "CL003", name: "Mantenimiento Preventivo 2000h - Generador Eléctrico" },
  { id: "CL004", name: "Mantenimiento Preventivo 800h - Montacargas Eléctrico" },
  { id: "CL005", name: "Mantenimiento Preventivo 1500h - Compresor Industrial" },
]

export function WorkOrderForm() {
  const [date, setDate] = useState<Date>()
  const [selectedType, setSelectedType] = useState("preventive")
  const [selectedAsset, setSelectedAsset] = useState("")
  const [selectedChecklist, setSelectedChecklist] = useState("")
  const [isFromChecklist, setIsFromChecklist] = useState(false)

  // Cuando se selecciona un activo, sugerir el checklist correspondiente
  const handleAssetChange = (value: string) => {
    setSelectedAsset(value)

    // Lógica para sugerir el checklist basado en el activo seleccionado
    if (value === "A007") {
      setSelectedChecklist("CL001")
    } else if (value === "A008") {
      setSelectedChecklist("CL002")
    } else if (value === "A005") {
      setSelectedChecklist("CL003")
    } else if (value === "A002") {
      setSelectedChecklist("CL004")
    } else if (value === "A001") {
      setSelectedChecklist("CL005")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
          <CardDescription>Ingresa la información básica para la orden de trabajo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workOrderType">Tipo de Orden de Trabajo</Label>
              <RadioGroup
                defaultValue="preventive"
                value={selectedType}
                onValueChange={setSelectedType}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="preventive" id="preventive" />
                  <Label htmlFor="preventive">Mantenimiento Preventivo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="corrective" id="corrective" />
                  <Label htmlFor="corrective">Mantenimiento Correctivo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="warranty" id="warranty" />
                  <Label htmlFor="warranty">Reclamo de Garantía</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridad</Label>
              <Select defaultValue="medium">
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" placeholder="Ingrese un título descriptivo para la OT" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" placeholder="Describa el trabajo a realizar" rows={3} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="asset">Activo</Label>
              <Select value={selectedAsset} onValueChange={handleAssetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar activo" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledDate">Fecha Programada</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asignación y Recursos</CardTitle>
          <CardDescription>Asigna responsables y recursos para la orden de trabajo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Proveedor</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="technician">Técnico Responsable</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar técnico" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((technician) => (
                    <SelectItem key={technician.id} value={technician.id}>
                      {technician.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedHours">Duración Estimada (horas)</Label>
            <Input id="estimatedHours" type="number" min="0" step="0.5" defaultValue="2" />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fromChecklist"
                checked={isFromChecklist}
                onCheckedChange={(checked) => setIsFromChecklist(checked === true)}
              />
              <Label htmlFor="fromChecklist">Generar a partir de un checklist</Label>
            </div>

            {isFromChecklist && (
              <div className="space-y-2">
                <Label htmlFor="checklist">Checklist</Label>
                <Select value={selectedChecklist} onValueChange={setSelectedChecklist}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar checklist" />
                  </SelectTrigger>
                  <SelectContent>
                    {checklists.map((checklist) => (
                      <SelectItem key={checklist.id} value={checklist.id}>
                        {checklist.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Información Adicional</CardTitle>
          <CardDescription>Agrega detalles adicionales para la orden de trabajo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instructions">Instrucciones Especiales</Label>
            <Textarea id="instructions" placeholder="Instrucciones adicionales para el técnico" rows={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requiredParts">Repuestos Requeridos</Label>
            <Textarea id="requiredParts" placeholder="Lista de repuestos necesarios" rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requiredTools">Herramientas Necesarias</Label>
            <Textarea id="requiredTools" placeholder="Lista de herramientas necesarias" rows={2} />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="notifyCompletion" />
            <Label htmlFor="notifyCompletion">Notificar al completar la orden</Label>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline">Cancelar</Button>
          <div className="flex gap-2">
            <Button variant="outline">
              <Save className="mr-2 h-4 w-4" />
              Guardar Borrador
            </Button>
            <Button>
              <ClipboardList className="mr-2 h-4 w-4" />
              Crear Orden
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
