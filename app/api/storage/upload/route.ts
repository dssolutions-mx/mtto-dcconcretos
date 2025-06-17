import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'Storage upload API is working',
    methods: ['POST'],
    description: 'Use POST to upload files',
    status: 'OK'
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const bucket = formData.get('bucket') as string || 'asset-photos'
    const purchaseOrderId = formData.get('purchaseOrderId') as string

    console.log('=== DEBUG UPLOAD API ===')
    console.log('purchaseOrderId received:', purchaseOrderId)
    console.log('purchaseOrderId type:', typeof purchaseOrderId)
    console.log('purchaseOrderId length:', purchaseOrderId?.length)
    console.log('========================')

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      )
    }

    // Validate file type - Allow images and PDFs for purchase orders
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Solo se permiten archivos PDF, JPG, JPEG o PNG' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. Máximo 10MB' },
        { status: 400 }
      )
    }

    // Generate unique filename - use purchase-receipts bucket for PO receipts
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExt = file.name.split('.').pop()
    
    // If it's for a purchase order, use specific bucket and folder structure
    const finalBucket = purchaseOrderId ? 'receipts' : bucket
    const fileName = purchaseOrderId 
      ? `purchase-orders/${purchaseOrderId}/${timestamp}_${randomString}.${fileExt}`
      : `${timestamp}_${randomString}.${fileExt}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(finalBucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json(
        { error: `Error al subir archivo: ${error.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(finalBucket)
      .getPublicUrl(fileName)

    // If this is a purchase order receipt, save it to the purchase_order_receipts table
    if (purchaseOrderId) {
      try {
        console.log('Inserting receipt with user.id:', user.id)
        
        // Insert the receipt record
        const { error: insertError } = await supabase
          .from('purchase_order_receipts')
          .insert({
            purchase_order_id: purchaseOrderId,
            file_url: urlData.publicUrl,
            expense_type: 'materials', // Default to materials, can be customized later
            description: `Comprobante subido el ${new Date().toLocaleDateString()}`,
            receipt_date: new Date().toISOString(),
            uploaded_by: user.id // This should be the authenticated user ID
          })

        if (insertError) {
          console.error('Error inserting receipt record:', insertError)
          console.error('Insert error details:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint
          })
          
          // Return the error details to help debug
          return NextResponse.json(
            { 
              error: `Error al guardar comprobante en base de datos: ${insertError.message}`,
              details: insertError
            },
            { status: 500 }
          )
        } else {
          console.log('Receipt record inserted successfully')
          
          // Update the purchase order to mark receipt as uploaded
          const { error: updateError } = await supabase
            .from('purchase_orders')
            .update({
              receipt_uploaded: true,
              updated_at: new Date().toISOString(),
              updated_by: user.id
            })
            .eq('id', purchaseOrderId)

          if (updateError) {
            console.error('Error updating purchase order:', updateError)
          }
        }
      } catch (dbError) {
        console.error('Database operation error:', dbError)
        return NextResponse.json(
          { 
            error: `Error en operación de base de datos: ${dbError}`,
            details: dbError
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      url: urlData.publicUrl,
      path: fileName,
      bucket: finalBucket,
      message: 'Archivo subido exitosamente',
      purchaseOrderId: purchaseOrderId || null
    })

  } catch (error: any) {
    console.error('Upload API error:', error)
    return NextResponse.json(
      { error: `Error interno del servidor: ${error.message}` },
      { status: 500 }
    )
  }
} 