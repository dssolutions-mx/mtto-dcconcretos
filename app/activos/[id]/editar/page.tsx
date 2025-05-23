import { AssetEditForm } from "@/components/assets/asset-edit-form"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

interface EditAssetPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditAssetPage({ params }: EditAssetPageProps) {
  const { id } = await params
  
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Editar Activo"
        text="Modifique la información del activo según sea necesario"
      />
      <div className="grid gap-8">
        <AssetEditForm assetId={id} />
      </div>
    </DashboardShell>
  )
}