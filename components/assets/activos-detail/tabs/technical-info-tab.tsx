"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

const PHOTO_CATEGORIES: Record<
  string,
  { label: string; color: string }
> = {
  frontal: { label: "Vista Frontal", color: "bg-blue-500" },
  trasera: { label: "Vista Trasera", color: "bg-green-500" },
  lateral: { label: "Vista Lateral", color: "bg-yellow-500" },
  interior: { label: "Interior", color: "bg-purple-500" },
  motor: { label: "Motor", color: "bg-red-500" },
  placa: { label: "Placa/Serial", color: "bg-indigo-500" },
  detalles: { label: "Detalles", color: "bg-orange-500" },
  daños: { label: "Daños/Problemas", color: "bg-red-700" },
  otros: { label: "Otros", color: "bg-gray-500" },
}

interface TechnicalInfoTabProps {
  asset: any
  formatDate: (date: string | null) => string
}

export function TechnicalInfoTab({ asset, formatDate }: TechnicalInfoTabProps) {
  if (!asset) return null

  const naValue = "No aplicable"
  const naClass = "text-muted-foreground italic"

  return (
    <Card className="rounded-xl shadow-md transition-colors duration-200 overflow-hidden">
      <CardHeader>
        <CardTitle>Especificaciones Técnicas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-slate-600">Número de Serie</dt>
                <dd className="text-lg text-slate-900">
                  {asset.serial_number || "No especificado"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Modelo</dt>
                <dd className="text-lg text-slate-900">
                  {asset.model?.name || "No especificado"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Fabricante</dt>
                <dd className="text-lg text-slate-900">
                  {asset.model?.manufacturer || "No especificado"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Unidad de Mantenimiento</dt>
                <dd className="text-lg text-slate-900">
                  {asset.model?.maintenance_unit || "No especificada"}
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-slate-600">Horas Iniciales</dt>
                <dd className="text-lg text-slate-900">
                  {asset.initial_hours !== null
                    ? `${asset.initial_hours} horas`
                    : "No especificadas"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Kilómetros Iniciales</dt>
                <dd
                  className={`text-lg ${
                    asset.initial_kilometers === null || asset.initial_kilometers === undefined
                      ? naClass
                      : "text-slate-900"
                  }`}
                >
                  {asset.initial_kilometers !== null
                    ? `${asset.initial_kilometers} km`
                    : naValue}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Categoría</dt>
                <dd className="text-lg text-slate-900">
                  {asset.model?.category || "No especificada"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Año de Introducción</dt>
                <dd className="text-lg text-slate-900">
                  {asset.model?.year_introduced || "No especificado"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {asset.notes && (
          <>
            <Separator className="my-6" />
            <div>
              <h4 className="text-sm font-medium text-slate-600 mb-2">Notas Adicionales</h4>
              <p className="text-sm text-slate-900">{asset.notes}</p>
            </div>
          </>
        )}

        {asset.photos && asset.photos.length > 0 && (
          <>
            <Separator className="my-6" />
            <div>
              <h4 className="text-sm font-medium text-slate-600 mb-4">Fotografías del Activo</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {asset.photos.map((photoUrl: string, index: number) => {
                  const categoryMatch = photoUrl.match(/\/(\d+)-([^/]+)-([^/]+\.[^/]+)$/)
                  const categoryCode = categoryMatch ? categoryMatch[2] : "otros"
                  const categoryInfo = PHOTO_CATEGORIES[categoryCode] || PHOTO_CATEGORIES.otros
                  const filename = categoryMatch
                    ? categoryMatch[3]
                    : photoUrl.split("/").pop() || ""

                  return (
                    <div
                      key={index}
                      className="relative border border-gray-200 rounded-lg overflow-hidden group"
                    >
                      <div className="absolute top-2 left-2 z-10">
                        <Badge className={`${categoryInfo.color} text-white px-2 py-1`}>
                          {categoryInfo.label}
                        </Badge>
                      </div>
                      <img
                        src={photoUrl}
                        alt={`${categoryInfo.label} - ${filename}`}
                        className="w-full h-40 object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="truncate">{filename}</span>
                          <a
                            href={photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white hover:text-blue-300 transition-colors duration-200 cursor-pointer"
                            aria-label={`Abrir ${filename}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
