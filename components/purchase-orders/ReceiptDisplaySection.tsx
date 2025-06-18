'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Receipt, FileText, ExternalLink, Download, Calendar, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ReceiptData {
  id: string
  file_url: string
  expense_type: string
  description: string | null
  receipt_date: string | null
  created_at: string
}

interface ReceiptDisplaySectionProps {
  purchaseOrderId: string
  poType?: string | null
}

// Helper function to format currency
function formatCurrency(amount: string | null): string {
  if (!amount) return "$0.00"
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number(amount))
}

// Helper function to format date
function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A"
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return format(date, 'dd/MM/yyyy HH:mm', { locale: es })
  } catch (error) {
    return dateString
  }
}

// Helper function to get file extension from URL
function getFileExtension(url: string): string {
  if (!url) return '';
  return url.split('.').pop()?.toLowerCase() || '';
}

// Helper function to check if a file is an image
function isImageFile(url: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const extension = getFileExtension(url);
  return imageExtensions.includes(extension);
}

// Helper function to check if a file is a PDF
function isPdfFile(url: string): boolean {
  return getFileExtension(url) === 'pdf';
}

export function ReceiptDisplaySection({ purchaseOrderId, poType }: ReceiptDisplaySectionProps) {
  const [receipts, setReceipts] = useState<ReceiptData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadReceipts = async () => {
      try {
        const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/receipts`)
        if (response.ok) {
          const data = await response.json()
          setReceipts(data)
        } else {
          setError('Error al cargar comprobantes')
        }
      } catch (err) {
        console.error('Error loading receipts:', err)
        setError('Error al cargar comprobantes')
      } finally {
        setLoading(false)
      }
    }

    loadReceipts()
  }, [purchaseOrderId])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Cargando comprobantes...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-red-600">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (receipts.length === 0) {
    return null // Don't show anything if no receipts
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Receipt className="h-5 w-5" />
          <span>Comprobantes Subidos</span>
          <Badge variant="outline">{receipts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {receipts.map((receipt) => (
          <div key={receipt.id} className="p-4 border rounded-lg bg-green-50 border-green-200 space-y-3">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                {isPdfFile(receipt.file_url) ? (
                  <FileText className="h-8 w-8 text-red-500" />
                ) : (
                  <FileText className="h-8 w-8 text-blue-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-green-800">
                  Comprobante de {poType === 'direct_purchase' ? 'Compra' : 
                                poType === 'direct_service' ? 'Servicio' : 'Pedido'}
                </p>
                <p className="text-sm text-green-600">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Subido el {formatDate(receipt.created_at)}
                </p>
                {receipt.description && (
                  <p className="text-sm text-green-600 break-words">
                    {receipt.description}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex space-x-2 justify-end">
              <Button asChild variant="outline" size="sm">
                <a 
                  href={receipt.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Ver</span>
                </a>
              </Button>
              
              <Button asChild variant="outline" size="sm">
                <a 
                  href={receipt.file_url} 
                  download={`comprobante_${receipt.id}.${getFileExtension(receipt.file_url)}`}
                  className="flex items-center space-x-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Descargar</span>
                </a>
              </Button>
            </div>
          </div>
        ))}
        
        {/* Preview for the first image if exists */}
        {receipts.length > 0 && isImageFile(receipts[0].file_url) && (
          <div className="mt-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Vista previa:</p>
            <div className="border rounded-lg overflow-hidden">
              <img 
                src={receipts[0].file_url} 
                alt="Comprobante"
                className="w-full max-w-md h-auto object-contain"
                style={{ maxHeight: '400px' }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 