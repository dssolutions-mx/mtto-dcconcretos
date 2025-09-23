-- Profiles storage hardening: make bucket private and add path-scoped RLS
-- Safe to run multiple times

begin;

-- 1) Ensure bucket is private
update storage.buckets
set public = false
where id = 'profiles';

-- 2) Policies on storage.objects for bucket 'profiles'
-- Drop existing conflicting policies if present
drop policy if exists "profiles_select_own_or_admin" on storage.objects;
drop policy if exists "profiles_insert_own_or_admin" on storage.objects;
drop policy if exists "profiles_update_own_or_admin" on storage.objects;
drop policy if exists "profiles_delete_own_or_admin" on storage.objects;

-- Helper predicate: is current user an admin allowed to manage avatars
-- Uses public.profiles table to check role
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('GERENCIA_GENERAL','AREA_ADMINISTRATIVA','JEFE_UNIDAD_NEGOCIO')
  );
$$;

-- Allow select (needed to generate signed URLs) for own folder or if admin
create policy "profiles_select_own_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profiles' and (
    public.is_admin() or storage.foldername(name) = ('avatars/' || auth.uid()::text || '/')
  )
);

-- Allow insert (upload) to own folder or admin anywhere in bucket
create policy "profiles_insert_own_or_admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profiles' and (
    public.is_admin() or storage.foldername(name) = ('avatars/' || auth.uid()::text || '/')
  )
);

-- Allow update (rename/move) with same constraints
create policy "profiles_update_own_or_admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profiles' and (
    public.is_admin() or storage.foldername(name) = ('avatars/' || auth.uid()::text || '/')
  )
)
with check (
  bucket_id = 'profiles' and (
    public.is_admin() or storage.foldername(name) = ('avatars/' || auth.uid()::text || '/')
  )
);

-- Allow delete with same constraints
create policy "profiles_delete_own_or_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profiles' and (
    public.is_admin() or storage.foldername(name) = ('avatars/' || auth.uid()::text || '/')
  )
);

commit;


