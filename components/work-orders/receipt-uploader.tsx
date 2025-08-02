"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase"
import { toast } from "@/components/ui/use-toast"
import { Loader2, UploadCloud } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ReceiptUploaderProps {
  purchaseOrderId: string
  isAdjustment: boolean
  onSuccess?: () => void
}

export function ReceiptUploader({ purchaseOrderId, isAdjustment, onSuccess }: ReceiptUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [expenseType, setExpenseType] = useState("materials") // "materials" or "labor"
  const [description, setDescription] = useState("")
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor selecciona un archivo",
      })
      return
    }

    try {
      setIsUploading(true)
      const supabase = createClient()
      
      // Upload file to storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${purchaseOrderId}-${Date.now()}.${fileExt}`
      const filePath = `purchase_orders/${purchaseOrderId}/${fileName}`
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('receipts')
        .upload(filePath, file)
      
      if (uploadError) throw uploadError
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath)
      
      // Get current user ID before continuing
      const { data: userData } = await supabase.auth.getUser()
      
      // Add receipt record to database
      const { error: insertError } = await (supabase as any)
        .from('purchase_order_receipts')
        .insert({
          purchase_order_id: purchaseOrderId,
          file_url: publicUrl,
          expense_type: expenseType,
          description: description,
          is_adjustment_receipt: isAdjustment,
          uploaded_by: userData?.user?.id,
          created_at: new Date().toISOString()
        })
      
      if (insertError) throw insertError
      
      // Update the purchase order status if needed
      if (isAdjustment) {
        // Update the purchase order to indicate receipt was uploaded
        const { error: updateError } = await supabase
          .from('purchase_orders')
          .update({
            receipt_uploaded: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', purchaseOrderId)
          
        if (updateError) throw updateError
      }
      
      // Only update state and call callbacks if component is still mounted
      if (isMounted.current) {
        toast({
          title: "Éxito",
          description: `El comprobante ha sido cargado exitosamente`,
        })
        
        // Reset form
        setFile(null)
        setDescription("")
        
        // Call success callback if provided
        if (onSuccess) onSuccess()
      }
      
    } catch (error) {
      console.error("Error uploading receipt:", error)
      
      // Only show error toast if component is still mounted
      if (isMounted.current) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar el comprobante. Por favor intenta nuevamente.",
        })
      }
    } finally {
      // Only update state if component is still mounted
      if (isMounted.current) {
        setIsUploading(false)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isAdjustment 
            ? "Cargar Comprobante para Gasto Adicional" 
            : "Cargar Comprobante de Compra"}
        </CardTitle>
        <CardDescription>
          {isAdjustment 
            ? "Carga los comprobantes de los gastos adicionales o mano de obra para esta orden de ajuste" 
            : "Carga el comprobante o factura asociada a esta orden de compra"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {isAdjustment && (
            <div className="space-y-2">
              <Label>Tipo de Gasto</Label>
              <RadioGroup 
                defaultValue="materials" 
                value={expenseType}
                onValueChange={setExpenseType}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="materials" id="materials" />
                  <Label htmlFor="materials">Materiales o Servicios</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="labor" id="labor" />
                  <Label htmlFor="labor">Mano de Obra</Label>
                </div>
              </RadioGroup>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea 
              id="description"
              placeholder={isAdjustment 
                ? expenseType === "labor" 
                  ? "Descripción del trabajo realizado..." 
                  : "Descripción del gasto adicional..."
                : "Descripción del comprobante o factura..."
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="file">Archivo</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center">
              <UploadCloud className="h-10 w-10 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 mb-2">
                {file ? file.name : "Arrastra y suelta o haz clic para seleccionar"}
              </p>
              <Input
                id="file"
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("file")?.click()}
              >
                Seleccionar Archivo
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Formatos aceptados: JPG, PNG, PDF
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={isUploading || !file}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando...
              </>
            ) : (
              "Subir Comprobante"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
} 