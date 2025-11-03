-- Requires pg_net extension
-- On status transition into pending_approval OR BU approval escalation, call the edge function
create or replace function public.notify_po_pending_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_bearer text;
  v_request_id bigint;
  v_should_notify boolean := false;
begin
  -- CRITICAL: Read from app_settings table first, then fallback to GUC
  select value into v_url from public.app_settings where key = 'edge_po_notify_url';
  if v_url is null or trim(v_url) = '' then
    begin
      v_url := current_setting('app.edge_po_notify_url', true);
    exception when others then
      v_url := null;
    end;
  end if;

  select value into v_bearer from public.app_settings where key = 'edge_bearer';
  if v_bearer is null or trim(v_bearer) = '' then
    begin
      v_bearer := current_setting('app.edge_bearer', true);
    exception when others then
      v_bearer := null;
    end;
  end if;

  -- CRITICAL: Fail loudly if URL is not configured (no silent failures)
  if v_url is null or trim(v_url) = '' then
    raise exception 'CRITICAL: Purchase Order notification URL not configured. Set app_settings.edge_po_notify_url';
  end if;

  -- Determine if we should send notification
  if TG_OP = 'INSERT' then
    -- New PO entering pending_approval
    if new.status = 'pending_approval' then
      v_should_notify := true;
    end if;
  elsif TG_OP = 'UPDATE' then
    -- NEW: Escalation scenario - BU approved, escalate to GM
    if old.authorized_by IS NULL 
       AND new.authorized_by IS NOT NULL
       AND new.status = 'pending_approval'
       AND new.total_amount > 5000 then
      v_should_notify := true;
    -- Existing: Status change to pending_approval
    elsif new.status = 'pending_approval' 
       AND old.status IS DISTINCT FROM new.status then
      v_should_notify := true;
    end if;
  end if;

  -- Send notification if conditions met
  if v_should_notify then
    begin
      v_request_id := net.http_post(
        v_url,                                        -- url text
        jsonb_build_object('po_id', new.id),          -- body jsonb
        '{}'::jsonb,                                   -- params jsonb
        jsonb_build_object(                            -- headers jsonb
          'Content-Type', 'application/json',
          'Authorization', case 
            when v_bearer is not null and trim(v_bearer) <> '' 
            then 'Bearer ' || v_bearer 
            else '' 
          end
        ),
        5000                                           -- timeout_milliseconds integer
      );

      -- Log successful enqueue
      insert into notifications (user_id, title, message, type, related_entity, entity_id, created_at)
      values (
        null,
        'PO notification enqueued',
        format('Queued request_id=%s for PO %s (order_id=%s, amount=%s)', 
               v_request_id, new.id::text, new.order_id, new.total_amount),
        'PURCHASE_ORDER_APPROVAL_ENQUEUE',
        'purchase_order',
        new.id,
        now()
      );

    exception when others then
      -- Log the error but don't block the PO creation/update
      insert into notifications (user_id, title, message, type, related_entity, entity_id, created_at)
      values (
        null,
        'PO notification FAILED',
        format('ERROR enqueueing notification for PO %s: %s', new.id::text, SQLERRM),
        'PURCHASE_ORDER_APPROVAL_ERROR',
        'purchase_order',
        new.id,
        now()
      );
      
      -- Re-raise to make the error visible
      raise warning 'Failed to enqueue PO notification for %: %', new.id, SQLERRM;
    end;
  end if;

  return new;
end;
$$;

-- Drop and recreate trigger to avoid duplicates
-- NOW MONITORS BOTH status AND authorized_by for escalation detection
drop trigger if exists trg_notify_po_pending_approval on public.purchase_orders;
create trigger trg_notify_po_pending_approval
after insert or update of status, authorized_by on public.purchase_orders
for each row
execute function public.notify_po_pending_approval();


