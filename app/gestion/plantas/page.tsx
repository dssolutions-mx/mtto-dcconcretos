import { Metadata } from 'next'
import { PlantConfigurationDragDrop } from '@/components/plants/plant-configuration-drag-drop'

export const metadata: Metadata = {
  title: 'Gestión de Plantas',
  description: 'Configura plantas, personal y permisos con drag and drop',
}

export default function PlantasPage() {
  return <PlantConfigurationDragDrop />
} 