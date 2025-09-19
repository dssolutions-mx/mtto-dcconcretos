import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function OverviewTab({ plantId }: { plantId: string | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen</CardTitle>
        <CardDescription>Balances y uso reciente por planta</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          {plantId ? `Planta actual: ${plantId}` : "Acceso multi-planta"}
        </div>
      </CardContent>
    </Card>
  )
}


