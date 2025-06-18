"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, X, Upload, AlertCircle, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface QuotationUploaderProps {
  workOrderId: string
  isRequired?: boolean
  onFileUploaded?: (url: string) => void
  onFileRemoved?: () => void
  className?: string
}

export function QuotationUploader({ 
  workOrderId, 
  isRequired = false, 
  onFileUploaded, 
  onFileRemoved,
  className = ""
}: QuotationUploaderProps) {
  const [quotationFile, setQuotationFile] = useState<File | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Solo se permiten archivos PDF, JPG, PNG o WebP')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('El archivo no puede ser mayor a 10MB')
      return
    }

    setQuotationFile(file)
    setUploadError(null)
    
    // Auto upload
    await uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    setIsUploading(true)
    setUploadError(null)

    try {
      const supabase = createClient()
      
      // Check authentication first
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('Usuario no autenticado. Por favor, inicie sesión.')
      }
      
      const fileName = `${workOrderId}/${Date.now()}_${file.name}`
      
      // ✅ FIXED: Using correct 'quotations' bucket instead of 'documents'
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('quotations')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        })
        
      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw new Error(`Error al subir la cotización: ${uploadError.message}`)
      }
      
      if (!uploadData?.path) {
        throw new Error('No se recibió confirmación de upload del servidor')
      }
      
      // ✅ FIXED: For private bucket, create signed URL instead of public URL
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('quotations')
        .createSignedUrl(uploadData.path, 3600 * 24 * 7) // 7 days expiry
        
      if (urlError) {
        console.error('Signed URL error:', urlError)
        throw new Error(`Error al generar URL de cotización: ${urlError.message}`)
      }
      
      const signedUrl = signedUrlData?.signedUrl || null
      
      if (signedUrl) {
        setUploadedUrl(signedUrl)
        onFileUploaded?.(signedUrl)
      }
      
    } catch (error: any) {
      console.error('Error uploading quotation:', error)
      
      // Provide more specific error messages
      let errorMessage = 'Error al subir el archivo'
      if (error.message.includes('row-level security')) {
        errorMessage = 'Error de permisos. Verifique que esté autenticado correctamente.'
      } else if (error.message.includes('violates check constraint')) {
        errorMessage = 'Archivo no válido. Solo se permiten PDF, JPG, PNG y WebP.'
      } else if (error.message.includes('Payload too large')) {
        errorMessage = 'Archivo muy grande. Tamaño máximo permitido: 10MB.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      setUploadError(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  const removeFile = async () => {
    if (uploadedUrl && quotationFile) {
      try {
        const supabase = createClient()
        const fileName = `${workOrderId}/${quotationFile.name}`
        
        // Try to remove the file from storage
        await supabase.storage
          .from('quotations')
          .remove([fileName])
      } catch (error) {
        console.error('Error removing file from storage:', error)
      }
    }
    
    setQuotationFile(null)
    setUploadedUrl(null)
    setUploadError(null)
    onFileRemoved?.()
    
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  const getFileIcon = () => {
    if (!quotationFile) return <Upload className="h-4 w-4" />
    
    if (quotationFile.type === 'application/pdf') {
      return <FileText className="h-4 w-4 text-red-500" />
    }
    
    return <FileText className="h-4 w-4 text-blue-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>
              Cotización {isRequired && <span className="text-red-500">*</span>}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRequired && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este tipo de orden de compra requiere una cotización formal del proveedor.
              </AlertDescription>
            </Alert>
          )}

          {!quotationFile && !uploadedUrl ? (
            <div className="space-y-3">
              <Label htmlFor="quotation-file">
                Subir Archivo de Cotización
              </Label>
              <div className="flex items-center space-x-3">
                <Input
                  id="quotation-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                  {getFileIcon()}
                  <span>PDF, JPG, PNG</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Tamaño máximo: 10MB. Formatos: PDF, JPG, PNG, WebP
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Label>Archivo de Cotización</Label>
              
              <div className="p-3 border rounded-lg bg-green-50 border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {uploadedUrl ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      getFileIcon()
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {quotationFile?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {quotationFile && formatFileSize(quotationFile.size)}
                        {uploadedUrl && " • Subido exitosamente"}
                        {isUploading && " • Subiendo..."}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {uploadedUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a 
                          href={uploadedUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs"
                        >
                          Ver
                        </a>
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeFile}
                      disabled={isUploading}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {isUploading && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Subiendo archivo...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {uploadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {!quotationFile && !uploadedUrl && (
            <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-2">
                Arrastra y suelta un archivo aquí, o
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('quotation-file')?.click()}
              >
                Seleccionar Archivo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 