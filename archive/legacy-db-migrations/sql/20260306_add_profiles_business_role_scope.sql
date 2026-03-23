alter table public.profiles
  add column if not exists business_role text,
  add column if not exists role_scope text;

update public.profiles
set
  business_role = case
    when coalesce(business_role, '') <> '' then business_role
    when role = 'GERENCIA_GENERAL' then 'GERENCIA_GENERAL'
    when role = 'JEFE_UNIDAD_NEGOCIO' then 'GERENTE_MANTENIMIENTO'
    when role in ('ENCARGADO_MANTENIMIENTO', 'JEFE_PLANTA') then 'COORDINADOR_MANTENIMIENTO'
    when role = 'AREA_ADMINISTRATIVA' then 'AREA_ADMINISTRATIVA'
    when role = 'AUXILIAR_COMPRAS' then 'AUXILIAR_COMPRAS'
    when role in ('DOSIFICADOR', 'OPERADOR') then 'OPERADOR'
    when role = 'VISUALIZADOR' then 'VISUALIZADOR'
    when role = 'EJECUTIVO' then 'EJECUTIVO'
    else business_role
  end,
  role_scope = case
    when coalesce(role_scope, '') <> '' then role_scope
    when role = 'GERENCIA_GENERAL' then 'global'
    when role = 'JEFE_UNIDAD_NEGOCIO' then 'business_unit'
    when role in ('ENCARGADO_MANTENIMIENTO', 'JEFE_PLANTA', 'DOSIFICADOR', 'OPERADOR') then 'plant'
    when role in ('AREA_ADMINISTRATIVA', 'AUXILIAR_COMPRAS', 'VISUALIZADOR', 'EJECUTIVO') then 'global'
    else role_scope
  end;

alter table public.profiles
  drop constraint if exists profiles_role_scope_check;

alter table public.profiles
  add constraint profiles_role_scope_check
  check (role_scope is null or role_scope in ('global', 'business_unit', 'plant'));
