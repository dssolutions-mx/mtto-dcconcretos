-- Add profiles.is_active and deactivation metadata; align with status
begin;

-- Columns
alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid references public.profiles(id),
  add column if not exists deactivation_reason text;

-- Index for quick filtering
create index if not exists idx_profiles_is_active on public.profiles(is_active);

-- If status is already tracked, align initial values
update public.profiles
set is_active = false
where (status in ('inactive', 'suspended')) and is_active is distinct from false;

commit;

