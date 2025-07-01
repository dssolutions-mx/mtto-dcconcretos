import { Metadata } from 'next'
import { AssetPlantAssignmentDragDrop } from '@/components/assets/asset-plant-assignment-drag-drop'

export const metadata: Metadata = {
  title: 'Asignación de Activos a Plantas',
  description: 'Asigna activos a plantas usando drag and drop con vista jerárquica por unidades de negocio',
}

export default function AsignacionActivosPlantasPage() {
  return <AssetPlantAssignmentDragDrop />
} 