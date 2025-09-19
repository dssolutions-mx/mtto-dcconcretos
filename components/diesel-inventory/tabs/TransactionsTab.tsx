import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function TransactionsTab({ plantId }: { plantId: string | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transacciones</CardTitle>
        <CardDescription>Registro y consulta de movimientos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          Tabla y formulario de transacciones próximamente
        </div>
      </CardContent>
    </Card>
  )
}


