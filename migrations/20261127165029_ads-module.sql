-- =============================================================================
-- Go.go · Módulo de Publicidad
--
-- Migración ADITIVA e idempotente. No modifica campañas de comunicación ni
-- patrocinios: usa tablas y RPCs dedicadas con el prefijo ad_.
--
-- Incorpora:
--   * ad_campaigns: campañas con vigencia, límite de impresiones y contadores.
--   * ad_impressions: eventos deduplicados por campaña + visitante + tipo.
--   * RLS sin políticas directas: todo acceso pasa por RPC SECURITY DEFINER.
--   * Permisos administrativos ads.view / ads.manage con paridad frontend.
--   * RPCs de lectura pública y registro de impresiones/clics.
--   * RPCs administrativas de listado, guardado, pausa y métricas.
--
-- Todas las funciones SECURITY DEFINER nuevas fijan
--   SET search_path = pg_catalog, public, pg_temp
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Tablas
-- -----------------------------------------------------------------------------
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.admin_members(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  headline text not null check (char_length(btrim(headline)) between 2 and 120),
  description text check (char_length(coalesce(description, '')) <= 240),
  image_url text not null check (char_length(btrim(image_url)) between 1 and 2000),
  cta_label text not null default 'Ver más' check (char_length(btrim(cta_label)) between 1 and 60),
  target_path text not null default '/request'
    check (target_path = '' or (target_path like '/%' and target_path not like '//%')),
  starts_at timestamptz,
  ends_at timestamptz,
  impression_limit integer check (impression_limit is null or impression_limit > 0),
  impressions_count integer not null default 0 check (impressions_count >= 0),
  clicks_count integer not null default 0 check (clicks_count >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  constraint ad_campaigns_dates_check
    check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists ad_campaigns_active_window_idx
  on public.ad_campaigns (is_active, starts_at, ends_at, sort_order);
create index if not exists ad_campaigns_created_at_idx
  on public.ad_campaigns (created_at desc);

create table if not exists public.ad_impressions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  viewer_key text not null check (char_length(btrim(viewer_key)) between 8 and 128),
  event_type text not null check (event_type in ('impression', 'click')),
  created_at timestamptz not null default now(),
  constraint ad_impressions_unique_event unique (campaign_id, viewer_key, event_type)
);

create index if not exists ad_impressions_campaign_event_idx
  on public.ad_impressions (campaign_id, event_type, created_at desc);

-- -----------------------------------------------------------------------------
-- 2) RLS: las tablas no tienen políticas directas. Solo las RPC (definer)
--    pueden leer/escribir. Se eliminan políticas previas para que una rerun
--    nunca deje acceso directo accidental.
-- -----------------------------------------------------------------------------
alter table public.ad_campaigns enable row level security;
alter table public.ad_impressions enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('ad_campaigns', 'ad_impressions')
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  end loop;
end
$$;

revoke all on public.ad_campaigns from anon, authenticated;
revoke all on public.ad_impressions from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3) Permisos administrativos (catálogo + roles)
-- -----------------------------------------------------------------------------
insert into public.admin_permissions (key, module, action, label, is_sensitive)
values
  ('ads.view', 'Publicidad', 'view', 'Ver campañas y métricas de publicidad', false),
  ('ads.manage', 'Publicidad', 'manage', 'Crear, editar y pausar campañas de publicidad', true)
on conflict (key) do update
  set module = excluded.module,
      action = excluded.action,
      label = excluded.label,
      is_sensitive = excluded.is_sensitive;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
cross join public.admin_permissions p
where
  (
    r.key in ('superadmin', 'admin', 'commerce_manager')
    and p.key in ('ads.view', 'ads.manage')
  )
  or (
    r.key = 'analyst'
    and p.key = 'ads.view'
  )
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 4) RPCs de la app: campañas vigentes y no agotadas
-- -----------------------------------------------------------------------------
create or replace function public.app_active_ads()
returns table (
  id uuid,
  name text,
  headline text,
  description text,
  image_url text,
  cta_label text,
  target_path text,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select
    c.id,
    c.name,
    c.headline,
    c.description,
    c.image_url,
    c.cta_label,
    c.target_path,
    c.starts_at,
    c.ends_at
  from public.ad_campaigns c
  where c.is_active
    and (c.starts_at is null or c.starts_at <= now())
    and (c.ends_at is null or c.ends_at > now())
    and (c.impression_limit is null or c.impressions_count < c.impression_limit)
  order by c.sort_order asc, c.created_at asc
$$;

-- Helper interno: bloquea la campaña, aplica dedupe y actualiza contadores.
-- No se expone directamente a los roles de la API.
create or replace function public.app_record_ad_event(
  p_campaign_id uuid,
  p_viewer_key text,
  p_event_type text
)
returns table (recorded boolean, impressions_count integer, clicks_count integer)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_viewer text := btrim(coalesce(p_viewer_key, ''));
  v_campaign public.ad_campaigns%rowtype;
  v_inserted integer := 0;
begin
  if p_event_type not in ('impression', 'click') then
    raise exception 'Tipo de evento de publicidad no válido.' using errcode = '22023';
  end if;

  if v_viewer = '' or char_length(v_viewer) < 8 or char_length(v_viewer) > 128 then
    raise exception 'La clave de visualización de publicidad no es válida.' using errcode = '22023';
  end if;

  select * into v_campaign
  from public.ad_campaigns c
  where c.id = p_campaign_id
  for update;

  if not found then
    return query select false, 0, 0;
    return;
  end if;

  if not v_campaign.is_active
     or (v_campaign.starts_at is not null and v_campaign.starts_at > now())
     or (v_campaign.ends_at is not null and v_campaign.ends_at <= now())
     or (v_campaign.impression_limit is not null
         and v_campaign.impressions_count >= v_campaign.impression_limit) then
    return query select false, v_campaign.impressions_count, v_campaign.clicks_count;
    return;
  end if;

  insert into public.ad_impressions (campaign_id, viewer_key, event_type)
  values (p_campaign_id, v_viewer, p_event_type)
  on conflict (campaign_id, viewer_key, event_type) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.ad_campaigns c
    set
      impressions_count = case
        when p_event_type = 'impression' then c.impressions_count + 1
        else c.impressions_count
      end,
      clicks_count = case
        when p_event_type = 'click' then c.clicks_count + 1
        else c.clicks_count
      end,
      updated_at = now()
    where c.id = p_campaign_id
    returning c.impressions_count, c.clicks_count
      into v_campaign.impressions_count, v_campaign.clicks_count;
  end if;

  return query select v_inserted > 0, v_campaign.impressions_count, v_campaign.clicks_count;
end;
$$;

revoke all on function public.app_record_ad_event(uuid, text, text) from public, anon, authenticated;

create or replace function public.app_record_ad_impression(
  p_campaign_id uuid,
  p_viewer_key text
)
returns table (recorded boolean, impressions_count integer, clicks_count integer)
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select * from public.app_record_ad_event(p_campaign_id, p_viewer_key, 'impression')
$$;

create or replace function public.app_record_ad_click(
  p_campaign_id uuid,
  p_viewer_key text
)
returns table (recorded boolean, impressions_count integer, clicks_count integer)
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select * from public.app_record_ad_event(p_campaign_id, p_viewer_key, 'click')
$$;

-- -----------------------------------------------------------------------------
-- 5) RPCs administrativas
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_ad_campaigns(
  p_search text default null,
  p_status text default 'all'
)
returns table (
  id uuid,
  name text,
  headline text,
  description text,
  image_url text,
  cta_label text,
  target_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  impression_limit integer,
  impressions_count integer,
  clicks_count integer,
  remaining_impressions integer,
  sort_order integer,
  is_active boolean,
  lifecycle_status text,
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_term text := btrim(coalesce(p_search, ''));
begin
  if not public.admin_has_permission('ads.view') then
    raise exception 'No tienes permiso para ver la publicidad.' using errcode = '42501';
  end if;

  return query
  with campaigns as (
    select
      c.*,
      case
        when not c.is_active then 'paused'
        when c.impression_limit is not null and c.impressions_count >= c.impression_limit then 'exhausted'
        when c.ends_at is not null and c.ends_at <= now() then 'expired'
        when c.starts_at is not null and c.starts_at > now() then 'scheduled'
        else 'active'
      end as lifecycle_status
    from public.ad_campaigns c
  )
  select
    c.id,
    c.name,
    c.headline,
    c.description,
    c.image_url,
    c.cta_label,
    c.target_path,
    c.starts_at,
    c.ends_at,
    c.impression_limit,
    c.impressions_count,
    c.clicks_count,
    case when c.impression_limit is null then null
         else greatest(c.impression_limit - c.impressions_count, 0) end as remaining_impressions,
    c.sort_order,
    c.is_active,
    c.lifecycle_status,
    c.created_at,
    c.updated_at,
    c.created_by
  from campaigns c
  where (p_status is null or p_status = 'all' or c.lifecycle_status = p_status)
    and (
      v_term = ''
      or lower(coalesce(c.name, '')) like '%' || lower(v_term) || '%'
      or lower(coalesce(c.headline, '')) like '%' || lower(v_term) || '%'
      or lower(coalesce(c.description, '')) like '%' || lower(v_term) || '%'
    )
  order by c.sort_order asc, c.created_at desc;
end;
$$;

create or replace function public.admin_save_ad_campaign(
  p_id uuid default null,
  p_name text default null,
  p_headline text default null,
  p_description text default null,
  p_image_url text default null,
  p_cta_label text default 'Ver más',
  p_target_path text default '/request',
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_impression_limit integer default null,
  p_is_active boolean default true,
  p_sort_order integer default 0
)
returns setof public.ad_campaigns
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_row public.ad_campaigns%rowtype;
  v_previous jsonb := null;
  v_action text;
  v_label text := btrim(coalesce(p_cta_label, 'Ver más'));
  v_path text := btrim(coalesce(p_target_path, '/request'));
begin
  if not public.admin_has_permission('ads.manage') then
    raise exception 'No tienes permiso para administrar la publicidad.' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'El nombre de la campaña debe tener entre 2 y 120 caracteres.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_headline, ''))) not between 2 and 120 then
    raise exception 'El titular debe tener entre 2 y 120 caracteres.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_image_url, '')) = '' then
    raise exception 'La campaña necesita una imagen de banner.' using errcode = '22023';
  end if;
  if v_label = '' then
    v_label := 'Ver más';
  end if;
  if v_path = '' then
    v_path := '/request';
  end if;
  if v_path not like '/%' or v_path like '//%' then
    raise exception 'El destino debe ser una ruta interna de la aplicación.' using errcode = '22023';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'La fecha de fin debe ser posterior a la de inicio.' using errcode = '22023';
  end if;
  if p_impression_limit is not null and p_impression_limit <= 0 then
    raise exception 'El límite de impresiones debe ser mayor a cero.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.ad_campaigns (
      name, headline, description, image_url, cta_label, target_path,
      starts_at, ends_at, impression_limit, is_active, sort_order, created_by
    )
    values (
      btrim(p_name), btrim(p_headline), nullif(btrim(coalesce(p_description, '')), ''),
      btrim(p_image_url), v_label, v_path,
      p_starts_at, p_ends_at, p_impression_limit, coalesce(p_is_active, true),
      coalesce(p_sort_order, 0), public.admin_current_user_id()
    )
    returning * into v_row;
    v_action := 'ads.campaign.create';
  else
    select * into v_row
    from public.ad_campaigns c
    where c.id = p_id
    for update;
    if not found then
      raise exception 'La campaña de publicidad no existe.' using errcode = 'P0002';
    end if;

    v_previous := jsonb_build_object(
      'name', v_row.name,
      'headline', v_row.headline,
      'imageUrl', v_row.image_url,
      'startsAt', v_row.starts_at,
      'endsAt', v_row.ends_at,
      'impressionLimit', v_row.impression_limit,
      'isActive', v_row.is_active,
      'sortOrder', v_row.sort_order
    );

    update public.ad_campaigns c
    set
      name = btrim(p_name),
      headline = btrim(p_headline),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      image_url = btrim(p_image_url),
      cta_label = v_label,
      target_path = v_path,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      impression_limit = p_impression_limit,
      is_active = coalesce(p_is_active, true),
      sort_order = coalesce(p_sort_order, 0),
      updated_at = now()
    where c.id = p_id
    returning * into v_row;
    v_action := 'ads.campaign.update';
  end if;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text,
    before_data, after_data, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    v_action, 'Publicidad', 'ad_campaign', v_row.id::text, null, null,
    v_previous,
    jsonb_build_object(
      'name', v_row.name,
      'headline', v_row.headline,
      'imageUrl', v_row.image_url,
      'startsAt', v_row.starts_at,
      'endsAt', v_row.ends_at,
      'impressionLimit', v_row.impression_limit,
      'isActive', v_row.is_active,
      'sortOrder', v_row.sort_order
    ),
    jsonb_build_object('name', v_row.name, 'mode', 'insforge')
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return next v_row;
end;
$$;

create or replace function public.admin_set_ad_campaign_status(
  p_id uuid,
  p_is_active boolean,
  p_reason text default null
)
returns setof public.ad_campaigns
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_row public.ad_campaigns%rowtype;
begin
  if not public.admin_has_permission('ads.manage') then
    raise exception 'No tienes permiso para pausar o reactivar campañas.' using errcode = '42501';
  end if;

  select * into v_row
  from public.ad_campaigns c
  where c.id = p_id
  for update;
  if not found then
    raise exception 'La campaña de publicidad no existe.' using errcode = 'P0002';
  end if;

  if v_row.is_active <> coalesce(p_is_active, false) then
    update public.ad_campaigns c
    set is_active = coalesce(p_is_active, false), updated_at = now()
    where c.id = p_id
    returning * into v_row;

    insert into public.admin_audit_logs (
      actor_id, actor_name, actor_email, actor_role,
      action, module, entity_type, entity_id, reason_code, reason_text,
      before_data, after_data, metadata
    )
    select
      actor.user_id, actor.display_name, actor.email, actor_role.key,
      case when p_is_active then 'ads.campaign.resume' else 'ads.campaign.pause' end,
      'Publicidad', 'ad_campaign', v_row.id::text, 'ads.status.change', btrim(coalesce(p_reason, '')),
      jsonb_build_object('isActive', not coalesce(p_is_active, false)),
      jsonb_build_object('isActive', coalesce(p_is_active, false)),
      jsonb_build_object('name', v_row.name, 'mode', 'insforge')
    from public.admin_members actor
    join public.admin_roles actor_role on actor_role.id = actor.role_id
    where actor.user_id = public.admin_current_user_id();
  end if;

  return next v_row;
end;
$$;

create or replace function public.admin_ad_overview()
returns table (
  total_campaigns bigint,
  active_campaigns bigint,
  paused_campaigns bigint,
  scheduled_campaigns bigint,
  expired_campaigns bigint,
  exhausted_campaigns bigint,
  total_impressions bigint,
  total_clicks bigint,
  active_impressions_remaining bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.admin_has_permission('ads.view') then
    raise exception 'No tienes permiso para ver las métricas de publicidad.' using errcode = '42501';
  end if;

  return query
  with campaigns as (
    select
      c.*,
      case
        when not c.is_active then 'paused'
        when c.impression_limit is not null and c.impressions_count >= c.impression_limit then 'exhausted'
        when c.ends_at is not null and c.ends_at <= now() then 'expired'
        when c.starts_at is not null and c.starts_at > now() then 'scheduled'
        else 'active'
      end as lifecycle_status
    from public.ad_campaigns c
  )
  select
    count(*),
    count(*) filter (where lifecycle_status = 'active'),
    count(*) filter (where lifecycle_status = 'paused'),
    count(*) filter (where lifecycle_status = 'scheduled'),
    count(*) filter (where lifecycle_status = 'expired'),
    count(*) filter (where lifecycle_status = 'exhausted'),
    coalesce(sum(impressions_count), 0),
    coalesce(sum(clicks_count), 0),
    coalesce(sum(
      case
        when lifecycle_status = 'active' and impression_limit is not null
          then greatest(impression_limit - impressions_count, 0)
        when lifecycle_status = 'active' then 0
        else 0
      end
    ), 0)
  from campaigns;
end;
$$;

create or replace function public.admin_ad_performance_report()
returns table (
  campaign_id uuid,
  name text,
  lifecycle_status text,
  impressions_count integer,
  clicks_count integer,
  remaining_impressions integer,
  ctr numeric,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.admin_has_permission('ads.view') then
    raise exception 'No tienes permiso para ver el rendimiento de publicidad.' using errcode = '42501';
  end if;

  return query
  with campaigns as (
    select
      c.*,
      case
        when not c.is_active then 'paused'
        when c.impression_limit is not null and c.impressions_count >= c.impression_limit then 'exhausted'
        when c.ends_at is not null and c.ends_at <= now() then 'expired'
        when c.starts_at is not null and c.starts_at > now() then 'scheduled'
        else 'active'
      end as lifecycle_status
    from public.ad_campaigns c
  )
  select
    c.id,
    c.name,
    c.lifecycle_status,
    c.impressions_count,
    c.clicks_count,
    case when c.impression_limit is null then null
         else greatest(c.impression_limit - c.impressions_count, 0) end,
    case when c.impressions_count > 0
         then round(c.clicks_count::numeric / c.impressions_count * 100, 2)
         else 0 end,
    c.starts_at,
    c.ends_at
  from campaigns c
  order by c.impressions_count desc, c.name asc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6) Grants de ejecución
-- -----------------------------------------------------------------------------
grant execute on function public.app_active_ads() to authenticated;
grant execute on function public.app_record_ad_impression(uuid, text) to authenticated;
grant execute on function public.app_record_ad_click(uuid, text) to authenticated;

grant execute on function public.admin_list_ad_campaigns(text, text) to authenticated;
grant execute on function public.admin_save_ad_campaign(
  uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, integer, boolean, integer
) to authenticated;
grant execute on function public.admin_set_ad_campaign_status(uuid, boolean, text) to authenticated;
grant execute on function public.admin_ad_overview() to authenticated;
grant execute on function public.admin_ad_performance_report() to authenticated;
