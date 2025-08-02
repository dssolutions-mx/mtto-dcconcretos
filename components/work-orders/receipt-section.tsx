"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase"
import { UploadCloud, FileText, ExternalLink, Download, Receipt, AlertTriangle } from "lucide-react"
import { ReceiptUploader } from "./receipt-uploader"

interface ReceiptSectionProps {
  purchaseOrderId: string
  isAdjustment: boolean
}

export function ReceiptSection({ purchaseOrderId, isAdjustment }: ReceiptSectionProps) {
  const [receipts, setReceipts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>(isAdjustment ? "upload" : "view")
  const isMounted = useRef(true)
  
  // Set up cleanup for component unmount
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  // Load existing receipts
  useEffect(() => {
    let isCancelled = false;
    async function loadReceipts() {
      try {
        setIsLoading(true)
        const supabase = createClient()
        
        const { data, error } = await (supabase as any)
          .from('purchase_order_receipts')
          .select('*')
          .eq('purchase_order_id', purchaseOrderId)
          .order('created_at', { ascending: false })
        
        if (error) throw error
        
        // Only update state if not cancelled and component is mounted
        if (!isCancelled && isMounted.current) {
          setReceipts(data || [])
        }
      } catch (error) {
        console.error("Error loading receipts:", error)
      } finally {
        // Only update state if not cancelled and component is mounted
        if (!isCancelled && isMounted.current) {
          setIsLoading(false)
        }
      }
    }
    
    loadReceipts()
    
    // Cleanup function
    return () => {
      isCancelled = true;
    }
  }, [purchaseOrderId])
  
  // Handle successful upload
  const handleUploadSuccess = () => {
    // Only proceed if component is still mounted
    if (!isMounted.current) return;
    
    // Refresh the receipts list
    const supabaseClient = createClient()
    ;(supabaseClient as any)
      .from('purchase_order_receipts')
      .select('*')
      .eq('purchase_order_id', purchaseOrderId)
      .order('created_at', { ascending: false })
      .then(({ data, error }: { data: any, error: any }) => {
        // Only update state if component is still mounted
        if (!error && data && isMounted.current) {
          setReceipts(data)
          // Switch to view tab after successful upload
          setActiveTab('view')
        }
      })
      .catch((error: any) => {
        console.error("Error refreshing receipts:", error)
      })
  }
  
  // Helper function to get file name from URL
  const getFileName = (url: string) => {
    return url.split('/').pop() || 'archivo';
  }
  
  // Helper function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>
          {isAdjustment 
            ? "Comprobantes de Gastos Adicionales" 
            : "Comprobantes y Facturas"}
        </CardTitle>
        <CardDescription>
          {isAdjustment 
            ? "Gestión de comprobantes para gastos adicionales, incluyendo mano de obra" 
            : "Gestión de comprobantes y facturas para esta orden de compra"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="view">
              Ver Comprobantes
              {receipts.length > 0 && (
                <span className="ml-2 bg-primary rounded-full w-5 h-5 inline-flex items-center justify-center text-[11px] text-white">
                  {receipts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upload">
              <UploadCloud className="mr-2 h-4 w-4" />
              Cargar Nuevo
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="view" className="mt-0">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Cargando comprobantes...</p>
              </div>
            ) : receipts.length > 0 ? (
              <div className="space-y-4">
                {receipts.map((receipt) => (
                  <div 
                    key={receipt.id} 
                    className="flex items-start gap-4 p-4 border rounded-md"
                  >
                    <div className="flex-shrink-0">
                      {receipt.expense_type === 'labor' ? (
                        <Receipt className="h-8 w-8 text-blue-500" />
                      ) : (
                        <FileText className="h-8 w-8 text-green-500" />
                      )}
                    </div>
                    <div className="flex-grow">
                      <div className="flex justify-between">
                        <h4 className="font-medium text-sm">
                          {receipt.expense_type === 'labor' ? 'Comprobante de Mano de Obra' : 'Comprobante de Gasto'}
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(receipt.created_at)}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{receipt.description}</p>
                      <div className="mt-2 flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={receipt.file_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Ver
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={receipt.file_url} download={getFileName(receipt.file_url)}>
                            <Download className="h-3 w-3 mr-1" />
                            Descargar
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 border border-dashed rounded-md">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-center text-muted-foreground">No hay comprobantes registrados.</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => setActiveTab("upload")}
                >
                  <UploadCloud className="h-4 w-4 mr-2" />
                  Cargar Primer Comprobante
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="upload" className="mt-0">
            <ReceiptUploader 
              purchaseOrderId={purchaseOrderId}
              isAdjustment={isAdjustment}
              onSuccess={handleUploadSuccess}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
} 