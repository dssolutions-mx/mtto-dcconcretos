import { AssetRegistrationFormModular } from "@/components/assets/asset-registration-form-modular"

export default function CreateAssetPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Registrar Nuevo Activo</h1>
        <p className="text-muted-foreground">Complete la información del nuevo activo</p>
      </div>
      <AssetRegistrationFormModular />
    </div>
  )
}
