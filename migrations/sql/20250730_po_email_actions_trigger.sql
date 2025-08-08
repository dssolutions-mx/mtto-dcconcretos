-- Requires pg_net extension
-- On status transition into pending_approval, call the edge function
create or replace function public.notify_po_pending_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.status = 'pending_approval' then
      perform net.http_post(
        url := current_setting('app.edge_po_notify_url', true),
        headers := jsonb_build_object('Content-Type','application/json','Authorization', 'Bearer ' || current_setting('app.edge_bearer', true)),
        body := jsonb_build_object('po_id', new.id)::text
      );
    end if;
  elsif TG_OP = 'UPDATE' then
    if new.status = 'pending_approval' and old.status is distinct from new.status then
      perform net.http_post(
        url := current_setting('app.edge_po_notify_url', true),
        headers := jsonb_build_object('Content-Type','application/json','Authorization', 'Bearer ' || current_setting('app.edge_bearer', true)),
        body := jsonb_build_object('po_id', new.id)::text
      );
    end if;
  end if;
  return new;
end;
$$;

-- Drop and recreate trigger to avoid duplicates
drop trigger if exists trg_notify_po_pending_approval on public.purchase_orders;
create trigger trg_notify_po_pending_approval
after insert or update of status on public.purchase_orders
for each row
execute function public.notify_po_pending_approval();


