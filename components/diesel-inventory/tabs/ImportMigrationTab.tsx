import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExcelImport } from "@/components/diesel-inventory/migration/ExcelImport"
import { CsvImportAndMap } from "@/components/diesel-inventory/migration/CsvImportAndMap"

export function ImportMigrationTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Importación y Migración</CardTitle>
        <CardDescription>Herramienta temporal para migrar datos del sistema anterior</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ExcelImport />
        <CsvImportAndMap />
      </CardContent>
    </Card>
  )
}


