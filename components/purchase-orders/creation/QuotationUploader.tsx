"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, X, Upload, AlertCircle, CheckCircle2, Image as ImageIcon } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface UploadedFile {
  file: File
  url: string
  path: string
  isUploading?: boolean
}

interface QuotationUploaderProps {
  workOrderId?: string
  isRequired?: boolean
  onFileUploaded?: (url: string) => void  // Legacy: single file callback
  onFilesUploaded?: (urls: string[]) => void  // New: multiple files callback
  onFileRemoved?: () => void
  className?: string
  allowMultiple?: boolean  // Enable multiple file uploads (default: true)
}

export function QuotationUploader({ 
  workOrderId, 
  isRequired = false, 
  onFileUploaded, 
  onFilesUploaded,
  onFileRemoved,
  className = "",
  allowMultiple = true
}: QuotationUploaderProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const filesToUpload = Array.from(files)
    setUploadError(null)
    
    // Validate all files before uploading
    for (const file of filesToUpload) {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp'
      ]
      
      if (!allowedTypes.includes(file.type)) {
        setUploadError(`${file.name}: Solo se permiten archivos PDF, JPG, PNG o WebP`)
        return
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`${file.name}: El archivo no puede ser mayor a 10MB`)
        return
      }
    }

    // If only single file allowed, clear existing files
    if (!allowMultiple && uploadedFiles.length > 0) {
      // Remove existing file
      await Promise.all(uploadedFiles.map(f => removeFileFromStorage(f.path)))
      setUploadedFiles([])
    }

    // Upload all files
    await uploadFiles(filesToUpload)
    
    // Reset file input
    e.target.value = ''
  }

  // Function to sanitize filename for storage
  const sanitizeFileName = (fileName: string): string => {
    const lastDotIndex = fileName.lastIndexOf('.')
    let baseName = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName
    let extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex + 1) : ''
    
    let sanitizedBaseName = baseName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9\-_]/g, '')
      .replace(/[\-_]{2,}/g, '_')
      .replace(/^[\-_]+|[\-_]+$/g, '')
    
    let sanitizedExtension = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    
    if (!sanitizedBaseName || sanitizedBaseName.length === 0) {
      sanitizedBaseName = `document_${Date.now()}`
    }
    
    if (!sanitizedExtension || sanitizedExtension.length === 0) {
      const originalExt = fileName.split('.').pop()?.toLowerCase()
      if (originalExt && ['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(originalExt)) {
        sanitizedExtension = originalExt
      } else {
        sanitizedExtension = 'pdf'
      }
    }
    
    return `${sanitizedBaseName}.${sanitizedExtension}`
  }

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true)
    setUploadError(null)

    try {
      const supabase = createClient()
      
      // Check authentication first
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('Usuario no autenticado. Por favor, inicie sesión.')
      }
      
      const uploadedUrls: string[] = []
      
      for (const file of files) {
        try {
          // Create appropriate folder structure
          const folderName = workOrderId || `standalone-po-${Date.now()}`
          const sanitizedFileName = sanitizeFileName(file.name)
          const fileName = `${folderName}/${Date.now()}_${sanitizedFileName}`
          
          // Upload to quotations bucket
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('quotations')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: true
            })
            
          if (uploadError) {
            console.error('Storage upload error:', uploadError)
            throw new Error(`Error al subir ${file.name}: ${uploadError.message}`)
          }
          
          if (!uploadData?.path) {
            throw new Error(`No se recibió confirmación de upload para ${file.name}`)
          }
          
          // Create signed URL for private bucket
          const { data: signedUrlData, error: urlError } = await supabase.storage
            .from('quotations')
            .createSignedUrl(uploadData.path, 3600 * 24 * 7) // 7 days expiry
            
          if (urlError) {
            console.error('Signed URL error:', urlError)
            throw new Error(`Error al generar URL de ${file.name}: ${urlError.message}`)
          }
          
          const signedUrl = signedUrlData?.signedUrl
          
          if (signedUrl) {
            uploadedUrls.push(signedUrl)
            
            // Add to uploaded files list
            setUploadedFiles(prev => [...prev, {
              file,
              url: signedUrl,
              path: uploadData.path
            }])
          }
        } catch (fileError: any) {
          console.error(`Error uploading ${file.name}:`, fileError)
          setUploadError(fileError.message || `Error al subir ${file.name}`)
        }
      }
      
      // Call callbacks with uploaded URLs
      if (uploadedUrls.length > 0) {
        if (onFilesUploaded) {
          // Get all current URLs including new ones
          const allUrls = [...uploadedFiles.map(f => f.url), ...uploadedUrls]
          onFilesUploaded(allUrls)
        }
        
        // Legacy single file callback (for backwards compatibility)
        if (onFileUploaded && uploadedUrls.length > 0) {
          onFileUploaded(uploadedUrls[0])
        }
      }
      
    } catch (error: any) {
      console.error('Error uploading quotations:', error)
      
      let errorMessage = 'Error al subir los archivos'
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

  const removeFileFromStorage = async (filePath: string) => {
    try {
      const supabase = createClient()
      await supabase.storage
        .from('quotations')
        .remove([filePath])
    } catch (error) {
      console.error('Error removing file from storage:', error)
    }
  }

  const removeFile = async (index: number) => {
    const fileToRemove = uploadedFiles[index]
    
    if (fileToRemove) {
      // Remove from storage
      await removeFileFromStorage(fileToRemove.path)
      
      // Remove from state
      const newFiles = uploadedFiles.filter((_, i) => i !== index)
      setUploadedFiles(newFiles)
      
      // Update callbacks
      if (onFilesUploaded) {
        onFilesUploaded(newFiles.map(f => f.url))
      }
      
      if (newFiles.length === 0 && onFileRemoved) {
        onFileRemoved()
      }
    }
  }

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') {
      return <FileText className="h-4 w-4 text-red-500" />
    }
    return <ImageIcon className="h-4 w-4 text-blue-500" />
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
              {allowMultiple ? 'Cotizaciones' : 'Cotización'} {isRequired && <span className="text-red-500">*</span>}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRequired && uploadedFiles.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este tipo de orden de compra requiere {allowMultiple ? 'una o más cotizaciones' : 'una cotización'} formal del proveedor.
              </AlertDescription>
            </Alert>
          )}

          {/* File Input */}
          <div className="space-y-3">
            <Label htmlFor="quotation-files">
              {allowMultiple ? 'Subir Archivos de Cotización' : 'Subir Archivo de Cotización'}
            </Label>
            <div className="flex items-center space-x-3">
              <Input
                id="quotation-files"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                multiple={allowMultiple}
                className="flex-1"
                disabled={isUploading}
              />
              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>PDF, JPG, PNG</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tamaño máximo: 10MB por archivo. Formatos: PDF, JPG, PNG, WebP
              {allowMultiple && ' • Puede subir múltiples archivos'}
            </p>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Archivos Subidos ({uploadedFiles.length})</Label>
              {uploadedFiles.map((uploadedFile, index) => (
                <div key={index} className="p-3 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate" title={uploadedFile.file.name}>
                          {uploadedFile.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(uploadedFile.file.size)} • Subido exitosamente
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a 
                          href={uploadedFile.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs"
                        >
                          Ver
                        </a>
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={isUploading}
                        className="h-8 w-8 p-0"
                        title="Eliminar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
              </div>
              <p className="text-xs text-muted-foreground text-center">Subiendo archivos...</p>
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {/* Drop Zone (shown when no files uploaded) */}
          {uploadedFiles.length === 0 && !isUploading && (
            <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-2">
                Arrastra y suelta {allowMultiple ? 'archivos' : 'un archivo'} aquí, o
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('quotation-files')?.click()}
                disabled={isUploading}
              >
                Seleccionar {allowMultiple ? 'Archivos' : 'Archivo'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 
