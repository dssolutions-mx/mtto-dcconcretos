import { AssetRegistrationForm } from "@/components/assets/asset-registration-form"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

export default function CreateAssetPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Registrar Nuevo Activo"
        text="Complete el formulario para registrar un nuevo activo en el sistema"
      />
      <div className="grid gap-8">
        <AssetRegistrationForm />
      </div>
    </DashboardShell>
  )
}
