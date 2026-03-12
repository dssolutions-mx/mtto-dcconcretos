"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ExternalLink, FileText } from "lucide-react"

interface DocumentationTabProps {
  asset: any
  formatDate: (date: string | null) => string
}

export function DocumentationTab({ asset, formatDate }: DocumentationTabProps) {
  if (!asset) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="rounded-xl shadow-md transition-colors duration-200 overflow-hidden">
        <CardHeader>
          <CardTitle>Documentación</CardTitle>
          <CardDescription>
            Manuales y documentación técnica relacionada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {asset.insurance_documents && asset.insurance_documents.length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-slate-600">Documentos de Seguro</h4>
              <div className="space-y-2">
                {asset.insurance_documents.map((docUrl: string, index: number) => {
                  const filename = docUrl.split("/").pop() || `Documento ${index + 1}`
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
                        <span className="text-sm">{filename}</span>
                      </div>
                      <a
                        href={docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:text-sky-800 transition-colors duration-200 cursor-pointer"
                      >
                        <Button variant="ghost" size="sm" className="cursor-pointer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </a>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText
                className="mx-auto h-12 w-12 text-muted-foreground opacity-50"
                aria-hidden
              />
              <h3 className="mt-4 text-lg font-medium">No hay documentos disponibles</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Los documentos técnicos se encuentran asociados al modelo de equipo.
              </p>
              {asset.model && (
                <Button variant="outline" className="mt-4 cursor-pointer" asChild>
                  <Link href={`/modelos/${asset.model.id}`}>Ver documentación del modelo</Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-md transition-colors duration-200 overflow-hidden">
        <CardHeader>
          <CardTitle>Información Financiera</CardTitle>
          <CardDescription>Datos administrativos y financieros</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-slate-600">Fecha de Compra</dt>
              <dd className="text-lg text-slate-900">
                {formatDate(asset.purchase_date || null)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">Costo de Adquisición</dt>
              <dd className="text-lg text-slate-900">
                {asset.purchase_cost || "No especificado"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">Garantía Válida Hasta</dt>
              <dd className="text-lg text-slate-900">
                {formatDate(asset.warranty_expiration || null)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">Información de Registro</dt>
              <dd className="text-lg text-slate-900">
                {asset.registration_info || "No especificada"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">Póliza de Seguro</dt>
              <dd className="text-lg text-slate-900">
                {asset.insurance_policy || "No especificada"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">Seguro Válido Hasta</dt>
              <dd className="text-lg text-slate-900">
                {formatDate(asset.insurance_end_date || null)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
