-- Phase 3: In-app notifications for incident workflow events

CREATE TABLE IF NOT EXISTS public.incident_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  incident_id uuid REFERENCES public.incident_history (id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (
    type IN (
      'incident_assigned',
      'incident_claimed',
      'incident_acknowledged',
      'incident_routed',
      'incident_sla_breach',
      'incident_escalation'
    )
  ),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  is_dismissed boolean NOT NULL DEFAULT false,
  dismissed_at timestamptz,
  action_url text,
  action_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_notifications_user_unread
  ON public.incident_notifications (user_id, is_read, created_at DESC)
  WHERE is_dismissed = false;

CREATE INDEX IF NOT EXISTS idx_incident_notifications_incident
  ON public.incident_notifications (incident_id)
  WHERE incident_id IS NOT NULL;

ALTER TABLE public.incident_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY incident_notifications_select_own
  ON public.incident_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY incident_notifications_update_own
  ON public.incident_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.incident_notifications IS
  'In-app alerts for incident assignment, acknowledgement, routing, and SLA breaches.';
