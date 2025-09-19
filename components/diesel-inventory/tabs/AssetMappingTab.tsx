import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function AssetMappingTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapeo de Activos</CardTitle>
        <CardDescription>Resolver nombres y crear mapeos manuales</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          Interfaz de mapeo y revisión de excepciones próximamente
        </div>
      </CardContent>
    </Card>
  )
}


