import { Metadata } from 'next'
import { GestionPersonalView } from '@/components/personnel/gestion-personal-view'

export const metadata: Metadata = {
  title: 'Gestión de Personal',
  description: 'Administra empleados y roles con drag and drop',
}

export default function PersonalPage() {
  return <GestionPersonalView />
}
