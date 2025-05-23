"use client"

import { Control } from "react-hook-form"
import { DollarSign, FileText, FileUp, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DateInput } from "@/components/ui/date-input"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FormValues {
  assetId: string
  name: string
  serialNumber: string
  location: string
  department: string
  purchaseDate: Date
  installationDate?: Date
  initialHours: string
  currentHours: string
  status: string
  notes?: string
  warrantyExpiration?: Date
  isNew: boolean
  registrationInfo?: string
  purchaseCost?: number
  insurancePolicy?: string
  insuranceCoverage?: {
    startDate?: Date
    endDate?: Date
  }
  maintenanceHistory?: {
    date: Date
    type: string
    description: string
    technician: string
    cost?: string
    parts?: {
      name: string
      partNumber?: string
      quantity: number
      cost?: string
    }[]
  }[]
}

interface InsuranceDocument {
  name: string
  file: File | null
  url?: string
}

interface FinancialInfoTabProps {
  control: Control<FormValues>
  insuranceDocuments: InsuranceDocument[]
  addInsuranceDocument: (file: File) => void
  removeInsuranceDocument: (index: number) => void
}

export function FinancialInfoTab({
  control,
  insuranceDocuments,
  addInsuranceDocument,
  removeInsuranceDocument,
}: FinancialInfoTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información Financiera</CardTitle>
        <CardDescription>Detalles financieros y de seguros del activo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={control}
          name="purchaseCost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Costo de Adquisición</FormLabel>
              <FormControl>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00" 
                    className="pl-8" 
                    value={field.value || ""}
                    onChange={(e) => {
                      const value = e.target.value
                      field.onChange(value === "" ? undefined : parseFloat(value))
                    }}
                  />
                </div>
              </FormControl>
              <FormDescription>Costo de adquisición del activo</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="insurancePolicy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número de Póliza de Seguro</FormLabel>
              <FormControl>
                <Input placeholder="POL-12345678" {...field} />
              </FormControl>
              <FormDescription>Número de póliza de seguro del activo</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="insuranceCoverage.startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Inicio de Cobertura</FormLabel>
                <FormControl>
                  <DateInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="dd/mm/aaaa"
                  />
                </FormControl>
                <FormDescription>Fecha de inicio de la cobertura del seguro</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="insuranceCoverage.endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fin de Cobertura</FormLabel>
                <FormControl>
                  <DateInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="dd/mm/aaaa"
                  />
                </FormControl>
                <FormDescription>Fecha de finalización de la cobertura del seguro</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <Label>Documentos de Seguro</Label>
          <div className="space-y-2">
            {insuranceDocuments.map((doc, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{doc.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeInsuranceDocument(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                type="file"
                id="insuranceDoc"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    addInsuranceDocument(e.target.files[0])
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("insuranceDoc")?.click()}
                className="w-full"
              >
                <FileUp className="mr-2 h-4 w-4" />
                Subir documento de seguro
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 