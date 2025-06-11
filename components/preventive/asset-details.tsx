"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Timer, Calendar, Edit } from "lucide-react"

// Datos de ejemplo para el activo seleccionado
const assetData = {
  id: "PM001",
  asset: "Mezcladora de Concreto CR-15",
  assetId: "A007",
  serviceInterval: 1000, // horas
  currentHours: 700,
  averageDailyUsage: 10, // horas por día
  lastService: "2023-05-15",
  nextService: "2023-07-15", // calculado
  daysRemaining: 30,
  hoursRemaining: 300,
  status: "En tiempo",
  progress: 70, // porcentaje de horas transcurridas desde el último servicio
  manufacturer: "ConcreMix",
  model: "CR-15",
  serialNumber: "CM-CR15-2022-0458",
  location: "Planta Principal - Zona A",
  purchaseDate: "2022-03-10",
  warrantyExpiration: "2024-03-10",
  responsiblePerson: "Carlos Méndez",
  department: "Producción",
  criticality: "Alta",
  notes: "Este equipo requiere calibración especial después de cada mantenimiento preventivo.",
  maintenanceInstructions:
    "Seguir el manual del fabricante para el mantenimiento de 1000 horas. Prestar especial atención al sistema hidráulico y a los sellos de la mezcladora.",
  requiredParts: [
    { name: "Kit de sellos hidráulicos", quantity: 1, partNumber: "CM-KSH-458" },
    { name: "Filtro de aceite", quantity: 2, partNumber: "CM-FO-112" },
    { name: "Aceite hidráulico 20L", quantity: 1, partNumber: "HD-OIL-20L" },
  ],
  requiredTools: ["Llave dinamométrica", "Juego de llaves Allen", "Manómetro de presión hidráulica"],
  estimatedDuration: 4, // horas
  checklistId: "CL001",
}

interface AssetDetailsProps {
  id: string
}

export function AssetDetails({ id }: AssetDetailsProps) {
  // En una aplicación real, buscaríamos los datos del activo por su ID
  // const asset = getAssetById(id);
  const asset = assetData // Usamos datos de ejemplo

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Urgente":
        return "destructive"
      case "Próximo":
        return "secondary"
      case "En tiempo":
        return "default"
      default:
        return "outline"
    }
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 95) return "bg-red-500"
    if (progress >= 80) return "bg-amber-500"
    return "bg-green-500"
  }

  return (
    <div className="grid gap-4 md:grid-cols-7">
      <Card className="md:col-span-4">
        <CardHeader>
          <CardTitle>Información del Activo</CardTitle>
          <CardDescription>Detalles del equipo y su programa de mantenimiento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold">{asset.asset}</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{asset.manufacturer}</Badge>
              <Badge variant="outline">Modelo: {asset.model}</Badge>
              <Badge variant={getStatusColor(asset.status)}>{asset.status}</Badge>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Horas de Operación</div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{asset.currentHours}</div>
                <Timer className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-xs text-muted-foreground">Uso diario promedio: {asset.averageDailyUsage} horas</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Próximo Servicio</div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{asset.daysRemaining} días</div>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-xs text-muted-foreground">
                {asset.nextService} ({asset.hoursRemaining} horas restantes)
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Progreso del Ciclo de Mantenimiento</div>
              <div className="text-sm">{asset.progress}%</div>
            </div>
            <Progress value={asset.progress} className={`h-2 ${getProgressColor(asset.progress)}`} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>Último servicio: {asset.lastService}</div>
              <div>Intervalo: {asset.serviceInterval} horas</div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium mb-2">Información Técnica</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">ID del Activo:</dt>
                  <dd>{asset.assetId}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Número de Serie:</dt>
                  <dd>{asset.serialNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Planta:</dt>
                  <dd>{(asset as any).plants?.name || asset.location || 'Sin planta'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Criticidad:</dt>
                  <dd>{asset.criticality}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Información Administrativa</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Fecha de Compra:</dt>
                  <dd>{asset.purchaseDate}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Vencimiento de Garantía:</dt>
                  <dd>{asset.warrantyExpiration}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Responsable:</dt>
                  <dd>{asset.responsiblePerson}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Departamento:</dt>
                  <dd>{(asset as any).departments?.name || asset.department || 'Sin departamento'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle>Información de Mantenimiento</CardTitle>
          <CardDescription>Instrucciones y recursos necesarios</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Instrucciones de Mantenimiento</h4>
            <p className="text-sm">{asset.maintenanceInstructions}</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Repuestos Requeridos</h4>
            <ul className="space-y-1">
              {asset.requiredParts.map((part, index) => (
                <li key={index} className="text-sm flex justify-between">
                  <span>
                    {part.name} (x{part.quantity})
                  </span>
                  <span className="text-muted-foreground">{part.partNumber}</span>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Herramientas Necesarias</h4>
            <ul className="space-y-1">
              {asset.requiredTools.map((tool, index) => (
                <li key={index} className="text-sm">
                  {tool}
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Duración Estimada</h4>
              <Badge variant="outline">{asset.estimatedDuration} horas</Badge>
            </div>
          </div>

          <div className="flex justify-between mt-4">
            <Button variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Editar Información
            </Button>
            <Button variant="outline" size="sm">
              <Timer className="mr-2 h-4 w-4" />
              Actualizar Horas
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
