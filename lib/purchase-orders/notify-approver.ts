/**
 * Fire-and-forget helper: triggers the purchase-order-approval-notification edge function.
 * Called after each workflow state change so the next approver in the chain is notified.
 * Errors are logged but never propagated — a notification failure must never block the workflow.
 */
export async function notifyNextApprover(poId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    console.warn('[notify-approver] Missing Supabase env vars — skipping notification')
    return
  }

  const fnBase = `${supabaseUrl.replace(/\/$/, '')}/functions/v1`

  try {
    const res = await fetch(`${fnBase}/purchase-order-approval-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ po_id: poId }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '(unreadable)')
      console.error(`[notify-approver] Edge function returned ${res.status} for PO ${poId}:`, text)
    }
  } catch (err) {
    console.error(`[notify-approver] Failed to call notification function for PO ${poId}:`, err)
  }
}
