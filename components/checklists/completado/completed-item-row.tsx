"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle, XCircle, ExternalLink } from "lucide-react"
import type { CompletedItem } from "./types"

interface CompletedItemRowProps {
  item: CompletedItem
  description: string
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'pass':
      return <CheckCircle className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
    case 'flag':
      return <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" aria-hidden />
    case 'fail':
      return <XCircle className="h-4 w-4 text-red-600 shrink-0" aria-hidden />
    default:
      return null
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pass':
      return <Badge className="bg-green-500">Correcto</Badge>
    case 'flag':
      return <Badge className="bg-yellow-500">Atención</Badge>
    case 'fail':
      return <Badge className="bg-red-500">Falla</Badge>
    default:
      return <Badge variant="outline">Desconocido</Badge>
  }
}

export function CompletedItemRow({ item, description }: CompletedItemRowProps) {
  return (
    <div className="border rounded-lg p-4 transition-colors duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {getStatusIcon(item.status)}
            <span className="font-medium">{description}</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Estado:</span>
              {getStatusBadge(item.status)}
            </div>
            {item.notes && (
              <div>
                <span className="text-sm text-muted-foreground">Notas:</span>
                <p className="text-sm mt-1 bg-muted p-2 rounded">{item.notes}</p>
              </div>
            )}
            {item.photo_url && (
              <div>
                <span className="text-sm text-muted-foreground mb-2 block">Fotografía:</span>
                <div className="relative inline-block">
                  <img
                    src={item.photo_url}
                    alt={`Evidencia: ${description}`}
                    className="w-32 h-32 object-cover rounded border"
                  />
                  <a
                    href={item.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded cursor-pointer"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
