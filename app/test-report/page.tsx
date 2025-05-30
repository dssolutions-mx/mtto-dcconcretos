"use client"

import { AssetProductionReport } from "@/components/assets/asset-production-report"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestReportPage() {
  const [assetId, setAssetId] = useState("")
  const [showReport, setShowReport] = useState(false)

  const handleShowReport = () => {
    if (assetId.trim()) {
      setShowReport(true)
    }
  }

  const handleCloseReport = () => {
    setShowReport(false)
  }

  if (showReport && assetId) {
    return <AssetProductionReport assetId={assetId} onClose={handleCloseReport} />
  }

  return (
    <div className="container mx-auto p-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Probar Reporte de Producción</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">ID del Activo:</label>
            <Input
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              placeholder="Ingrese el ID del activo"
              className="mt-1"
            />
          </div>
          <Button onClick={handleShowReport} disabled={!assetId.trim()} className="w-full">
            Generar Reporte
          </Button>
          <p className="text-xs text-gray-500">
            Nota: Ingrese un ID de activo válido de su base de datos para generar el reporte completo.
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 