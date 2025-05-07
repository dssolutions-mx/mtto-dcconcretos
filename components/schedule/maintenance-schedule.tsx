"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  PenToolIcon as Tool,
  Wrench,
} from "lucide-react"

// Datos de ejemplo para el calendario
const maintenanceEvents = [
  {
    id: "M001",
    title: "Mantenimiento Preventivo - Compresor #12",
    date: new Date(2023, 5, 15),
    type: "preventive",
    asset: "Compresor Industrial #12",
    provider: "TecnoServicios S.A.",
    warrantyRelated: true,
  },
  {
    id: "M002",
    title: "Mantenimiento Preventivo - Montacargas #3",
    date: new Date(2023, 5, 18),
    type: "preventive",
    asset: "Montacargas Eléctrico #3",
    provider: "LogiMant Ltda.",
    warrantyRelated: false,
  },
  {
    id: "M003",
    title: "Revisión de Garantía - Sistema HVAC",
    date: new Date(2023, 5, 22),
    type: "warranty",
    asset: "Sistema HVAC Planta 2",
    provider: "ClimaControl",
    warrantyRelated: true,
  },
  {
    id: "M004",
    title: "Mantenimiento Preventivo - Línea Producción",
    date: new Date(2023, 5, 25),
    type: "preventive",
    asset: "Línea de Producción #1",
    provider: "Interno",
    warrantyRelated: false,
  },
  {
    id: "M005",
    title: "Calibración - Generador Principal",
    date: new Date(2023, 5, 28),
    type: "calibration",
    asset: "Generador Eléctrico Principal",
    provider: "EnergySolutions",
    warrantyRelated: true,
  },
]

// Datos de ejemplo para vencimientos de garantías
const warrantyExpirations = [
  {
    id: "W001",
    title: "Vencimiento Garantía - Compresor #12",
    date: new Date(2023, 6, 15),
    asset: "Compresor Industrial #12",
    provider: "TecnoServicios S.A.",
    daysLeft: 30,
  },
  {
    id: "W002",
    title: "Vencimiento Garantía - Sistema HVAC",
    date: new Date(2023, 6, 20),
    asset: "Sistema HVAC Planta 2",
    provider: "ClimaControl",
    daysLeft: 35,
  },
  {
    id: "W003",
    title: "Vencimiento Garantía - Generador",
    date: new Date(2023, 7, 5),
    asset: "Generador Eléctrico Principal",
    provider: "EnergySolutions",
    daysLeft: 51,
  },
]

export function MaintenanceSchedule() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)

  // Combinar eventos de mantenimiento y vencimientos de garantía
  const allEvents = [...maintenanceEvents, ...warrantyExpirations]

  // Función para renderizar el contenido del día en el calendario
  const renderDay = (day: Date) => {
    const eventsOnDay = allEvents.filter((event) => event.date.toDateString() === day.toDateString())

    if (eventsOnDay.length === 0) return null

    return (
      <div className="relative">
        <div className="absolute bottom-0 right-0">
          <Badge
            variant={
              eventsOnDay.some((e) => e.type === "warranty" || ("id" in e && e.id.startsWith("W")))
                ? "secondary"
                : "default"
            }
            className="h-2 w-2 rounded-full p-0"
          />
        </div>
      </div>
    )
  }

  // Función para manejar el clic en un día
  const handleDayClick = (day: Date | undefined) => {
    if (!day) return

    const eventsOnDay = allEvents.filter((event) => event.date.toDateString() === day.toDateString())

    if (eventsOnDay.length > 0) {
      setSelectedEvent(eventsOnDay[0])
    } else {
      setSelectedEvent(null)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-7">
      <Card className="md:col-span-5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Calendario de Mantenimientos</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filtrar
              </Button>
              <div className="flex">
                <Button variant="outline" size="icon" className="rounded-r-none">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="rounded-l-none">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <CardDescription>Visualiza y gestiona los mantenimientos programados</CardDescription>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            onDayClick={handleDayClick}
            className="rounded-md border"
            components={{
              DayContent: (props) => (
                <>
                  {props.day}
                  {renderDay(props.date)}
                </>
              ),
            }}
          />
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Detalles del Evento</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedEvent ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedEvent.title}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedEvent.date.toLocaleDateString()}</span>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Activo:</span>
                  <span className="text-sm font-medium">{selectedEvent.asset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Proveedor:</span>
                  <span className="text-sm font-medium">{selectedEvent.provider}</span>
                </div>
                {selectedEvent.type && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tipo:</span>
                    <Badge
                      variant={
                        selectedEvent.type === "preventive"
                          ? "default"
                          : selectedEvent.type === "warranty"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {selectedEvent.type === "preventive"
                        ? "Preventivo"
                        : selectedEvent.type === "warranty"
                          ? "Garantía"
                          : "Calibración"}
                    </Badge>
                  </div>
                )}
                {selectedEvent.daysLeft && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Días restantes:</span>
                    <span className="text-sm font-medium">{selectedEvent.daysLeft}</span>
                  </div>
                )}
                {selectedEvent.warrantyRelated && (
                  <div className="flex items-center gap-2 mt-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">Relacionado con garantía</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Clock className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Selecciona un día con eventos para ver los detalles</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          {selectedEvent && (
            <Button variant="outline" size="sm">
              <Wrench className="mr-2 h-4 w-4" />
              Crear OT
            </Button>
          )}
        </CardFooter>
      </Card>
      <Card className="md:col-span-7">
        <CardHeader>
          <CardTitle>Próximos Vencimientos de Garantías</CardTitle>
          <CardDescription>Garantías que vencerán en los próximos 60 días</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {warrantyExpirations.map((warranty) => (
              <Card key={warranty.id} className="border-amber-200">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{warranty.asset}</h4>
                      <Badge variant="outline">{warranty.daysLeft} días</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{warranty.provider}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{warranty.date.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button variant="ghost" size="sm">
                        <Tool className="mr-2 h-4 w-4" />
                        Programar revisión
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
