import { IngresosGastosAccessGuard } from '@/components/reports/ingresos-gastos-access-guard'

export default function IngresosGastosLayout({ children }: { children: React.ReactNode }) {
  return <IngresosGastosAccessGuard>{children}</IngresosGastosAccessGuard>
}
