import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { 
  GitCompare, 
  Plus, 
  Minus, 
  Edit, 
  Check, 
  AlertTriangle,
  Copy,
  Eye
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface VersionData {
  id: string
  version_number: number
  name: string
  change_summary: string
  created_at: string
  is_active: boolean
  sections: any[]
}

interface ComparisonProps {
  templateId: string
  isOpen: boolean
  onClose: () => void
}

interface ChangeItem {
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  path: string
  oldValue?: any
  newValue?: any
  description: string
}

export function VersionComparison({ templateId, isOpen, onClose }: ComparisonProps) {
  const { toast } = useToast()
  const [versions, setVersions] = useState<VersionData[]>([])
  const [leftVersion, setLeftVersion] = useState<string>('')
  const [rightVersion, setRightVersion] = useState<string>('')
  const [comparison, setComparison] = useState<ChangeItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && templateId) {
      loadVersions()
    }
  }, [isOpen, templateId])

  const loadVersions = async () => {
    if (!templateId || templateId === 'demo-template') {
      // For demo purposes, use mock data if no real template ID
      const mockVersions = [
        {
          id: 'mock-v2',
          version_number: 2,
          name: 'CHECK SEMANAL v2',
          change_summary: 'Actualizada con nuevas verificaciones',
          created_at: new Date().toISOString(),
          is_active: true,
          sections: [
            {
              id: 's1',
              title: 'Verificaciones Generales',
              order_index: 1,
              items: [
                { id: 'i1', description: 'Revisar niveles de aceite', required: true, order_index: 1, item_type: 'check' },
                { id: 'i2', description: 'Verificar presión de llantas', required: true, order_index: 2, item_type: 'measurement' },
                { id: 'i3', description: 'Inspeccionar filtros', required: false, order_index: 3, item_type: 'check' }
              ]
            }
          ]
        },
        {
          id: 'mock-v1',
          version_number: 1,
          name: 'CHECK SEMANAL v1',
          change_summary: 'Versión inicial',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          is_active: false,
          sections: [
            {
              id: 's1',
              title: 'Verificaciones Básicas',
              order_index: 1,
              items: [
                { id: 'i1', description: 'Revisar aceite motor', required: true, order_index: 1, item_type: 'check' },
                { id: 'i2', description: 'Verificar presión neumáticos', required: true, order_index: 2, item_type: 'check' }
              ]
            }
          ]
        }
      ]
      setVersions(mockVersions)
      setRightVersion('mock-v2')
      setLeftVersion('mock-v1')
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('checklist_template_versions' as any)
        .select('id, version_number, name, change_summary, created_at, is_active, sections')
        .eq('template_id', templateId)
        .order('version_number', { ascending: false })

      if (error) {
        console.error('Supabase error loading versions:', error)
        throw error
      }
      
      setVersions((data as unknown as VersionData[]) || [])
      
      // Auto-select current version and previous version
      if (data && data.length >= 2) {
        const versionData = data as unknown as VersionData[]
        setRightVersion(versionData[0].id) // Latest version
        setLeftVersion(versionData[1].id)   // Previous version
      } else if (data && data.length === 1) {
        const versionData = data as unknown as VersionData[]
        setRightVersion(versionData[0].id)
        setLeftVersion('')
      }
    } catch (error: any) {
      console.error('Error loading versions:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las versiones",
        variant: "destructive"
      })
    }
  }

  const compareVersions = async () => {
    if (!leftVersion || !rightVersion) {
      toast({
        title: "Selección requerida",
        description: "Por favor selecciona dos versiones para comparar",
        variant: "destructive"
      })
      return
    }

    if (leftVersion === rightVersion) {
      toast({
        title: "Versiones idénticas",
        description: "Por favor selecciona versiones diferentes",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const leftVersionData = versions.find(v => v.id === leftVersion)
      const rightVersionData = versions.find(v => v.id === rightVersion)

      if (!leftVersionData || !rightVersionData) {
        throw new Error('Versiones no encontradas')
      }

      const changes = generateComparison(leftVersionData, rightVersionData)
      setComparison(changes)
      
    } catch (error) {
      console.error('Error comparing versions:', error)
      toast({
        title: "Error",
        description: "Error al comparar las versiones",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const generateComparison = (left: VersionData, right: VersionData): ChangeItem[] => {
    const changes: ChangeItem[] = []

    // Compare basic template properties
    if (left.name !== right.name) {
      changes.push({
        type: 'modified',
        path: 'template.name',
        oldValue: left.name,
        newValue: right.name,
        description: `Nombre de plantilla cambió de "${left.name}" a "${right.name}"`
      })
    }

    // Compare sections structure
    const leftSections = left.sections || []
    const rightSections = right.sections || []

    // Find added sections
    rightSections.forEach((rightSection: any) => {
      const leftSection = leftSections.find((ls: any) => ls.id === rightSection.id)
      if (!leftSection) {
        changes.push({
          type: 'added',
          path: `sections.${rightSection.title}`,
          newValue: rightSection,
          description: `Sección agregada: "${rightSection.title}"`
        })
      }
    })

    // Find removed sections
    leftSections.forEach((leftSection: any) => {
      const rightSection = rightSections.find((rs: any) => rs.id === leftSection.id)
      if (!rightSection) {
        changes.push({
          type: 'removed',
          path: `sections.${leftSection.title}`,
          oldValue: leftSection,
          description: `Sección eliminada: "${leftSection.title}"`
        })
      }
    })

    // Find modified sections
    leftSections.forEach((leftSection: any) => {
      const rightSection = rightSections.find((rs: any) => rs.id === leftSection.id)
      if (rightSection) {
        // Compare section title
        if (leftSection.title !== rightSection.title) {
          changes.push({
            type: 'modified',
            path: `sections.${leftSection.title}.title`,
            oldValue: leftSection.title,
            newValue: rightSection.title,
            description: `Título de sección cambió de "${leftSection.title}" a "${rightSection.title}"`
          })
        }

        // Compare items within section
        const leftItems = leftSection.items || []
        const rightItems = rightSection.items || []

        // Find added items
        rightItems.forEach((rightItem: any) => {
          const leftItem = leftItems.find((li: any) => li.id === rightItem.id)
          if (!leftItem) {
            changes.push({
              type: 'added',
              path: `sections.${rightSection.title}.items.${rightItem.description}`,
              newValue: rightItem,
              description: `Item agregado en "${rightSection.title}": "${rightItem.description}"`
            })
          }
        })

        // Find removed items
        leftItems.forEach((leftItem: any) => {
          const rightItem = rightItems.find((ri: any) => ri.id === leftItem.id)
          if (!rightItem) {
            changes.push({
              type: 'removed',
              path: `sections.${leftSection.title}.items.${leftItem.description}`,
              oldValue: leftItem,
              description: `Item eliminado de "${leftSection.title}": "${leftItem.description}"`
            })
          }
        })

        // Find modified items
        leftItems.forEach((leftItem: any) => {
          const rightItem = rightItems.find((ri: any) => ri.id === leftItem.id)
          if (rightItem) {
            if (leftItem.description !== rightItem.description) {
              changes.push({
                type: 'modified',
                path: `sections.${leftSection.title}.items.${leftItem.description}`,
                oldValue: leftItem.description,
                newValue: rightItem.description,
                description: `Descripción de item cambió de "${leftItem.description}" a "${rightItem.description}"`
              })
            }

            if (leftItem.required !== rightItem.required) {
              changes.push({
                type: 'modified',
                path: `sections.${leftSection.title}.items.${leftItem.description}.required`,
                oldValue: leftItem.required,
                newValue: rightItem.required,
                description: `Item "${leftItem.description}" cambió requisito: ${leftItem.required ? 'Requerido' : 'Opcional'} → ${rightItem.required ? 'Requerido' : 'Opcional'}`
              })
            }

            if (leftItem.item_type !== rightItem.item_type) {
              changes.push({
                type: 'modified',
                path: `sections.${leftSection.title}.items.${leftItem.description}.type`,
                oldValue: leftItem.item_type,
                newValue: rightItem.item_type,
                description: `Tipo de item "${leftItem.description}" cambió de "${leftItem.item_type}" a "${rightItem.item_type}"`
              })
            }
          }
        })
      }
    })

    return changes
  }

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'added': return <Plus className="h-4 w-4 text-green-500" />
      case 'removed': return <Minus className="h-4 w-4 text-red-500" />
      case 'modified': return <Edit className="h-4 w-4 text-yellow-500" />
      default: return <Check className="h-4 w-4 text-gray-500" />
    }
  }

  const getChangeBadgeVariant = (type: string) => {
    switch (type) {
      case 'added': return 'default'
      case 'removed': return 'destructive'
      case 'modified': return 'secondary'
      default: return 'outline'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Comparación de Versiones
          </DialogTitle>
          <DialogDescription>
            Compara diferentes versiones de la plantilla para ver los cambios realizados
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Version Selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Versión Base</label>
              <Select value={leftVersion} onValueChange={setLeftVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar versión base" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      <div className="flex items-center gap-2">
                        <span>v{version.version_number}</span>
                        {version.is_active && <Badge variant="default" className="text-xs">Activa</Badge>}
                        <span className="text-muted-foreground">
                          - {new Date(version.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Versión a Comparar</label>
              <Select value={rightVersion} onValueChange={setRightVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar versión a comparar" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      <div className="flex items-center gap-2">
                        <span>v{version.version_number}</span>
                        {version.is_active && <Badge variant="default" className="text-xs">Activa</Badge>}
                        <span className="text-muted-foreground">
                          - {new Date(version.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={compareVersions} disabled={loading || !leftVersion || !rightVersion}>
              {loading ? 'Comparando...' : 'Comparar Versiones'}
            </Button>
          </div>

          {/* Comparison Results */}
          {comparison.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Cambios Detectados ({comparison.length})
                </h3>
                <div className="flex gap-2">
                  <Badge variant="default" className="flex items-center gap-1">
                    <Plus className="h-3 w-3" />
                    {comparison.filter(c => c.type === 'added').length} Agregados
                  </Badge>
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <Minus className="h-3 w-3" />
                    {comparison.filter(c => c.type === 'removed').length} Eliminados
                  </Badge>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Edit className="h-3 w-3" />
                    {comparison.filter(c => c.type === 'modified').length} Modificados
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                {comparison.map((change, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getChangeIcon(change.type)}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={getChangeBadgeVariant(change.type)}>
                                {change.type}
                              </Badge>
                              <span className="text-sm font-mono text-muted-foreground">
                                {change.path}
                              </span>
                            </div>
                            <p className="text-sm">{change.description}</p>
                            
                            {change.type === 'modified' && (
                              <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                                <div className="p-2 bg-red-50 border border-red-200 rounded">
                                  <span className="font-medium text-red-700">Antes:</span>
                                  <div className="text-red-600 font-mono">
                                    {JSON.stringify(change.oldValue, null, 2)}
                                  </div>
                                </div>
                                <div className="p-2 bg-green-50 border border-green-200 rounded">
                                  <span className="font-medium text-green-700">Después:</span>
                                  <div className="text-green-600 font-mono">
                                    {JSON.stringify(change.newValue, null, 2)}
                                  </div>
                                </div>
                              </div>
                            )}

                            {change.type === 'added' && change.newValue && (
                              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
                                <span className="font-medium text-green-700">Agregado:</span>
                                <div className="text-green-600 font-mono">
                                  {JSON.stringify(change.newValue, null, 2)}
                                </div>
                              </div>
                            )}

                            {change.type === 'removed' && change.oldValue && (
                              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs">
                                <span className="font-medium text-red-700">Eliminado:</span>
                                <div className="text-red-600 font-mono">
                                  {JSON.stringify(change.oldValue, null, 2)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {comparison.length === 0 && leftVersion && rightVersion && !loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Check className="h-8 w-8 mx-auto mb-2" />
                <p>No se encontraron diferencias entre las versiones seleccionadas</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 