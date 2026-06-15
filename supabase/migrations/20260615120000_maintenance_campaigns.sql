-- Maintenance campaigns: planning containers linking work orders (no mutation of incidents/issues).

CREATE TABLE IF NOT EXISTS public.maintenance_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  theme text,
  cohort_id text,
  status text NOT NULL DEFAULT 'planificada'
    CHECK (status IN ('planificada', 'en_ejecucion', 'cerrada')),
  plant_id uuid REFERENCES public.plants(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_start date,
  target_end date,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_work_orders (
  campaign_id uuid NOT NULL REFERENCES public.maintenance_campaigns(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, work_order_id)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_campaigns_status
  ON public.maintenance_campaigns (status);

CREATE INDEX IF NOT EXISTS idx_campaign_work_orders_wo
  ON public.campaign_work_orders (work_order_id);

ALTER TABLE public.maintenance_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY maintenance_campaigns_select ON public.maintenance_campaigns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY maintenance_campaigns_insert ON public.maintenance_campaigns
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY maintenance_campaigns_update ON public.maintenance_campaigns
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY campaign_work_orders_select ON public.campaign_work_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY campaign_work_orders_insert ON public.campaign_work_orders
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY campaign_work_orders_delete ON public.campaign_work_orders
  FOR DELETE TO authenticated USING (true);
