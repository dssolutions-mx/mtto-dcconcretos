"use client"

import { Pencil, Plus, Trash2 } from "lucide-react"
import { format } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface MaintenanceHistoryPart {
  name: string
  partNumber?: string
  quantity: number
  cost?: string
}

interface IncidentRecord {
  date: Date
  type: string
  reportedBy: string
  description: string
  impact?: string
  resolution?: string
  downtime?: string
  laborHours?: string
  laborCost?: string
  parts?: MaintenanceHistoryPart[]
  totalCost?: string
  workOrder?: string
  status?: string
}

interface IncidentsTabProps {
  incidents: IncidentRecord[]
  onAddIncident: () => void
  onEditIncident: (index: number) => void
  onRemoveIncident: (index: number) => void
}

export function IncidentsTab({
  incidents,
  onAddIncident,
  onEditIncident,
  onRemoveIncident,
}: IncidentsTabProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Incidentes</CardTitle>
        <CardDescription>
          Registre incidentes ocurridos con este equipo, como fallas, averías o problemas reportados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {incidents.length === 0 ? "No hay incidentes registrados para este activo." : `${incidents.length} incidente(s) registrado(s).`}
          </div>
          <Button onClick={onAddIncident} size="sm" type="button">
            <Plus className="mr-1 h-4 w-4" /> Registrar Incidente
          </Button>
        </div>

        {incidents.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Reportado por</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(incident.date, "dd/MM/yyyy")}</TableCell>
                    <TableCell>{incident.type}</TableCell>
                    <TableCell>{incident.reportedBy}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{incident.description}</TableCell>
                    <TableCell>
                      <Badge variant={incident.status === "Resuelto" ? "outline" : "secondary"}>
                        {incident.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => onEditIncident(index)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => onRemoveIncident(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 