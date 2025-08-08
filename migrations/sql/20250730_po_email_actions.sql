-- Create table to store per-recipient email action tokens for Purchase Orders
create table if not exists public.po_action_tokens (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  recipient_email citext not null,
  action text not null check (action in ('approve','reject')),
  jwt_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_po_action_tokens_po on public.po_action_tokens(purchase_order_id);
create index if not exists idx_po_action_tokens_email on public.po_action_tokens(recipient_email);
create index if not exists idx_po_action_tokens_exp on public.po_action_tokens(expires_at);

alter table public.po_action_tokens enable row level security;
do $$ begin
  begin
    create policy "deny all" on public.po_action_tokens for all using (false);
  exception when duplicate_object then
    null;
  end;
end $$;

-- Helper to resolve profile id by email
create or replace function public.get_profile_id_by_email(p_email citext)
returns uuid
language sql
stable
as $$
  select id from public.profiles where email = p_email limit 1;
$$;

-- SECURITY DEFINER function to fetch a valid token for a recipient/action
create or replace function public.get_po_action_token(
  p_po_id uuid,
  p_action text,
  p_recipient_email citext
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if p_action not in ('approve','reject') then
    return null;
  end if;

  select t.jwt_token into v_token
  from public.po_action_tokens t
  where t.purchase_order_id = p_po_id
    and t.recipient_email = p_recipient_email
    and t.action = p_action
    and t.expires_at > now()
  order by t.created_at desc
  limit 1;

  return v_token;
end;
$$;

-- SECURITY DEFINER function to process an email action token
-- Performs validations, advances workflow, deletes token(s), and returns result
create or replace function public.process_po_email_action(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_po record;
  v_actor uuid;
  v_new_status text;
begin
  if p_token is null or length(p_token) = 0 then
    return jsonb_build_object('success', false, 'error', 'Missing token');
  end if;

  select * into v_row
  from public.po_action_tokens
  where jwt_token = p_token
    and expires_at > now()
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  end if;

  -- Resolve actor by email
  select public.get_profile_id_by_email(v_row.recipient_email) into v_actor;
  if v_actor is null then
    return jsonb_build_object('success', false, 'error', 'Actor not found for email');
  end if;

  -- Get current PO
  select * into v_po from public.purchase_orders where id = v_row.purchase_order_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Purchase order not found');
  end if;

  -- Only process when awaiting approval or compatible intermediate states
  if coalesce(v_po.status,'') not in ('pending_approval','quoted','pending_approval_adjustment','pending_approval_special','Pendiente','pending_approval_receipt') then
    -- Still allow idempotent returns if already finalized
    if v_po.status in ('approved','rejected') then
      return jsonb_build_object('success', true, 'po_id', v_po.id, 'status', v_po.status, 'idempotent', true);
    end if;
    return jsonb_build_object('success', false, 'error', 'Purchase order not awaiting approval', 'status', v_po.status);
  end if;

  if v_row.action = 'approve' then
    update public.purchase_orders
      set status = 'approved',
          approval_date = now(),
          approved_by = v_actor,
          updated_at = now(),
          updated_by = v_actor
      where id = v_row.purchase_order_id;
    v_new_status := 'approved';
  elsif v_row.action = 'reject' then
    update public.purchase_orders
      set status = 'rejected',
          updated_at = now(),
          updated_by = v_actor
      where id = v_row.purchase_order_id;
    v_new_status := 'rejected';
  else
    return jsonb_build_object('success', false, 'error', 'Invalid action');
  end if;

  -- Delete all tokens for this PO+email to prevent reuse (both actions)
  delete from public.po_action_tokens
  where purchase_order_id = v_row.purchase_order_id
    and recipient_email = v_row.recipient_email;

  return jsonb_build_object('success', true, 'po_id', v_row.purchase_order_id, 'status', v_new_status);
end;
$$;


