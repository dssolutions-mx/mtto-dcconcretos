import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ReportsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reportes</CardTitle>
        <CardDescription>Resumen mensual, uso por activos, excepciones</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          Listados y exportaciones próximamente
        </div>
      </CardContent>
    </Card>
  )
}


