import type { Metadata } from 'next'
import { GestionDepartamentosView } from '@/components/departments/gestion-departamentos-view'

export const metadata: Metadata = {
  title: 'Departamentos de ruteo | Sistema de Mantenimiento',
  description: 'Membresías de personal en departamentos canónicos para ruteo de incidencias y SLA.',
}

export default function GestionDepartamentosPage() {
  return <GestionDepartamentosView />
}
