import { Metadata } from 'next'
import { AssetAssignmentDragDrop } from '@/components/assets/asset-assignment-drag-drop'

export const metadata: Metadata = {
  title: 'Asignación de Activos',
  description: 'Asigna operadores a activos con drag and drop',
}

export default function AssetAssignmentPage() {
  return (
    <div className="container mx-auto py-6">
      <AssetAssignmentDragDrop />
    </div>
  )
} 