import { describe, expect, it, vi } from 'vitest'
import { createIncidentNotification } from '@/lib/incidents/incident-notifications'

describe('createIncidentNotification', () => {
  it('inserts notification and swallows errors', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn().mockReturnValue({ insert }) } as never

    await createIncidentNotification(supabase, {
      userId: 'user-1',
      incidentId: 'inc-1',
      type: 'incident_assigned',
      title: 'Test',
      message: 'Body',
    })

    expect(supabase.from).toHaveBeenCalledWith('incident_notifications')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        incident_id: 'inc-1',
        type: 'incident_assigned',
      }),
    )
  })
})
