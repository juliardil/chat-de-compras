-- =============================================================================
-- Go.go · Clubes avanzados y patrocinios
--
-- Migración ADITIVA y posterior a 20261117161028. No modifica las reglas de
-- comercios, talleres verificados, pedidos ni el switcher de vistas.
--
-- Incorpora:
--   * Identidad visual del club (avatar, insignia, color y descripción).
--   * Chat interno exclusivo de miembros del club.
--   * Eventos/rodadas con confirmación de asistencia (RSVP).
--   * Marcas patrocinadoras con logos, beneficios y descuentos.
--   * Tarifas, vigencia, aprobación y auditoría administrativa de patrocinios.
--   * Métrica de compras de miembros del club para las marcas patrocinadoras.
--
-- Se aplica con:
--   npx -y @insforge/cli db migrations up 20261117170000_clubs-sponsorships-advanced.sql
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Identidad visual del club (columnas aditivas, retrocompatibles)
-- -----------------------------------------------------------------------------
alter table public.groups
  add column if not exists avatar_url text,
  add column if not exists badge_emoji text not null default '🏁',
  add column if not exists color text not null default '#4B227A',
  add column if not exists description text;

alter table public.groups
  drop constraint if exists groups_badge_emoji_len_check;
alter table public.groups
  add constraint groups_badge_emoji_len_check check (char_length(badge_emoji) between 1 and 8);

alter table public.groups
  drop constraint if exists groups_color_format_check;
alter table public.groups
  add constraint groups_color_format_check check (color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.groups
  drop constraint if exists groups_description_len_check;
alter table public.groups
  add constraint groups_description_len_check check (char_length(coalesce(description, '')) <= 240);

-- -----------------------------------------------------------------------------
-- Tablas nuevas del módulo avanzado de clubes
-- -----------------------------------------------------------------------------
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists group_messages_group_created_idx
  on public.group_messages (group_id, created_at desc);

create table if not exists public.group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text,
  location text,
  starts_at timestamptz not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists group_events_group_starts_idx
  on public.group_events (group_id, starts_at);

create table if not exists public.group_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.group_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('going', 'not_going')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists group_event_rsvps_event_idx
  on public.group_event_rsvps (event_id);

-- Tarifas oficiales de patrocinio publicitario.
create table if not exists public.club_sponsorship_rates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'MXN',
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'one_time')),
  description text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.club_sponsorship_rates (code, name, amount, currency, billing_cycle, description)
values
  ('club_basic', 'Patrocinio Básico', 899.00, 'MXN', 'monthly',
   'Logo y beneficio en la tarjeta del club durante un ciclo mensual.'),
  ('club_pro', 'Patrocinio Pro', 1899.00, 'MXN', 'monthly',
   'Logo destacado, descuento exclusivo y reporte de impacto comercial.'),
  ('club_rodada', 'Rodada Patrocinada', 3499.00, 'MXN', 'one_time',
   'Patrocinio único de una rodada o evento del club.')
on conflict (code) do nothing;

-- Marcas patrocinadoras. `moderation_status` controla aprobación; el estado de
-- vigencia (activo / por vencer / expirado) se calcula con fechas.
create table if not exists public.club_sponsors (
  id uuid primary key default gen_random_uuid(),
  group_id uuid null references public.groups(id) on delete cascade,
  brand_name text not null check (char_length(btrim(brand_name)) between 2 and 120),
  logo_url text,
  benefit text,
  discount_percent numeric(5, 2) check (discount_percent between 0 and 100),
  contact_email text,
  commerce_id uuid null references public.commerce_profiles(id) on delete set null,
  workshop_id uuid null references public.workshop_profiles(id) on delete set null,
  rate_id uuid null references public.club_sponsorship_rates(id) on delete set null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  currency text not null default 'MXN',
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'one_time')),
  starts_on date,
  ends_on date,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  review_reason text,
  created_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index if not exists club_sponsors_group_idx
  on public.club_sponsors (group_id);
create index if not exists club_sponsors_moderation_idx
  on public.club_sponsors (moderation_status);
create index if not exists club_sponsors_commerce_idx
  on public.club_sponsors (commerce_id)
  where commerce_id is not null;
create index if not exists club_sponsors_workshop_idx
  on public.club_sponsors (workshop_id)
  where workshop_id is not null;

-- -----------------------------------------------------------------------------
-- Helper de vigencia (compartido por RPCs de club y de administración)
-- -----------------------------------------------------------------------------
create or replace function public.club_sponsor_lifecycle(
  p_moderation_status text,
  p_starts_on date,
  p_ends_on date
)
returns text
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
  select case
    when p_moderation_status <> 'approved' then p_moderation_status
    when p_starts_on is not null and p_starts_on > current_date then 'scheduled'
    when p_ends_on is not null and p_ends_on < current_date then 'expired'
    when p_ends_on is not null and (p_ends_on - current_date) <= 7 then 'expiring'
    else 'active'
  end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security (solo tablas nuevas; no se tocan policies existentes)
-- -----------------------------------------------------------------------------
alter table public.group_messages enable row level security;
alter table public.group_events enable row level security;
alter table public.group_event_rsvps enable row level security;
alter table public.club_sponsorship_rates enable row level security;
alter table public.club_sponsors enable row level security;

drop policy if exists group_messages_select_members on public.group_messages;
create policy group_messages_select_members on public.group_messages
  for select to authenticated
  using (public.group_is_member(group_id));

drop policy if exists group_messages_insert_members on public.group_messages;
create policy group_messages_insert_members on public.group_messages
  for insert to authenticated
  with check (user_id = auth.uid() and public.group_is_member(group_id));

drop policy if exists group_messages_delete_own on public.group_messages;
create policy group_messages_delete_own on public.group_messages
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists group_events_select_members on public.group_events;
create policy group_events_select_members on public.group_events
  for select to authenticated
  using (public.group_is_member(group_id));

drop policy if exists group_events_insert_owners on public.group_events;
create policy group_events_insert_owners on public.group_events
  for insert to authenticated
  with check (created_by = auth.uid() and public.group_is_owner(group_id));

drop policy if exists group_event_rsvps_select_own on public.group_event_rsvps;
create policy group_event_rsvps_select_own on public.group_event_rsvps
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists group_event_rsvps_insert_own on public.group_event_rsvps;
create policy group_event_rsvps_insert_own on public.group_event_rsvps
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists group_event_rsvps_update_own on public.group_event_rsvps;
create policy group_event_rsvps_update_own on public.group_event_rsvps
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists club_sponsorship_rates_select_authenticated on public.club_sponsorship_rates;
create policy club_sponsorship_rates_select_authenticated on public.club_sponsorship_rates
  for select to authenticated
  using (true);

drop policy if exists club_sponsors_select_visible on public.club_sponsors;
create policy club_sponsors_select_visible on public.club_sponsors
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.admin_has_permission('sponsorships.view')
    or (
      moderation_status = 'approved'
      and (group_id is null or public.group_is_member(group_id))
    )
  );

drop policy if exists club_sponsors_insert_pending on public.club_sponsors;
create policy club_sponsors_insert_pending on public.club_sponsors
  for insert to authenticated
  with check (created_by = auth.uid() and moderation_status = 'pending');

drop policy if exists club_sponsors_update_admin on public.club_sponsors;
create policy club_sponsors_update_admin on public.club_sponsors
  for update to authenticated
  using (public.admin_has_permission('sponsorships.manage'))
  with check (public.admin_has_permission('sponsorships.manage'));

-- -----------------------------------------------------------------------------
-- Permisos del panel de patrocinios
-- -----------------------------------------------------------------------------
insert into public.admin_permissions (key, module, action, label, is_sensitive) values
  ('sponsorships.view', 'Patrocinios', 'view', 'Ver clubes y marcas patrocinadoras', false),
  ('sponsorships.manage', 'Patrocinios', 'manage', 'Administrar tarifas, vigencia y aprobación de marcas', true),
  ('sponsorships.finance', 'Patrocinios', 'finance', 'Consultar ingresos e impacto comercial', true)
on conflict (key) do update
  set module = excluded.module,
      action = excluded.action,
      label = excluded.label,
      is_sensitive = excluded.is_sensitive;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p
  on p.key in ('sponsorships.view', 'sponsorships.manage', 'sponsorships.finance')
where r.key in ('superadmin', 'admin')
  and not exists (
    select 1
    from public.admin_role_permissions rp
    where rp.role_id = r.id
      and rp.permission_id = p.id
  );

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p
  on p.key in ('sponsorships.view', 'sponsorships.manage')
where r.key = 'commerce_manager'
  and not exists (
    select 1
    from public.admin_role_permissions rp
    where rp.role_id = r.id
      and rp.permission_id = p.id
  );

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p
  on p.key in ('sponsorships.view', 'sponsorships.finance')
where r.key in ('analyst', 'finance')
  and not exists (
    select 1
    from public.admin_role_permissions rp
    where rp.role_id = r.id
      and rp.permission_id = p.id
  );

-- -----------------------------------------------------------------------------
-- RPCs de comprador: identidad visual del club
-- -----------------------------------------------------------------------------
create or replace function public.app_club_identity()
returns table (
  group_id uuid,
  name text,
  avatar_url text,
  badge_emoji text,
  color text,
  description text,
  member_count integer,
  min_members integer,
  is_owner boolean,
  is_verified boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null then
    return;
  end if;

  return query
    select g.id, g.name, g.avatar_url, g.badge_emoji, g.color, g.description,
           (select count(*)::integer from public.group_members gm where gm.group_id = g.id),
           s.min_members,
           public.group_is_owner(g.id),
           ((select count(*)::integer from public.group_members gm where gm.group_id = g.id) >= s.min_members)
    from public.groups g
    cross join public.group_settings s
    where g.id = v_group_id;
end;
$$;

create or replace function public.app_update_group_identity(
  p_avatar_url text,
  p_badge_emoji text,
  p_color text,
  p_description text
)
returns table (
  group_id uuid,
  name text,
  avatar_url text,
  badge_emoji text,
  color text,
  description text,
  member_count integer,
  min_members integer,
  is_owner boolean,
  is_verified boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_badge text := coalesce(btrim(p_badge_emoji), '🏁');
  v_color text := coalesce(btrim(p_color), '#4B227A');
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null or not public.group_is_owner(v_group_id) then
    raise exception 'Solo el responsable del club puede cambiar su identidad visual.';
  end if;

  if char_length(v_badge) < 1 or char_length(v_badge) > 8 then
    raise exception 'La insignia debe tener entre 1 y 8 caracteres.';
  end if;

  if v_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'El color debe tener formato hexadecimal (#RRGGBB).';
  end if;

  if char_length(coalesce(p_description, '')) > 240 then
    raise exception 'La descripción no puede superar 240 caracteres.';
  end if;

  update public.groups g
  set avatar_url = case when p_avatar_url is null then g.avatar_url else btrim(p_avatar_url) end,
      badge_emoji = v_badge,
      color = v_color,
      description = nullif(btrim(coalesce(p_description, '')), '')
  where g.id = v_group_id;

  return query select * from public.app_club_identity();
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs de comprador: chat interno del club
-- -----------------------------------------------------------------------------
create or replace function public.app_group_messages(p_limit integer default 40)
returns table (
  id uuid,
  body text,
  author_name text,
  is_mine boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 100);
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null then
    return;
  end if;

  return query
    select m.id, m.body,
           coalesce(bp.display_name, u.email, 'Miembro'),
           (m.user_id = v_uid),
           m.created_at
    from public.group_messages m
    left join public.buyer_profiles bp on bp.user_id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.group_id = v_group_id
    order by m.created_at desc
    limit v_limit;
end;
$$;

create or replace function public.app_group_send_message(p_body text)
returns table (
  id uuid,
  body text,
  author_name text,
  is_mine boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_message_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'El mensaje debe tener entre 1 y 1000 caracteres.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null or not public.group_is_member(v_group_id) then
    raise exception 'Solo los miembros del club pueden escribir en este canal.';
  end if;

  insert into public.group_messages (group_id, user_id, body)
  values (v_group_id, v_uid, v_body)
  returning id into v_message_id;

  return query
    select m.id, m.body,
           coalesce(bp.display_name, u.email, 'Miembro'),
           true,
           m.created_at
    from public.group_messages m
    left join public.buyer_profiles bp on bp.user_id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.id = v_message_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs de comprador: eventos y confirmación de asistencia
-- -----------------------------------------------------------------------------
create or replace function public.app_group_events()
returns table (
  id uuid,
  title text,
  description text,
  location text,
  starts_at timestamptz,
  going_count integer,
  my_status text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null then
    return;
  end if;

  return query
    select e.id, e.title, e.description, e.location, e.starts_at,
           (select count(*)::integer from public.group_event_rsvps r
            where r.event_id = e.id and r.status = 'going'),
           coalesce((
             select r.status from public.group_event_rsvps r
             where r.event_id = e.id and r.user_id = v_uid
             limit 1
           ), 'none')
    from public.group_events e
    where e.group_id = v_group_id
      and e.starts_at >= now() - interval '1 day'
    order by e.starts_at asc;
end;
$$;

create or replace function public.app_group_create_event(
  p_title text,
  p_description text,
  p_location text,
  p_starts_at timestamptz
)
returns table (
  id uuid,
  title text,
  starts_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_event_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  if char_length(v_title) < 2 or char_length(v_title) > 120 then
    raise exception 'El título debe tener entre 2 y 120 caracteres.';
  end if;

  if p_starts_at is null then
    raise exception 'Selecciona la fecha y hora de la actividad.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null or not public.group_is_owner(v_group_id) then
    raise exception 'Solo el responsable del club puede crear eventos.';
  end if;

  insert into public.group_events (group_id, title, description, location, starts_at, created_by)
  values (
    v_group_id,
    v_title,
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_location, '')), ''),
    p_starts_at,
    v_uid
  )
  returning id into v_event_id;

  return query
    select e.id, e.title, e.starts_at
    from public.group_events e
    where e.id = v_event_id;
end;
$$;

create or replace function public.app_group_rsvp(p_event_id uuid, p_status text)
returns table (
  event_id uuid,
  status text,
  going_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_status text := btrim(coalesce(p_status, ''));
  v_event_group_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  if v_status not in ('going', 'not_going') then
    raise exception 'Estado de asistencia no válido.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  select e.group_id into v_event_group_id
  from public.group_events e
  where e.id = p_event_id;

  if v_event_group_id is null or v_event_group_id is distinct from v_group_id then
    raise exception 'Esa actividad no pertenece a tu club.';
  end if;

  insert into public.group_event_rsvps (event_id, user_id, status, updated_at)
  values (p_event_id, v_uid, v_status, now())
  on conflict (event_id, user_id)
  do update set status = excluded.status, updated_at = now();

  return query
    select p_event_id, v_status,
           (select count(*)::integer from public.group_event_rsvps r
            where r.event_id = p_event_id and r.status = 'going');
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs de comprador: patrocinios visibles para el club
-- -----------------------------------------------------------------------------
create or replace function public.app_club_sponsors()
returns table (
  id uuid,
  brand_name text,
  logo_url text,
  benefit text,
  discount_percent numeric,
  group_id uuid,
  lifecycle_status text,
  starts_on date,
  ends_on date
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null then
    return;
  end if;

  return query
    select s.id, s.brand_name, s.logo_url, s.benefit, s.discount_percent,
           s.group_id,
           public.club_sponsor_lifecycle(s.moderation_status, s.starts_on, s.ends_on),
           s.starts_on, s.ends_on
    from public.club_sponsors s
    where s.moderation_status = 'approved'
      and (s.group_id is null or s.group_id = v_group_id)
      and (s.starts_on is null or s.starts_on <= current_date)
      and (s.ends_on is null or s.ends_on >= current_date)
    order by (s.group_id = v_group_id) desc, s.brand_name asc;
end;
$$;

-- Métrica que ve la marca vinculada a un comercio o taller: cuántas personas
-- del club compraron repuestos o contrataron servicios.
create or replace function public.app_sponsor_impact()
returns table (
  sponsor_id uuid,
  brand_name text,
  group_name text,
  club_buyers integer,
  parts_orders integer,
  service_orders integer,
  total_orders integer,
  purchase_amount numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_commerce_id uuid;
  v_workshop_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select cp.id into v_commerce_id
  from public.commerce_profiles cp
  where cp.owner_user_id = v_uid
  limit 1;

  select wp.id into v_workshop_id
  from public.workshop_profiles wp
  where wp.user_id = v_uid
  limit 1;

  return query
    select s.id, s.brand_name, g.name,
           (select count(distinct bp.id)::integer
            from public.buyer_profiles bp
            join public.group_members gm on gm.user_id = bp.user_id
            where (s.group_id is null or gm.group_id = s.group_id)
              and exists (
                select 1
                from public.purchase_orders o
                left join public.purchase_offers off on off.id = o.offer_id
                where o.buyer_id = bp.id
                  and o.status in ('confirmed', 'preparing', 'shipped', 'delivered', 'completed')
                  and (
                    (s.commerce_id is not null and o.commerce_id = s.commerce_id)
                    or (s.workshop_id is not null and off.workshop_id = s.workshop_id)
                  )
              )),
           (select count(*)::integer
            from public.purchase_orders o
            left join public.purchase_offers off on off.id = o.offer_id
            join public.buyer_profiles bp on bp.id = o.buyer_id
            join public.group_members gm on gm.user_id = bp.user_id
            where o.status in ('confirmed', 'preparing', 'shipped', 'delivered', 'completed')
              and o.commerce_id = s.commerce_id
              and off.workshop_id is null
              and (s.group_id is null or gm.group_id = s.group_id)),
           (select count(*)::integer
            from public.purchase_orders o
            join public.purchase_offers off on off.id = o.offer_id
            join public.buyer_profiles bp on bp.id = o.buyer_id
            join public.group_members gm on gm.user_id = bp.user_id
            where o.status in ('confirmed', 'preparing', 'shipped', 'delivered', 'completed')
              and off.workshop_id = s.workshop_id
              and (s.group_id is null or gm.group_id = s.group_id)),
           0,
           0::numeric
    from public.club_sponsors s
    left join public.groups g on g.id = s.group_id
    where s.moderation_status = 'approved'
      and (
        s.created_by = v_uid
        or (s.commerce_id is not null and s.commerce_id = v_commerce_id)
        or (s.workshop_id is not null and s.workshop_id = v_workshop_id)
      )
    order by s.created_at desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs de administración: tarifas
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_sponsorship_rates()
returns table (
  id uuid,
  code text,
  name text,
  amount numeric,
  currency text,
  billing_cycle text,
  description text,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.admin_has_permission('sponsorships.view') then
    raise exception 'No tienes permiso para ver las tarifas de patrocinio.';
  end if;

  return query
    select r.id, r.code, r.name, r.amount, r.currency, r.billing_cycle,
           r.description, r.is_active, r.updated_at
    from public.club_sponsorship_rates r
    order by r.amount asc, r.name asc;
end;
$$;

create or replace function public.admin_save_sponsorship_rate(
  p_id uuid,
  p_code text,
  p_name text,
  p_amount numeric,
  p_currency text,
  p_billing_cycle text,
  p_description text,
  p_is_active boolean
)
returns table (
  id uuid,
  code text,
  name text,
  amount numeric,
  currency text,
  billing_cycle text,
  description text,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_cycle text := coalesce(p_billing_cycle, 'monthly');
  v_id uuid;
  v_before jsonb := '{}'::jsonb;
begin
  if not public.admin_has_permission('sponsorships.manage') then
    raise exception 'No tienes permiso para administrar las tarifas de patrocinio.';
  end if;

  if v_code !~ '^[a-z0-9_]{3,40}$' then
    raise exception 'El código debe tener entre 3 y 40 caracteres (a-z, 0-9, guion bajo).';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'El nombre debe tener entre 2 y 80 caracteres.';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'El costo debe ser un número mayor o igual a cero.';
  end if;

  if v_cycle not in ('monthly', 'one_time') then
    raise exception 'El ciclo debe ser mensual o único.';
  end if;

  if p_id is not null then
    select to_jsonb(r) into v_before
    from public.club_sponsorship_rates r
    where r.id = p_id;

    if v_before is null then
      raise exception 'La tarifa no existe.';
    end if;
  end if;

  insert into public.club_sponsorship_rates (
    id, code, name, amount, currency, billing_cycle, description, is_active, updated_at, updated_by
  )
  values (
    coalesce(p_id, gen_random_uuid()),
    v_code,
    v_name,
    p_amount,
    coalesce(nullif(btrim(coalesce(p_currency, '')), ''), 'MXN'),
    v_cycle,
    nullif(btrim(coalesce(p_description, '')), ''),
    coalesce(p_is_active, true),
    now(),
    auth.uid()
  )
  on conflict (id) do update
    set code = excluded.code,
        name = excluded.name,
        amount = excluded.amount,
        currency = excluded.currency,
        billing_cycle = excluded.billing_cycle,
        description = excluded.description,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
  returning id into v_id;

  insert into public.admin_audit_logs (
    actor_id, action, module, entity_type, entity_id, before_data, after_data, metadata
  )
  values (
    auth.uid(),
    case when p_id is null then 'sponsorships.rate.create' else 'sponsorships.rate.update' end,
    'Patrocinios',
    'club_sponsorship_rate',
    v_id::text,
    v_before,
    jsonb_build_object('code', v_code, 'name', v_name, 'amount', p_amount,
                       'billing_cycle', v_cycle, 'is_active', coalesce(p_is_active, true)),
    jsonb_build_object('source', 'admin_panel')
  );

  return query
    select r.id, r.code, r.name, r.amount, r.currency, r.billing_cycle,
           r.description, r.is_active, r.updated_at
    from public.club_sponsorship_rates r
    where r.id = v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs de administración: marcas, vigencia y aprobación
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_club_sponsors(
  p_search text default null,
  p_status text default null
)
returns table (
  id uuid,
  brand_name text,
  group_id uuid,
  group_name text,
  logo_url text,
  benefit text,
  discount_percent numeric,
  contact_email text,
  commerce_id uuid,
  workshop_id uuid,
  rate_id uuid,
  rate_name text,
  amount numeric,
  currency text,
  billing_cycle text,
  starts_on date,
  ends_on date,
  moderation_status text,
  lifecycle_status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_term text := lower(btrim(coalesce(p_search, '')));
  v_status text := btrim(coalesce(p_status, 'all'));
begin
  if not public.admin_has_permission('sponsorships.view') then
    raise exception 'No tienes permiso para ver los patrocinios del club.';
  end if;

  return query
    select s.id, s.brand_name, s.group_id, g.name, s.logo_url, s.benefit,
           s.discount_percent, s.contact_email, s.commerce_id, s.workshop_id,
           s.rate_id, r.name, s.amount, s.currency, s.billing_cycle,
           s.starts_on, s.ends_on, s.moderation_status,
           public.club_sponsor_lifecycle(s.moderation_status, s.starts_on, s.ends_on),
           s.created_at
    from public.club_sponsors s
    left join public.groups g on g.id = s.group_id
    left join public.club_sponsorship_rates r on r.id = s.rate_id
    where (v_term = ''
           or lower(s.brand_name) like '%' || v_term || '%'
           or lower(coalesce(g.name, '')) like '%' || v_term || '%'
           or lower(coalesce(s.contact_email, '')) like '%' || v_term || '%')
      and (v_status = 'all'
           or s.moderation_status = v_status
           or public.club_sponsor_lifecycle(s.moderation_status, s.starts_on, s.ends_on) = v_status)
    order by s.created_at desc;
end;
$$;

create or replace function public.admin_save_club_sponsor(
  p_id uuid,
  p_group_id uuid,
  p_brand_name text,
  p_logo_url text,
  p_benefit text,
  p_discount_percent numeric,
  p_contact_email text,
  p_commerce_id uuid,
  p_workshop_id uuid,
  p_rate_id uuid,
  p_amount numeric,
  p_currency text,
  p_billing_cycle text,
  p_starts_on date,
  p_ends_on date
)
returns table (id uuid, brand_name text, moderation_status text, lifecycle_status text)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_name text := btrim(coalesce(p_brand_name, ''));
  v_cycle text := coalesce(p_billing_cycle, 'monthly');
  v_id uuid;
  v_before jsonb := '{}'::jsonb;
begin
  if not public.admin_has_permission('sponsorships.manage') then
    raise exception 'No tienes permiso para administrar marcas patrocinadoras.';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'El nombre de la marca debe tener entre 2 y 120 caracteres.';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'El costo debe ser un número mayor o igual a cero.';
  end if;

  if v_cycle not in ('monthly', 'one_time') then
    raise exception 'El ciclo debe ser mensual o único.';
  end if;

  if p_ends_on is not null and p_starts_on is not null and p_ends_on < p_starts_on then
    raise exception 'La fecha de fin no puede ser anterior a la de inicio.';
  end if;

  if p_id is not null then
    select to_jsonb(s) into v_before
    from public.club_sponsors s
    where s.id = p_id;

    if v_before is null then
      raise exception 'El patrocinio no existe.';
    end if;
  end if;

  insert into public.club_sponsors (
    id, group_id, brand_name, logo_url, benefit, discount_percent, contact_email,
    commerce_id, workshop_id, rate_id, amount, currency, billing_cycle,
    starts_on, ends_on, created_by, updated_at
  )
  values (
    coalesce(p_id, gen_random_uuid()),
    p_group_id,
    v_name,
    nullif(btrim(coalesce(p_logo_url, '')), ''),
    nullif(btrim(coalesce(p_benefit, '')), ''),
    p_discount_percent,
    nullif(btrim(coalesce(p_contact_email, '')), ''),
    p_commerce_id,
    p_workshop_id,
    p_rate_id,
    p_amount,
    coalesce(nullif(btrim(coalesce(p_currency, '')), ''), 'MXN'),
    v_cycle,
    p_starts_on,
    p_ends_on,
    auth.uid(),
    now()
  )
  on conflict (id) do update
    set group_id = excluded.group_id,
        brand_name = excluded.brand_name,
        logo_url = excluded.logo_url,
        benefit = excluded.benefit,
        discount_percent = excluded.discount_percent,
        contact_email = excluded.contact_email,
        commerce_id = excluded.commerce_id,
        workshop_id = excluded.workshop_id,
        rate_id = excluded.rate_id,
        amount = excluded.amount,
        currency = excluded.currency,
        billing_cycle = excluded.billing_cycle,
        starts_on = excluded.starts_on,
        ends_on = excluded.ends_on,
        updated_at = excluded.updated_at
  returning id into v_id;

  insert into public.admin_audit_logs (
    actor_id, action, module, entity_type, entity_id, before_data, after_data, metadata
  )
  values (
    auth.uid(),
    case when p_id is null then 'sponsorships.brand.create' else 'sponsorships.brand.update' end,
    'Patrocinios',
    'club_sponsor',
    v_id::text,
    v_before,
    jsonb_build_object('brand_name', v_name, 'amount', p_amount,
                       'billing_cycle', v_cycle, 'starts_on', p_starts_on, 'ends_on', p_ends_on),
    jsonb_build_object('source', 'admin_panel')
  );

  return query
    select s.id, s.brand_name, s.moderation_status,
           public.club_sponsor_lifecycle(s.moderation_status, s.starts_on, s.ends_on)
    from public.club_sponsors s
    where s.id = v_id;
end;
$$;

create or replace function public.admin_set_club_sponsor_status(
  p_id uuid,
  p_status text,
  p_reason text default null
)
returns table (id uuid, brand_name text, moderation_status text, lifecycle_status text)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_status text := btrim(coalesce(p_status, ''));
  v_before jsonb;
  v_brand text;
begin
  if not public.admin_has_permission('sponsorships.manage') then
    raise exception 'No tienes permiso para aprobar o rechazar marcas patrocinadoras.';
  end if;

  if v_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Estado de aprobación no válido.';
  end if;

  select to_jsonb(s), s.brand_name into v_before, v_brand
  from public.club_sponsors s
  where s.id = p_id;

  if v_before is null then
    raise exception 'El patrocinio no existe.';
  end if;

  update public.club_sponsors s
  set moderation_status = v_status,
      review_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where s.id = p_id;

  insert into public.admin_audit_logs (
    actor_id, action, module, entity_type, entity_id, before_data, after_data, metadata
  )
  values (
    auth.uid(),
    case v_status
      when 'approved' then 'sponsorships.brand.approve'
      when 'rejected' then 'sponsorships.brand.reject'
      else 'sponsorships.brand.pending'
    end,
    'Patrocinios',
    'club_sponsor',
    p_id::text,
    v_before,
    jsonb_build_object('moderation_status', v_status, 'review_reason', p_reason),
    jsonb_build_object('brand_name', v_brand)
  );

  return query
    select s.id, s.brand_name, s.moderation_status,
           public.club_sponsor_lifecycle(s.moderation_status, s.starts_on, s.ends_on)
    from public.club_sponsors s
    where s.id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Visión financiera y de rendimiento
-- -----------------------------------------------------------------------------
create or replace function public.admin_sponsorship_overview()
returns table (
  pending_brands integer,
  approved_brands integer,
  active_brands integer,
  expiring_brands integer,
  expired_brands integer,
  monthly_revenue numeric,
  one_time_revenue numeric,
  total_revenue numeric,
  groups_reached integer,
  buyers_reached integer,
  orders_attributed integer,
  purchase_amount numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.admin_has_permission('sponsorships.finance') then
    raise exception 'No tienes permiso para consultar la visión financiera de patrocinios.';
  end if;

  return query
    with lifecycle as (
      select s.id, s.group_id, s.commerce_id, s.workshop_id, s.amount, s.billing_cycle,
             public.club_sponsor_lifecycle(s.moderation_status, s.starts_on, s.ends_on) as status
      from public.club_sponsors s
    ),
    attributed as (
      select l.id as sponsor_id,
             count(distinct bp.id)::integer as buyers,
             count(o.id)::integer as orders,
             coalesce(sum(o.total_amount), 0) as amount
      from lifecycle l
      left join public.group_members gm on gm.group_id = l.group_id
      left join public.buyer_profiles bp on bp.user_id = gm.user_id
      left join public.purchase_orders o on o.buyer_id = bp.id
        and o.status in ('confirmed', 'preparing', 'shipped', 'delivered', 'completed')
      group by l.id
    )
    select
      (select count(*)::integer from public.club_sponsors s where s.moderation_status = 'pending'),
      (select count(*)::integer from public.club_sponsors s where s.moderation_status = 'approved'),
      (select count(*)::integer from lifecycle l where l.status = 'active'),
      (select count(*)::integer from lifecycle l where l.status = 'expiring'),
      (select count(*)::integer from lifecycle l where l.status = 'expired'),
      coalesce((select sum(l.amount) from lifecycle l
                where l.status in ('active', 'expiring', 'scheduled')
                  and l.billing_cycle = 'monthly'), 0),
      coalesce((select sum(l.amount) from lifecycle l
                where l.status in ('active', 'expiring', 'scheduled', 'expired')
                  and l.billing_cycle = 'one_time'), 0),
      coalesce((select sum(l.amount) from lifecycle l
                where l.status in ('active', 'expiring', 'scheduled', 'expired')), 0),
      (select count(distinct l.group_id)::integer from lifecycle l
       where l.group_id is not null and l.status in ('active', 'expiring', 'scheduled')),
      coalesce((select sum(a.buyers)::integer from attributed a), 0),
      coalesce((select sum(a.orders)::integer from attributed a), 0),
      coalesce((select sum(a.amount) from attributed a), 0);
end;
$$;

create or replace function public.admin_sponsor_impact_report()
returns table (
  sponsor_id uuid,
  brand_name text,
  group_name text,
  moderation_status text,
  lifecycle_status text,
  club_buyers integer,
  parts_orders integer,
  service_orders integer,
  total_orders integer,
  purchase_amount numeric,
  amount numeric,
  billing_cycle text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.admin_has_permission('sponsorships.finance') then
    raise exception 'No tienes permiso para consultar el impacto comercial de patrocinios.';
  end if;

  return query
    select s.id, s.brand_name, g.name, s.moderation_status,
           public.club_sponsor_lifecycle(s.moderation_status, s.starts_on, s.ends_on),
           (select count(distinct bp.id)::integer
            from public.group_members gm
            join public.buyer_profiles bp on bp.user_id = gm.user_id
            where (s.group_id is null or gm.group_id = s.group_id)),
           (select count(*)::integer
            from public.purchase_orders o
            left join public.purchase_offers off on off.id = o.offer_id
            join public.buyer_profiles bp on bp.id = o.buyer_id
            join public.group_members gm on gm.user_id = bp.user_id
            where o.status in ('confirmed', 'preparing', 'shipped', 'delivered', 'completed')
              and (s.commerce_id is null or o.commerce_id = s.commerce_id)
              and off.workshop_id is null
              and (s.group_id is null or gm.group_id = s.group_id)),
           (select count(*)::integer
            from public.purchase_orders o
            join public.purchase_offers off on off.id = o.offer_id
            join public.buyer_profiles bp on bp.id = o.buyer_id
            join public.group_members gm on gm.user_id = bp.user_id
            where o.status in ('confirmed', 'preparing', 'shipped', 'delivered', 'completed')
              and (s.workshop_id is null or off.workshop_id = s.workshop_id)
              and (s.group_id is null or gm.group_id = s.group_id)),
           0,
           0::numeric,
           s.amount,
           s.billing_cycle
    from public.club_sponsors s
    left join public.groups g on g.id = s.group_id
    order by s.created_at desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants (mismo patrón del proyecto: execute a authenticated, control en RPC)
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select on public.club_sponsorship_rates to authenticated;
grant select, insert, delete on public.group_messages to authenticated;
grant select, insert on public.group_events to authenticated;
grant select, insert, update on public.group_event_rsvps to authenticated;
grant select, insert, update on public.club_sponsors to authenticated;

revoke all on function public.club_sponsor_lifecycle(text, date, date) from public;
revoke all on function public.app_club_identity() from public;
revoke all on function public.app_update_group_identity(text, text, text, text) from public;
revoke all on function public.app_group_messages(integer) from public;
revoke all on function public.app_group_send_message(text) from public;
revoke all on function public.app_group_events() from public;
revoke all on function public.app_group_create_event(text, text, text, timestamptz) from public;
revoke all on function public.app_group_rsvp(uuid, text) from public;
revoke all on function public.app_club_sponsors() from public;
revoke all on function public.app_sponsor_impact() from public;
revoke all on function public.admin_list_sponsorship_rates() from public;
revoke all on function public.admin_save_sponsorship_rate(uuid, text, text, numeric, text, text, text, boolean) from public;
revoke all on function public.admin_list_club_sponsors(text, text) from public;
revoke all on function public.admin_save_club_sponsor(uuid, uuid, text, text, text, numeric, text, uuid, uuid, uuid, numeric, text, text, date, date) from public;
revoke all on function public.admin_set_club_sponsor_status(uuid, text, text) from public;
revoke all on function public.admin_sponsorship_overview() from public;
revoke all on function public.admin_sponsor_impact_report() from public;

grant execute on function public.club_sponsor_lifecycle(text, date, date) to authenticated;
grant execute on function public.app_club_identity() to authenticated;
grant execute on function public.app_update_group_identity(text, text, text, text) to authenticated;
grant execute on function public.app_group_messages(integer) to authenticated;
grant execute on function public.app_group_send_message(text) to authenticated;
grant execute on function public.app_group_events() to authenticated;
grant execute on function public.app_group_create_event(text, text, text, timestamptz) to authenticated;
grant execute on function public.app_group_rsvp(uuid, text) to authenticated;
grant execute on function public.app_club_sponsors() to authenticated;
grant execute on function public.app_sponsor_impact() to authenticated;
grant execute on function public.admin_list_sponsorship_rates() to authenticated;
grant execute on function public.admin_save_sponsorship_rate(uuid, text, text, numeric, text, text, text, boolean) to authenticated;
grant execute on function public.admin_list_club_sponsors(text, text) to authenticated;
grant execute on function public.admin_save_club_sponsor(uuid, uuid, text, text, text, numeric, text, uuid, uuid, uuid, numeric, text, text, date, date) to authenticated;
grant execute on function public.admin_set_club_sponsor_status(uuid, text, text) to authenticated;
grant execute on function public.admin_sponsorship_overview() to authenticated;
grant execute on function public.admin_sponsor_impact_report() to authenticated;
