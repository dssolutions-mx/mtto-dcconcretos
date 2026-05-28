import { ReportsSubNav } from '@/components/reports/reports-subnav'

export default function ReportesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-0">
      <ReportsSubNav />
      <div className="flex-1">{children}</div>
    </div>
  )
}
