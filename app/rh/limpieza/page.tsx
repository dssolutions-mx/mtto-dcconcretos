import { Suspense } from 'react'
import CleanlinessReportsView from '@/components/hr/cleanliness-reports-view'

export default function CleanlinessReportsPage() {
  return (
    <div className="container mx-auto py-6 px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Reportes de Limpieza</h1>
        <p className="text-muted-foreground">
          Revisa las evaluaciones de limpieza de los operadores para determinar bonos
        </p>
      </div>
      
      <Suspense fallback={<div className="text-center py-8">Cargando reportes...</div>}>
        <CleanlinessReportsView />
      </Suspense>
    </div>
  )
} 