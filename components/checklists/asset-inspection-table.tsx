"use client"

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Calendar } from "lucide-react"
import Link from "next/link"

type Asset = {
  id: string
  name: string
  asset_id: string
  model_name: string
  manufacturer: string
  location: string
  last_inspection: string | null
  days_since_last_inspection: number | null
}

export function AssetInspectionTable({ assets }: { assets: Asset[] }) {
  if (!assets || assets.length === 0) {
    return <div className="text-center py-10">Todos los activos han sido inspeccionados recientemente</div>
  }
  
  function renderLastInspection(asset: Asset) {
    if (!asset.last_inspection) {
      return <span className="text-red-600">Nunca</span>
    }
    
    const days = asset.days_since_last_inspection
    let className = "text-green-600"
    
    if (days && days > 90) {
      className = "text-red-600"
    } else if (days && days > 30) {
      className = "text-yellow-600"
    }
    
    return (
      <span className={className}>
        {new Date(asset.last_inspection).toLocaleDateString()} ({days} días)
      </span>
    )
  }
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Activo</TableHead>
          <TableHead>Modelo</TableHead>
          <TableHead>Ubicación</TableHead>
          <TableHead>Última inspección</TableHead>
          <TableHead className="text-right">Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map(asset => (
          <TableRow key={asset.id}>
            <TableCell className="font-medium">
              {asset.name}
              <div className="text-xs text-muted-foreground">{asset.asset_id}</div>
            </TableCell>
            <TableCell>
              {asset.manufacturer} {asset.model_name}
            </TableCell>
                            <TableCell>{(asset as any).plants?.name || asset.location || 'Sin planta'}</TableCell>
            <TableCell>{renderLastInspection(asset)}</TableCell>
            <TableCell className="text-right">
              <Button asChild size="sm" variant="outline">
                <Link href={`/checklists/schedules?asset=${asset.id}`}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Programar
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
} 