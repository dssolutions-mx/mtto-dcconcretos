import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { signature_data, comprehension_score } = body

    // Verify policy exists and is active
    const { data: policy, error: policyError } = await supabase
      .from('policies')
      .select('id, is_active')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (policyError || !policy) {
      return NextResponse.json({ error: 'Policy not found or inactive' }, { status: 404 })
    }

    // Check if already acknowledged
    const { data: existing } = await supabase
      .from('policy_acknowledgments')
      .select('id')
      .eq('user_id', user.id)
      .eq('policy_id', id)
      .single()

    if (existing) {
      return NextResponse.json({ 
        success: true,
        message: 'Policy already acknowledged'
      })
    }

    // Get IP and user agent from request
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     null
    const userAgent = request.headers.get('user-agent') || null

    // Create acknowledgment
    const { error: insertError } = await supabase
      .from('policy_acknowledgments')
      .insert({
        user_id: user.id,
        policy_id: id,
        ip_address: ipAddress,
        user_agent: userAgent,
        signature_data: signature_data || null,
        comprehension_score: comprehension_score || null,
        acknowledged_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Error creating policy acknowledgment:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Policy acknowledged successfully'
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
