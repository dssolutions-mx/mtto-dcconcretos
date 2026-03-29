"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function DocumentsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documentación
        </CardTitle>
        <CardDescription>
          Los archivos se guardan al actualizar el activo. Use la pestaña <strong>Financiera</strong>, sección{" "}
          <strong>Documentos de Seguro</strong>, para adjuntar PDFs (pólizas, manuales, certificados).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>Ubicación de la carga de archivos</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Esta pestaña es informativa. Para agregar o quitar documentos, vaya a <strong>Financiera</strong> y use <strong>Subir documento de seguro</strong>. Los
            documentos se suben al bucket de almacenamiento y las URLs se guardan en el activo al pulsar <strong>Actualizar Activo</strong>.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
} 