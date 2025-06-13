import { Metadata } from 'next'
import { PersonnelManagementDragDrop } from '@/components/personnel/personnel-management-drag-drop'

export const metadata: Metadata = {
  title: 'Gestión de Personal',
  description: 'Administra empleados y roles con drag and drop',
}

export default function PersonalPage() {
  return <PersonnelManagementDragDrop />
} 