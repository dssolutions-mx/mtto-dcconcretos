/**
 * Script to upload policy PDF to Supabase Storage
 * 
 * Usage:
 *   npx tsx scripts/upload-policy-pdf.ts
 * 
 * Or with environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npx tsx scripts/upload-policy-pdf.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function uploadPolicyPDF() {
  try {
    // Find the PDF file
    const pdfPath = path.join(process.cwd(), 'POL-OPE-001. POLITICA DE MANTENIMIENTO. (2).pdf')
    const targetFileName = 'POL-OPE-001.pdf'

    if (!fs.existsSync(pdfPath)) {
      console.error(`❌ PDF file not found at: ${pdfPath}`)
      console.error('Please ensure the PDF file is in the project root directory')
      process.exit(1)
    }

    console.log(`📄 Found PDF: ${pdfPath}`)
    console.log(`📤 Uploading to bucket: policies/${targetFileName}...`)

    // Read the file
    const fileBuffer = fs.readFileSync(pdfPath)
    
    // Upload to Supabase Storage (use Buffer directly)
    const { data, error } = await supabase.storage
      .from('policies')
      .upload(targetFileName, fileBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true // Overwrite if exists
      })

    if (error) {
      console.error('❌ Upload error:', error)
      process.exit(1)
    }

    console.log('✅ File uploaded successfully!')
    console.log('📦 Upload data:', data)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('policies')
      .getPublicUrl(targetFileName)

    const publicUrl = urlData.publicUrl
    console.log('🔗 Public URL:', publicUrl)

    // Update database
    console.log('💾 Updating database...')
    const { error: updateError } = await supabase
      .from('policies')
      .update({ document_url: publicUrl })
      .eq('code', 'POL-OPE-001')

    if (updateError) {
      console.error('❌ Database update error:', updateError)
      console.log('⚠️  Please update manually:')
      console.log(`UPDATE policies SET document_url = '${publicUrl}' WHERE code = 'POL-OPE-001';`)
      process.exit(1)
    }

    console.log('✅ Database updated successfully!')
    console.log('\n🎉 Policy PDF is now available at:')
    console.log(`   ${publicUrl}`)
    console.log('\n✅ Setup complete!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

uploadPolicyPDF()
