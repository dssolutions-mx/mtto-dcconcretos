"use client"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { History, Eye, Copy } from "lucide-react"

export interface TemplateVersion {
  id: string
  version_number: number
  name: string
  description: string
  change_summary: string
  created_at: string
  created_by: string
  is_active: boolean
  sections?: unknown[]
}

interface VersionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateName: string
  versions: TemplateVersion[]
  onViewVersion?: (version: TemplateVersion) => void
  onRestoreVersion?: (version: TemplateVersion) => void
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  templateName,
  versions,
  onViewVersion,
  onRestoreVersion,
}: VersionHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Historial de Versiones - {templateName}</DialogTitle>
          <DialogDescription>
            Versiones de esta plantilla de checklist
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay versiones guardadas aún</p>
              <p className="text-sm">Se creará una versión automáticamente cuando guardes cambios</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <Card key={version.id} className={version.is_active ? 'border-blue-500 bg-blue-50' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          Versión {version.version_number}
                          {version.is_active && (
                            <Badge variant="default" className="bg-blue-600">Activa</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {new Date(version.created_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                          {version.created_by && ` • ${version.created_by}`}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewVersion?.(version)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                        {!version.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRestoreVersion?.(version)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Restaurar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm font-medium">Resumen de cambios:</Label>
                        <p className="text-sm text-muted-foreground">{version.change_summary || 'Sin descripción'}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {version.sections?.length || 0} secciones
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
