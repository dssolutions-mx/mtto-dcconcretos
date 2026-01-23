import { Suspense } from 'react'
import ChecklistComplianceView from '@/components/hr/checklist-compliance-view'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Statistics skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Filters skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Table skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ChecklistCompliancePage() {
  return (
    <div className="container mx-auto py-6 px-8">
      {/* Header */}
      <div className="mb-6" id="checklist-compliance-header">
        <h1 className="text-3xl font-bold">Cumplimiento de Checklists</h1>
        <p className="text-muted-foreground">
          Monitoreo del cumplimiento de checklists por unidad de negocio y planta para identificar 
          patrones de incumplimiento y apoyar decisiones de recursos humanos
        </p>
      </div>
      
      {/* Help text */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">¿Cómo interpretar este reporte?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Crítico:</strong> Checklists con más de 14 días de atraso requieren atención inmediata</li>
          <li>• <strong>Atrasado:</strong> Checklists vencidos que pueden impactar la productividad</li>
          <li>• <strong>Patrón de Recurrencia:</strong> Muestra cuántos ciclos se han perdido según la frecuencia del checklist</li>
          <li>• <strong>Tasa de Cumplimiento:</strong> Porcentaje de activos que mantienen sus checklists al día</li>
        </ul>
      </div>
      
      {/* Content */}
      <Suspense fallback={<LoadingSkeleton />}>
        <ChecklistComplianceView />
      </Suspense>
    </div>
  )
} 