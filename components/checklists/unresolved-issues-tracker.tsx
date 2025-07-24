"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Clock, Wrench, Trash2, CheckCircle2, Package, Calendar, MapPin, WifiOff, Wifi } from "lucide-react"
import { toast } from "sonner"
import { CorrectiveWorkOrderDialog } from "./corrective-work-order-dialog"
import { useOfflineSync } from "@/hooks/useOfflineSync"

// Import offline service
let offlineChecklistService: any = null

interface UnresolvedIssue {
  id: string
  checklistId: string
  assetId: string
  assetName: string
  issueCount: number
  timestamp: number
  synced?: boolean
}

interface UnresolvedIssueDetails {
  checklistId: string
  assetId: string
  assetName: string
  issues: Array<{
    id: string
    description: string
    notes: string
    photo: string | null
    status: "flag" | "fail"
    sectionTitle?: string
    sectionType?: string
  }>
  timestamp: number
}

export function UnresolvedIssuesTracker() {
  const [unresolvedIssues, setUnresolvedIssues] = useState<UnresolvedIssue[]>([])
  const [selectedIssue, setSelectedIssue] = useState<UnresolvedIssueDetails | null>(null)
  const [correctiveDialogOpen, setCorrectiveDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const { isOnline } = useOfflineSync()

  // Initialize offline service
  useEffect(() => {
    if (typeof window !== 'undefined' && !offlineChecklistService) {
      import('@/lib/services/offline-checklist-service').then(module => {
        offlineChecklistService = module.offlineChecklistService
        loadUnresolvedIssues()
      })
    } else if (offlineChecklistService) {
      loadUnresolvedIssues()
    }
  }, [])

  const loadUnresolvedIssues = async () => {
    try {
      if (offlineChecklistService) {
        // Use offline service for primary data source
        const issues = await offlineChecklistService.getUnresolvedIssues()
        setUnresolvedIssues(issues)
      } else {
        // Fallback to localStorage for backward compatibility
        const allUnresolvedKey = 'all-unresolved-issues'
        const stored = localStorage.getItem(allUnresolvedKey)
        
        if (stored) {
          const issues: UnresolvedIssue[] = JSON.parse(stored)
          // Sort by timestamp, newest first
          const sortedIssues = issues.sort((a, b) => b.timestamp - a.timestamp)
          setUnresolvedIssues(sortedIssues)
        }
      }
    } catch (error) {
      console.error('Error loading unresolved issues:', error)
      toast.error("Error al cargar problemas no resueltos")
    } finally {
      setLoading(false)
    }
  }

  const loadIssueDetails = async (unresolvedId: string): Promise<UnresolvedIssueDetails | null> => {
    try {
      if (offlineChecklistService) {
        const details = await offlineChecklistService.getUnresolvedIssueDetails(unresolvedId)
        if (details) {
          return {
            checklistId: details.checklistId,
            assetId: details.assetId,
            assetName: details.assetName,
            issues: details.issues,
            timestamp: details.timestamp
          }
        }
      } else {
        // Fallback to localStorage
        const unresolvedKey = `unresolved-issues-${unresolvedId}`
        const stored = localStorage.getItem(unresolvedKey)
        
        if (stored) {
          return JSON.parse(stored)
        }
      }
    } catch (error) {
      console.error('Error loading issue details:', error)
    }
    return null
  }

  const handleCreateWorkOrders = async (issue: UnresolvedIssue) => {
    const details = await loadIssueDetails(issue.id)
    
    if (!details) {
      toast.error("No se pudieron cargar los detalles del problema")
      return
    }

    setSelectedIssue(details)
    setCorrectiveDialogOpen(true)
  }

  const handleWorkOrderCreated = async (workOrderId: string) => {
    if (selectedIssue) {
      // Find the unresolved issue ID
      const unresolvedIssue = unresolvedIssues.find(issue => 
        issue.checklistId === selectedIssue.checklistId && 
        issue.assetId === selectedIssue.assetId
      )
      
      if (unresolvedIssue) {
        // Mark as resolved in offline service
        await removeResolvedIssue(unresolvedIssue.id)
      }
      
      // Refresh the list
      await loadUnresolvedIssues()
      
      // Close dialogs
      setCorrectiveDialogOpen(false)
      setSelectedIssue(null)
      
      toast.success("✅ Órdenes de trabajo creadas exitosamente")
    }
  }

  const removeResolvedIssue = async (unresolvedId: string) => {
    try {
      if (offlineChecklistService) {
        await offlineChecklistService.markIssuesResolved(unresolvedId)
      } else {
        // Fallback to localStorage
        const unresolvedKey = `unresolved-issues-${unresolvedId}`
        localStorage.removeItem(unresolvedKey)
        
        // Remove from the general index
        const allUnresolvedKey = 'all-unresolved-issues'
        const stored = localStorage.getItem(allUnresolvedKey)
        
        if (stored) {
          const issues: UnresolvedIssue[] = JSON.parse(stored)
          const filtered = issues.filter(issue => issue.id !== unresolvedId)
          localStorage.setItem(allUnresolvedKey, JSON.stringify(filtered))
        }
      }
    } catch (error) {
      console.error('Error removing resolved issue:', error)
    }
  }

  const handleDismissIssue = async (unresolvedId: string) => {
    if (confirm("¿Está seguro de que desea descartar estos problemas? Esta acción no se puede deshacer.")) {
      await dismissIssue(unresolvedId)
      await loadUnresolvedIssues()
      toast.success("Problemas descartados")
    }
  }

  const dismissIssue = async (unresolvedId: string) => {
    try {
      if (offlineChecklistService) {
        await offlineChecklistService.removeUnresolvedIssues(unresolvedId)
      } else {
        // Fallback to localStorage
        const unresolvedKey = `unresolved-issues-${unresolvedId}`
        localStorage.removeItem(unresolvedKey)
        
        // Remove from the general index
        const allUnresolvedKey = 'all-unresolved-issues'
        const stored = localStorage.getItem(allUnresolvedKey)
        
        if (stored) {
          const issues: UnresolvedIssue[] = JSON.parse(stored)
          const filtered = issues.filter(issue => issue.id !== unresolvedId)
          localStorage.setItem(allUnresolvedKey, JSON.stringify(filtered))
        }
      }
    } catch (error) {
      console.error('Error dismissing issue:', error)
    }
  }

  const clearAllIssues = async () => {
    if (confirm("¿Está seguro de que desea limpiar TODOS los problemas no resueltos? Esta acción no se puede deshacer.")) {
      try {
        if (offlineChecklistService) {
          // Remove all unresolved issues using offline service
          for (const issue of unresolvedIssues) {
            await offlineChecklistService.removeUnresolvedIssues(issue.id)
          }
        } else {
          // Fallback to localStorage
          localStorage.removeItem('all-unresolved-issues')
          
          // Clear individual issue details
          unresolvedIssues.forEach(issue => {
            localStorage.removeItem(`unresolved-issues-${issue.id}`)
          })
        }
        
        setUnresolvedIssues([])
        toast.success("Todos los problemas han sido limpiados")
      } catch (error) {
        console.error('Error clearing all issues:', error)
        toast.error("Error al limpiar los problemas")
      }
    }
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return "Hace menos de 1 hora"
    if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`
    
    return date.toLocaleDateString()
  }

  const getPriorityBadge = (issueCount: number) => {
    if (issueCount >= 5) {
      return <Badge variant="destructive">Alta Prioridad</Badge>
    } else if (issueCount >= 3) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Media Prioridad</Badge>
    } else {
      return <Badge variant="outline">Baja Prioridad</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (unresolvedIssues.length === 0) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">¡Excelente trabajo!</h3>
            <p className="text-muted-foreground text-center">
              No hay problemas pendientes de resolución.
              <br />
              Todos los checklists están al día.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold">Problemas No Resueltos</h2>
            {isOnline ? (
              <div title="En línea">
                <Wifi className="h-5 w-5 text-green-500" />
              </div>
            ) : (
              <div title="Sin conexión">
                <WifiOff className="h-5 w-5 text-orange-500" />
              </div>
            )}
          </div>
          <p className="text-muted-foreground">
            {unresolvedIssues.length} checklist{unresolvedIssues.length > 1 ? 's' : ''} con problemas pendientes
            {!isOnline && ' (modo offline)'}
          </p>
        </div>
        {unresolvedIssues.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearAllIssues}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpiar Todo
          </Button>
        )}
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Estos son problemas detectados en checklists completados que requieren atención.
          Cree órdenes de trabajo correctivas para resolver los problemas identificados.
        </AlertDescription>
      </Alert>

      <ScrollArea className="h-[70vh]">
        <div className="space-y-4">
          {unresolvedIssues.map((issue) => (
            <Card key={issue.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-red-100">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{issue.assetName}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          ID: {issue.assetId}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatTimestamp(issue.timestamp)}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(issue.issueCount)}
                    <Badge variant="secondary">
                      {issue.issueCount} problema{issue.issueCount > 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Checklist: {issue.checklistId}
                  </div>
                  <div className="flex items-center gap-2">
                                         <Button
                       variant="outline"
                       size="sm"
                       onClick={() => handleDismissIssue(issue.id)}
                       className="text-gray-600"
                     >
                       Descartar
                     </Button>
                     <Button
                       size="sm"
                       onClick={() => handleCreateWorkOrders(issue)}
                       className="bg-blue-600 hover:bg-blue-700"
                     >
                       <Wrench className="h-4 w-4 mr-2" />
                       Crear Órdenes
                     </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Corrective Work Order Dialog */}
      {selectedIssue && (
        <CorrectiveWorkOrderDialog
          open={correctiveDialogOpen}
          onOpenChange={setCorrectiveDialogOpen}
          checklist={{
            id: selectedIssue.checklistId,
            assetId: selectedIssue.assetId,
            asset: selectedIssue.assetName,
            name: `Checklist ${selectedIssue.checklistId}`
          }}
          itemsWithIssues={selectedIssue.issues}
          onWorkOrderCreated={handleWorkOrderCreated}
          onNavigateToAssetsPage={() => {
            setCorrectiveDialogOpen(false)
            setSelectedIssue(null)
          }}
        />
      )}
    </div>
  )
} 