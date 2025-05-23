"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DocumentUpload } from "../document-upload"

interface DocumentsTabProps {
  // Add any props needed for document management
}

export function DocumentsTab({}: DocumentsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentación</CardTitle>
        <CardDescription>
          Suba documentación técnica, manuales, y otros archivos relacionados con el activo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <DocumentUpload
          label="Manual de Usuario"
          helperText="Suba el manual de usuario proporcionado por el fabricante"
        />

        <DocumentUpload label="Manual de Servicio" helperText="Suba el manual de servicio y mantenimiento" />

        <DocumentUpload
          label="Certificados"
          helperText="Suba certificados de garantía, calidad, o cumplimiento"
        />

        <DocumentUpload label="Otros Documentos" helperText="Suba cualquier otra documentación relevante" />
      </CardContent>
    </Card>
  )
} 