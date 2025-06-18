import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Get all receipts with their purchase order and file URL
    const { data: receipts, error: fetchError } = await supabase
      .from('purchase_order_receipts')
      .select('id, purchase_order_id, file_url, created_at')
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('Error fetching receipts:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 })
    }

    // Group receipts by purchase_order_id and file_url
    const groupedReceipts = new Map<string, any[]>()
    
    receipts.forEach(receipt => {
      const key = `${receipt.purchase_order_id}-${receipt.file_url}`
      if (!groupedReceipts.has(key)) {
        groupedReceipts.set(key, [])
      }
      groupedReceipts.get(key)!.push(receipt)
    })

    // Find duplicates and keep only the first one (oldest)
    const duplicatesToDelete: string[] = []
    let duplicateGroupsFound = 0

    groupedReceipts.forEach((receiptGroup, key) => {
      if (receiptGroup.length > 1) {
        duplicateGroupsFound++
        // Keep the first (oldest) receipt, mark others for deletion
        const [keepReceipt, ...duplicates] = receiptGroup
        duplicates.forEach(duplicate => {
          duplicatesToDelete.push(duplicate.id)
        })
      }
    })

    // Delete duplicates
    let deletedCount = 0
    if (duplicatesToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('purchase_order_receipts')
        .delete()
        .in('id', duplicatesToDelete)

      if (deleteError) {
        console.error('Error deleting duplicate receipts:', deleteError)
        return NextResponse.json({ error: 'Failed to delete duplicates' }, { status: 500 })
      }
      
      deletedCount = duplicatesToDelete.length
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed successfully`,
      details: {
        duplicate_groups_found: duplicateGroupsFound,
        duplicates_deleted: deletedCount,
        total_receipts_checked: receipts.length
      }
    })

  } catch (error) {
    console.error('Error in cleanup-duplicate-receipts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 