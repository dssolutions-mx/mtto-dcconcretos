import { Metadata } from 'next'
import { PersonnelManagementDragDrop } from '@/components/personnel/personnel-management-drag-drop'

export const metadata: Metadata = {
  title: 'Gestión de Personal',
  description: 'Administra operadores y personal de planta con drag and drop',
}

export default function PersonalPage() {
  return <PersonnelManagementDragDrop />
} 