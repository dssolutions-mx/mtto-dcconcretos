import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ReconciliationTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conciliación</CardTitle>
        <CardDescription>Conteos físicos y ajustes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          Flujo de conciliación mensual próximamente
        </div>
      </CardContent>
    </Card>
  )
}


