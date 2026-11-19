-- =============================================================================
-- Chat de Compras · Inventario por negocio (aditivo)
--
-- Agrega dos tablas de propiedad del negocio y RPC con comprobación de
-- propiedad en servidor:
--   * business_inventory          → productos, precio, stock, vigencia, foto,
--                                   grupo de equivalencia y alternativas.
--   * business_inventory_sources  → enlace Sheets/CSV/XLSX y mapeo guardado.
--
-- La resincronización (app_sync_inventory) SOLO actualiza los datos que vienen
-- del archivo (nombre, marca, SKU, categoría, precio, stock y vigencia). Nunca
-- toca photo_url, equivalence_group ni alternatives: fotos y alternativas que
-- el negocio ya configuró sobreviven a cada importación.
--
-- No altera purchase_requests, purchase_offers, ni ningún flujo existente.
-- Aplicar con:
--   npx -y @insforge/cli db migrations up --all
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------
create table if not exists public.business_inventory_sources (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  commerce_id uuid references public.commerce_profiles(id) on delete cascade,
  workshop_id uuid references public.workshop_profiles(id) on delete cascade,
  business_key uuid generated always as (coalesce(commerce_id, workshop_id)) stored,
  provider text not null default 'csv'
    check (provider in ('sheets', 'csv', 'xlsx')),
  source_url text,
  file_name text,
  column_mapping jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_sync_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_inventory_source_scope check (
    (commerce_id is not null and workshop_id is null)
    or (commerce_id is null and workshop_id is not null)
  )
);

create table if not exists public.business_inventory (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  commerce_id uuid references public.commerce_profiles(id) on delete cascade,
  workshop_id uuid references public.workshop_profiles(id) on delete cascade,
  business_key uuid generated always as (coalesce(commerce_id, workshop_id)) stored,
  source_id uuid references public.business_inventory_sources(id) on delete set null,
  external_key text,
  sku text,
  name text not null,
  brand text,
  category text,
  description text,
  bonus text,
  price numeric(12, 2) not null default 0,
  currency text not null default 'MXN',
  stock integer not null default 0,
  photo_url text,
  equivalence_group text,
  alternatives jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  valid_until date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint business_inventory_scope check (
    (commerce_id is not null and workshop_id is null)
    or (commerce_id is null and workshop_id is not null)
  )
);

create unique index if not exists business_inventory_source_business_uidx
  on public.business_inventory_sources (business_key);

create unique index if not exists business_inventory_business_external_uidx
  on public.business_inventory (business_key, external_key)
  where external_key is not null;

create index if not exists business_inventory_business_idx
  on public.business_inventory (business_key);

create index if not exists business_inventory_group_idx
  on public.business_inventory (business_key, equivalence_group);

-- -----------------------------------------------------------------------------
-- 2. Helper de propiedad (SECURITY DEFINER para no reentrar en RLS)
-- -----------------------------------------------------------------------------
create or replace function public.app_owns_business_key(p_business_key uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.commerce_profiles cp
    where p_business_key is not null
      and cp.id = p_business_key
      and cp.owner_user_id = auth.uid()
  ) or exists (
    select 1 from public.workshop_profiles wp
    where p_business_key is not null
      and wp.id = p_business_key
      and wp.user_id = auth.uid()
  );
$$;

-- Resuelve el negocio de la sesión. `p_scope` permite elegir 'commerce' o
-- 'workshop' cuando la misma persona tiene ambos perfiles; sin valor se toma
-- el primero disponible (comercio antes que taller).
create or replace function public.app_my_inventory_business(p_scope text default null)
returns table (business_key uuid, owner_user_id uuid, scope text)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with chosen as (
    select coalesce(nullif(btrim(p_scope), ''), 'all') as s
  )
  select cp.id, cp.owner_user_id, 'commerce'::text
  from public.commerce_profiles cp, chosen
  where cp.owner_user_id = auth.uid() and chosen.s <> 'workshop'
  union all
  select wp.id, wp.user_id, 'workshop'::text
  from public.workshop_profiles wp, chosen
  where wp.user_id = auth.uid() and chosen.s <> 'commerce'
  order by 3
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- 3. RLS: cada negocio ve y escribe SOLO sus propias filas
-- -----------------------------------------------------------------------------
alter table public.business_inventory enable row level security;
alter table public.business_inventory_sources enable row level security;

drop policy if exists business_inventory_select_owner on public.business_inventory;
create policy business_inventory_select_owner on public.business_inventory
  for select to authenticated
  using (public.app_owns_business_key(business_key));

drop policy if exists business_inventory_insert_owner on public.business_inventory;
create policy business_inventory_insert_owner on public.business_inventory
  for insert to authenticated
  with check (public.app_owns_business_key(business_key));

drop policy if exists business_inventory_update_owner on public.business_inventory;
create policy business_inventory_update_owner on public.business_inventory
  for update to authenticated
  using (public.app_owns_business_key(business_key))
  with check (public.app_owns_business_key(business_key));

drop policy if exists business_inventory_delete_owner on public.business_inventory;
create policy business_inventory_delete_owner on public.business_inventory
  for delete to authenticated
  using (public.app_owns_business_key(business_key));

drop policy if exists business_inventory_sources_select_owner on public.business_inventory_sources;
create policy business_inventory_sources_select_owner on public.business_inventory_sources
  for select to authenticated
  using (public.app_owns_business_key(business_key));

drop policy if exists business_inventory_sources_insert_owner on public.business_inventory_sources;
create policy business_inventory_sources_insert_owner on public.business_inventory_sources
  for insert to authenticated
  with check (public.app_owns_business_key(business_key));

drop policy if exists business_inventory_sources_update_owner on public.business_inventory_sources;
create policy business_inventory_sources_update_owner on public.business_inventory_sources
  for update to authenticated
  using (public.app_owns_business_key(business_key))
  with check (public.app_owns_business_key(business_key));

drop policy if exists business_inventory_sources_delete_owner on public.business_inventory_sources;
create policy business_inventory_sources_delete_owner on public.business_inventory_sources
  for delete to authenticated
  using (public.app_owns_business_key(business_key));

-- -----------------------------------------------------------------------------
-- 4. Lectura del negocio
-- -----------------------------------------------------------------------------
create or replace function public.app_my_business_inventory(p_scope text default null)
returns table (
  id uuid,
  external_key text,
  sku text,
  name text,
  brand text,
  category text,
  description text,
  bonus text,
  price numeric,
  currency text,
  stock integer,
  photo_url text,
  equivalence_group text,
  alternatives jsonb,
  is_active boolean,
  valid_until date,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select bi.id, bi.external_key, bi.sku, bi.name, bi.brand, bi.category,
         bi.description, bi.bonus, bi.price, bi.currency, bi.stock,
         bi.photo_url, bi.equivalence_group, bi.alternatives, bi.is_active,
         bi.valid_until, bi.updated_at
  from public.business_inventory bi
  where bi.business_key in (
    select mb.business_key from public.app_my_inventory_business(p_scope) mb
  )
  order by bi.name asc;
$$;

create or replace function public.app_my_inventory_source(p_scope text default null)
returns table (
  id uuid,
  provider text,
  source_url text,
  file_name text,
  column_mapping jsonb,
  last_synced_at timestamptz,
  last_sync_summary jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select s.id, s.provider, s.source_url, s.file_name, s.column_mapping,
         s.last_synced_at, s.last_sync_summary
  from public.business_inventory_sources s
  where s.business_key in (
    select mb.business_key from public.app_my_inventory_business(p_scope) mb
  )
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- 5. Fuente (Sheets / CSV / XLSX) y mapeo de columnas guardado
-- -----------------------------------------------------------------------------
create or replace function public.app_save_inventory_source(
  p_provider text,
  p_source_url text default null,
  p_file_name text default null,
  p_column_mapping jsonb default '{}'::jsonb,
  p_scope text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_business_key uuid;
  v_owner uuid;
  v_provider text := lower(btrim(coalesce(p_provider, 'csv')));
  v_source_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa para guardar el inventario.';
  end if;

  if v_provider not in ('sheets', 'csv', 'xlsx') then
    raise exception 'La fuente del inventario debe ser sheets, csv o xlsx.';
  end if;

  select mb.business_key, mb.owner_user_id
  into v_business_key, v_owner
  from public.app_my_inventory_business(p_scope) mb;

  if v_business_key is null then
    raise exception 'Aún no tienes un comercio o taller registrado.';
  end if;

  insert into public.business_inventory_sources (
    owner_user_id, commerce_id, workshop_id, provider, source_url, file_name,
    column_mapping, updated_at
  )
  values (
    v_owner,
    case when p_scope = 'workshop' then null else v_business_key end,
    case when p_scope = 'workshop' then v_business_key else null end,
    v_provider,
    nullif(btrim(coalesce(p_source_url, '')), ''),
    nullif(btrim(coalesce(p_file_name, '')), ''),
    coalesce(p_column_mapping, '{}'::jsonb),
    now()
  )
  on conflict (business_key) do update set
    provider = excluded.provider,
    source_url = excluded.source_url,
    file_name = excluded.file_name,
    column_mapping = excluded.column_mapping,
    updated_at = now()
  returning id into v_source_id;

  return jsonb_build_object('id', v_source_id, 'provider', v_provider);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Sincronización: actualiza precio/stock SIN borrar foto ni alternativas
-- -----------------------------------------------------------------------------
create or replace function public.app_sync_inventory(
  p_items jsonb,
  p_source_id uuid default null,
  p_summary jsonb default '{}'::jsonb,
  p_scope text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_business_key uuid;
  v_owner uuid;
  v_item jsonb;
  v_external_key text;
  v_name text;
  v_price numeric;
  v_stock integer;
  v_exists boolean;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa para sincronizar el inventario.';
  end if;

  select mb.business_key, mb.owner_user_id
  into v_business_key, v_owner
  from public.app_my_inventory_business(p_scope) mb;

  if v_business_key is null then
    raise exception 'Aún no tienes un comercio o taller registrado.';
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_name := nullif(btrim(coalesce(v_item->>'name', '')), '');
    if v_name is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_external_key := nullif(btrim(coalesce(v_item->>'external_key', '')), '');
    if v_external_key is null then
      v_external_key := md5(
        lower(coalesce(nullif(btrim(coalesce(v_item->>'sku', '')), ''), v_name))
      );
    end if;

    v_price := nullif(btrim(coalesce(v_item->>'price', '')), '')::numeric;
    if v_price is null or v_price < 0 then v_price := 0; end if;

    v_stock := nullif(btrim(coalesce(v_item->>'stock', '')), '')::integer;
    if v_stock is null or v_stock < 0 then v_stock := 0; end if;

    select exists (
      select 1 from public.business_inventory bi
      where bi.business_key = v_business_key
        and bi.external_key = v_external_key
    ) into v_exists;

    insert into public.business_inventory (
      owner_user_id, commerce_id, workshop_id, source_id, external_key,
      sku, name, brand, category, description, bonus, price, currency,
      stock, valid_until, is_active, updated_at
    )
    values (
      v_owner,
      case when p_scope = 'workshop' then null else v_business_key end,
      case when p_scope = 'workshop' then v_business_key else null end,
      p_source_id,
      v_external_key,
      nullif(btrim(coalesce(v_item->>'sku', '')), ''),
      v_name,
      nullif(btrim(coalesce(v_item->>'brand', '')), ''),
      nullif(btrim(coalesce(v_item->>'category', '')), ''),
      nullif(btrim(coalesce(v_item->>'description', '')), ''),
      nullif(btrim(coalesce(v_item->>'bonus', '')), ''),
      v_price,
      coalesce(nullif(btrim(coalesce(v_item->>'currency', '')), ''), 'MXN'),
      v_stock,
      nullif(btrim(coalesce(v_item->>'valid_until', '')), '')::date,
      coalesce((v_item->>'is_active')::boolean, true),
      now()
    )
    on conflict (business_key, external_key) where external_key is not null
    do update set
      sku = excluded.sku,
      name = excluded.name,
      brand = excluded.brand,
      category = excluded.category,
      description = excluded.description,
      bonus = excluded.bonus,
      price = excluded.price,
      currency = excluded.currency,
      stock = excluded.stock,
      valid_until = excluded.valid_until,
      is_active = excluded.is_active,
      source_id = coalesce(excluded.source_id, public.business_inventory.source_id),
      updated_at = now();

    if v_exists then v_updated := v_updated + 1;
    else v_inserted := v_inserted + 1; end if;
  end loop;

  if p_source_id is not null then
    update public.business_inventory_sources s
    set last_synced_at = now(),
        last_sync_summary = coalesce(p_summary, '{}'::jsonb),
        updated_at = now()
    where s.id = p_source_id
      and public.app_owns_business_key(s.business_key);
  end if;

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'total', v_inserted + v_updated
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Ajustes manuales que una resincronización NO debe sobrescribir
-- -----------------------------------------------------------------------------
create or replace function public.app_set_inventory_photo(
  p_item_id uuid,
  p_photo_url text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_url text := nullif(btrim(coalesce(p_photo_url, '')), '');
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa para actualizar el inventario.';
  end if;

  if v_url is not null and (char_length(v_url) > 2048 or v_url !~* '^https?://') then
    raise exception 'La URL de la foto no es válida.';
  end if;

  update public.business_inventory bi
  set photo_url = v_url, updated_at = now()
  where bi.id = p_item_id
    and public.app_owns_business_key(bi.business_key)
  returning bi.id into v_id;

  if v_id is null then
    raise exception 'No tienes permiso para actualizar este producto del inventario.';
  end if;

  return jsonb_build_object('id', v_id, 'photo_url', v_url);
end;
$$;

create or replace function public.app_set_inventory_group(
  p_item_id uuid,
  p_group text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_group text := nullif(btrim(coalesce(p_group, '')), '');
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa para actualizar el inventario.';
  end if;

  update public.business_inventory bi
  set equivalence_group = v_group, updated_at = now()
  where bi.id = p_item_id
    and public.app_owns_business_key(bi.business_key)
  returning bi.id into v_id;

  if v_id is null then
    raise exception 'No tienes permiso para actualizar este producto del inventario.';
  end if;

  return jsonb_build_object('id', v_id, 'equivalence_group', v_group);
end;
$$;

create or replace function public.app_set_inventory_alternatives(
  p_item_id uuid,
  p_alternatives jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_value jsonb := coalesce(p_alternatives, '[]'::jsonb);
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa para actualizar el inventario.';
  end if;

  if jsonb_typeof(v_value) <> 'array' then
    raise exception 'Las alternativas deben ser una lista.';
  end if;

  update public.business_inventory bi
  set alternatives = v_value, updated_at = now()
  where bi.id = p_item_id
    and public.app_owns_business_key(bi.business_key)
  returning bi.id into v_id;

  if v_id is null then
    raise exception 'No tienes permiso para actualizar este producto del inventario.';
  end if;

  return jsonb_build_object('id', v_id, 'alternatives', v_value);
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Permisos: SQL privileges + ejecución solo para sesiones autenticadas
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.business_inventory, public.business_inventory_sources
  to authenticated;

revoke all on function public.app_owns_business_key(uuid) from public;
revoke all on function public.app_my_inventory_business(text) from public;
revoke all on function public.app_my_business_inventory(text) from public;
revoke all on function public.app_my_inventory_source(text) from public;
revoke all on function public.app_save_inventory_source(text, text, text, jsonb, text) from public;
revoke all on function public.app_sync_inventory(jsonb, uuid, jsonb, text) from public;
revoke all on function public.app_set_inventory_photo(uuid, text) from public;
revoke all on function public.app_set_inventory_group(uuid, text) from public;
revoke all on function public.app_set_inventory_alternatives(uuid, jsonb) from public;

grant execute on function public.app_owns_business_key(uuid) to authenticated;
grant execute on function public.app_my_inventory_business(text) to authenticated;
grant execute on function public.app_my_business_inventory(text) to authenticated;
grant execute on function public.app_my_inventory_source(text) to authenticated;
grant execute on function public.app_save_inventory_source(text, text, text, jsonb, text) to authenticated;
grant execute on function public.app_sync_inventory(jsonb, uuid, jsonb, text) to authenticated;
grant execute on function public.app_set_inventory_photo(uuid, text) to authenticated;
grant execute on function public.app_set_inventory_group(uuid, text) to authenticated;
grant execute on function public.app_set_inventory_alternatives(uuid, jsonb) to authenticated;
