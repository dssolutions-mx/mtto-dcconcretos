const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('Supabase URL:', supabaseUrl)
console.log('Service Key exists:', !!supabaseServiceKey)

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupStorage() {
  try {
    console.log('Setting up Supabase Storage...')
    
    // Check if profiles bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      return
    }
    
    console.log('Existing buckets:', buckets.map(b => b.name))
    
    // Check if profiles bucket exists
    const profilesBucket = buckets.find(bucket => bucket.name === 'profiles')
    
    if (profilesBucket) {
      console.log('✅ Profiles bucket already exists')
      // Ensure bucket privacy and constraints follow best practices
      const { error: updateBucketError } = await supabase.storage.updateBucket('profiles', {
        public: false,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
        fileSizeLimit: 5242880
      })
      if (updateBucketError) {
        console.warn('⚠️ Could not update profiles bucket settings:', updateBucketError.message)
      } else {
        console.log('🔒 Profiles bucket set to private and constraints updated')
      }
    } else {
      // Create profiles bucket
      const { data, error } = await supabase.storage.createBucket('profiles', {
        public: false,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      })
      
      if (error) {
        console.error('Error creating profiles bucket:', error)
        return
      }
      
      console.log('✅ Profiles bucket created successfully')
    }
    
    // Test upload permissions
    const testFile = new Blob(['test'], { type: 'text/plain' })
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profiles')
      .upload('test/test.txt', testFile)
    
    if (uploadError) {
      console.error('Error testing upload:', uploadError)
    } else {
      console.log('✅ Upload test successful')
      // Clean up test file
      await supabase.storage.from('profiles').remove(['test/test.txt'])
    }
    
    console.log('Storage setup completed!')
    
  } catch (error) {
    console.error('Setup error:', error)
  }
}

setupStorage()
