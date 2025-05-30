import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const assetData = await request.json()
    
    // Validate required fields
    if (!assetData.asset_id || !assetData.name) {
      return NextResponse.json(
        { error: 'Asset ID and name are required' },
        { status: 400 }
      )
    }

    // Check if asset ID already exists
    const { data: existingAsset } = await supabase
      .from('assets')
      .select('id')
      .eq('asset_id', assetData.asset_id)
      .single()

    if (existingAsset) {
      return NextResponse.json(
        { error: `Asset ID '${assetData.asset_id}' already exists` },
        { status: 409 }
      )
    }

    // Get current user for tracking
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Prepare asset data with user tracking
    const assetDataToInsert = {
      ...assetData,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: user.id
    }

    // Insert the asset
    const { data: insertedAsset, error: insertError } = await supabase
      .from('assets')
      .insert([assetDataToInsert])
      .select('*')
      .single()

    if (insertError) {
      console.error('Error inserting asset:', insertError)
      return NextResponse.json(
        { error: `Failed to create asset: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      asset: insertedAsset,
      message: `Asset '${insertedAsset.name}' created successfully`
    })

  } catch (error: any) {
    console.error('Error in asset registration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 