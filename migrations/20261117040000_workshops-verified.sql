-- =============================================================================
-- Chat de Compras · Talleres Verificados y Servicios (Fase 1)
--
-- Módulo NUEVO y aislado. Crea su propia tabla y amplía purchase_requests SOLO
-- con columnas aditivas provistas de valores por defecto. NO modifica offers,
-- groups, group_members, commerce_profiles ni ninguna política RLS existente.
--
-- Se aplica con:
--   npx -y @insforge/cli db migrations up 20261117040000_workshops-verified.sql
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tabla nueva del módulo
-- -----------------------------------------------------------------------------
create table if not exists public.workshop_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  workshop_name text not null,
  nit_or_id text not null,
  address text not null,
  phone text not null,
  specialties text[] not null default '{}',
  is_verified boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Ampliación retrocompatible de purchase_requests
--
-- `request_type` llega con valor por defecto 'part', así que todas las filas
-- existentes y todos los INSERT actuales siguen funcionando sin cambios.
-- `vehicle_plate` es nullable para no exigir datos a solicitudes antiguas.
-- No se toca ninguna política, trigger ni función existente sobre esta tabla.
-- -----------------------------------------------------------------------------
alter table public.purchase_requests
  add column if not exists request_type text not null default 'part';

alter table public.purchase_requests
  add column if not exists vehicle_plate text;

-- Dominio acotado del nuevo campo. Se agrega de forma idempotente porque
-- Postgres no admite `add constraint if not exists`.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_requests'::regclass
      and conname = 'purchase_requests_request_type_check'
  ) then
    alter table public.purchase_requests
      add constraint purchase_requests_request_type_check
      check (request_type in ('part', 'service'));
  end if;
end $$;

-- Índice parcial para el control de historial por placa sin penalizar filas
-- antiguas que no tienen placa.
create index if not exists purchase_requests_vehicle_plate_idx
  on public.purchase_requests (vehicle_plate)
  where vehicle_plate is not null;

-- -----------------------------------------------------------------------------
-- Row Level Security (solo la tabla nueva)
-- -----------------------------------------------------------------------------
alter table public.workshop_profiles enable row level security;

-- Cada usuario ve su propio taller y además los perfiles verificados.
drop policy if exists workshop_profiles_select_visible on public.workshop_profiles;
create policy workshop_profiles_select_visible on public.workshop_profiles
  for select to authenticated
  using (user_id = auth.uid() or is_verified = true);

drop policy if exists workshop_profiles_insert_own on public.workshop_profiles;
create policy workshop_profiles_insert_own on public.workshop_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists workshop_profiles_update_own on public.workshop_profiles;
create policy workshop_profiles_update_own on public.workshop_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- RPCs de la app (el dueño siempre se resuelve desde auth.uid())
-- -----------------------------------------------------------------------------
create or replace function public.app_my_workshop()
returns table (
  id uuid,
  user_id uuid,
  workshop_name text,
  nit_or_id text,
  address text,
  phone text,
  specialties text[],
  is_verified boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select wp.id, wp.user_id, wp.workshop_name, wp.nit_or_id, wp.address,
         wp.phone, wp.specialties, wp.is_verified, wp.created_at
  from public.workshop_profiles wp
  where wp.user_id = auth.uid();
$$;

create or replace function public.app_save_workshop(
  p_workshop_name text,
  p_nit_or_id text,
  p_address text,
  p_phone text,
  p_specialties text[] default '{}'
)
returns table (
  id uuid,
  user_id uuid,
  workshop_name text,
  nit_or_id text,
  address text,
  phone text,
  specialties text[],
  is_verified boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_workshop_name, ''));
  v_nit text := btrim(coalesce(p_nit_or_id, ''));
  v_address text := btrim(coalesce(p_address, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_specialties text[] := coalesce(p_specialties, '{}'::text[]);
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'El nombre del taller debe tener entre 2 y 120 caracteres.';
  end if;
  if v_nit = '' or char_length(v_nit) > 40 then
    raise exception 'El NIT o cédula es obligatorio (máximo 40 caracteres).';
  end if;
  if v_address = '' or char_length(v_address) > 200 then
    raise exception 'La dirección es obligatoria (máximo 200 caracteres).';
  end if;
  if v_phone = '' or char_length(v_phone) > 30 then
    raise exception 'El teléfono es obligatorio (máximo 30 caracteres).';
  end if;

  -- Un usuario solo tiene un taller: registrar equivale a actualizarlo.
  insert into public.workshop_profiles
    (user_id, workshop_name, nit_or_id, address, phone, specialties)
  values
    (v_uid, v_name, v_nit, v_address, v_phone, v_specialties)
  on conflict (user_id) do update
    set workshop_name = excluded.workshop_name,
        nit_or_id = excluded.nit_or_id,
        address = excluded.address,
        phone = excluded.phone,
        specialties = excluded.specialties;

  return query select * from public.app_my_workshop();
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants (mismo patrón del proyecto: execute a authenticated, control en RPC)
-- -----------------------------------------------------------------------------
grant select, insert, update on public.workshop_profiles to authenticated;

revoke all on function public.app_my_workshop() from public;
revoke all on function public.app_save_workshop(text, text, text, text, text[]) from public;

grant execute on function public.app_my_workshop() to authenticated;
grant execute on function public.app_save_workshop(text, text, text, text, text[]) to authenticated;
