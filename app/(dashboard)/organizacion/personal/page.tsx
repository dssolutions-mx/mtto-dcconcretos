import { Metadata } from 'next'
import { GestionPersonalView } from '@/components/personnel/gestion-personal-view'

export const metadata: Metadata = {
  title: 'Gestión de Personal',
  description: 'Administra operadores y personal de planta con drag and drop',
}

export default function OrganizacionPersonalPage() {
  return <GestionPersonalView />
}
