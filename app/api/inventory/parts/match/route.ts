import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { InventoryService } from '@/lib/services/inventory-service'

/**
 * GET /api/inventory/parts/match?part_number=X&name=Y
 * Returns best catalog match(es) for a task part (from maintenance intervals).
 * Used when pre-loading task parts in the maintenance plan work order flow.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const part_number = searchParams.get('part_number')?.trim() || ''
    const name = searchParams.get('name')?.trim() || ''

    if (!part_number && !name) {
      return NextResponse.json(
        { success: false, error: 'part_number or name parameter is required' },
        { status: 400 }
      )
    }

    let matches: Awaited<ReturnType<typeof InventoryService.searchPartsByNumber>> = []

    // 1. Primary: search by part_number (exact/normalized)
    if (part_number) {
      matches = await InventoryService.searchPartsByNumber(part_number)
      // Prefer exact part_number match
      const exactMatch = matches.find(
        (p) => p.part_number?.toLowerCase() === part_number.toLowerCase()
      )
      if (exactMatch) {
        return NextResponse.json({
          success: true,
          matched: exactMatch,
          candidates: matches.slice(0, 5),
        })
      }
    }

    // 2. Fallback: search by name if part_number empty or no match
    if (matches.length === 0 && name) {
      matches = await InventoryService.searchPartsByNumber(name)
    }

    // Return best candidate if any
    const best = matches[0] ?? null
    return NextResponse.json({
      success: true,
      matched: best,
      candidates: matches.slice(0, 5),
    })
  } catch (error) {
    console.error('Error matching part:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to match part',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
