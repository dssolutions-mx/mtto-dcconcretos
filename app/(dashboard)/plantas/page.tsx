import { Metadata } from 'next'
import { PlantConfigurationDragDrop } from '@/components/plants/plant-configuration-drag-drop'

export const metadata: Metadata = {
  title: 'Configuración de Plantas',
  description: 'Gestiona plantas, personal y permisos con drag and drop',
}

export default function PlantConfigurationPage() {
  return (
    <div className="container mx-auto py-6">
      <PlantConfigurationDragDrop />
    </div>
  )
} 