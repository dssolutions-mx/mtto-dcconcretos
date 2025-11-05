import { Metadata } from 'next'
import { UnifiedAssignmentWizard } from '@/components/personnel/unified-assignment-wizard'

export const metadata: Metadata = {
  title: 'Asignaciones Organizacionales',
  description: 'Proceso guiado para organizar personal, activos y operadores en tu estructura organizacional',
}

export default function AsignacionesPage() {
  return <UnifiedAssignmentWizard />
}

