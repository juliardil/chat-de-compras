-- =============================================================================
-- Chat de Compras · Modalidad de atención de los trabajos de servicio
--
-- Migración 100% aditiva y retrocompatible:
--   * `specialty` se reafirma por si este entorno no tiene aplicada la
--     migración anterior de especialidad.
--   * `service_modality` es nullable: las solicitudes antiguas siguen igual.
--   * NO se crean ni modifican políticas RLS. Los grants son a nivel de tabla,
--     así que las columnas nuevas heredan el acceso de lectura/escritura que
--     ya tienen comprador, taller y administrador (vía RPC security definer).
--   * Se exponen ambos campos en la bandeja del taller y en el panel admin.
--
-- Aplicar con:
--   npx -y @insforge/cli db migrations up 20261120174428_service-attention-modality.sql
-- =============================================================================

alter table public.purchase_requests
  add column if not exists specialty text;

alter table public.purchase_requests
  add column if not exists service_modality text;

-- Restringe los valores permitidos sin exigirlos en filas antiguas (null).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_requests_service_modality_check'
      and conrelid = 'public.purchase_requests'::regclass
  ) then
    alter table public.purchase_requests
      add constraint purchase_requests_service_modality_check
      check (
        service_modality is null
        or service_modality in ('Servicio a domicilio', 'Visita al taller')
      );
  end if;
end $$;

-- Refuerzo idempotente: mismo permiso de tabla que ya usa la app.
grant select, insert, update on public.purchase_requests to authenticated;

-- -----------------------------------------------------------------------------
-- Bandeja de trabajos del taller: expone la modalidad junto a la especialidad.
-- PostgreSQL no permite cambiar el tipo de retorno con CREATE OR REPLACE.
-- -----------------------------------------------------------------------------
drop function if exists public.app_available_service_jobs();

create or replace function public.app_available_service_jobs()
returns table (
  id uuid,
  title text,
  description text,
  category text,
  vehicle_type text,
  vehicle_plate text,
  service_zone text,
  specialty text,
  service_modality text,
  created_at timestamptz,
  client_user_id uuid,
  client_name text,
  client_is_club_member boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_workshop_id uuid := public.app_verified_workshop_id();
begin
  if v_workshop_id is null then
    raise exception 'Solo un Taller Verificado puede consultar los trabajos disponibles.';
  end if;

  return query
    select pr.id,
           pr.title,
           pr.description,
           pr.category,
           pr.vehicle_type,
           pr.vehicle_plate,
           pr.service_zone,
           pr.specialty,
           pr.service_modality,
           pr.created_at,
           bp.user_id,
           coalesce(bp.display_name, u.email, 'Comprador'),
           exists (
             select 1
             from public.group_members gm
             where gm.user_id = bp.user_id
             group by gm.user_id
             having count(*) >= (
               select s.min_members from public.group_settings s where s.id = true
             )
           )
    from public.purchase_requests pr
    join public.buyer_profiles bp on bp.id = pr.buyer_id
    left join auth.users u on u.id = bp.user_id
    where pr.request_type = 'service'
      and pr.status = 'open'
      and (
        pr.specialty is null
        or exists (
          select 1
          from public.workshop_profiles wp
          where wp.id = v_workshop_id
            and pr.specialty = any (wp.specialties)
        )
      )
      and not exists (
        select 1 from public.purchase_offers po
        where po.request_id = pr.id and po.workshop_id = v_workshop_id
      )
    order by pr.created_at desc
    limit 100;
end;
$$;

revoke all on function public.app_available_service_jobs() from public;
grant execute on function public.app_available_service_jobs() to authenticated;

-- -----------------------------------------------------------------------------
-- Panel de Administrador: misma firma (text, text) returns jsonb; solo se
-- enriquecen los payloads para mostrar y filtrar especialidad y modalidad.
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_requests(
  p_search text default null,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb := '[]'::jsonb;
begin
  if not public.admin_has_permission('requests.view') then
    raise exception 'No autorizado para ver solicitudes.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(entry.payload), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', r.id,
      'buyerId', r.buyer_id,
      'buyerName', buyer.display_name,
      'title', r.title,
      'description', r.description,
      'categoryId', r.category_id,
      'categoryName', category.name,
      'requestType', r.request_type,
      'specialty', r.specialty,
      'serviceModality', r.service_modality,
      'budgetAmount', r.budget_amount,
      'currency', r.currency,
      'items', r.items,
      'status', r.status,
      'statusReason', r.status_reason,
      'publishedAt', r.published_at,
      'expiresAt', r.expires_at,
      'closedAt', r.closed_at,
      'createdAt', r.created_at,
      'updatedAt', r.updated_at,
      'itemCount', coalesce(jsonb_array_length(r.items), 0),
      'offerCount', (
        select count(*) from public.purchase_offers o where o.request_id = r.id
      ),
      'activeOfferCount', (
        select count(*) from public.purchase_offers o
        where o.request_id = r.id and o.status = 'active'
      )
    ) as payload
    from public.purchase_requests r
    left join public.buyer_profiles buyer on buyer.id = r.buyer_id
    left join public.commerce_categories category on category.id = r.category_id
    where (p_status is null or r.status = p_status)
      and (
        p_search is null
        or r.title ilike '%' || p_search || '%'
        or coalesce(r.description, '') ilike '%' || p_search || '%'
        or coalesce(buyer.display_name, '') ilike '%' || p_search || '%'
        or coalesce(category.name, '') ilike '%' || p_search || '%'
        or coalesce(r.specialty, '') ilike '%' || p_search || '%'
        or coalesce(r.service_modality, '') ilike '%' || p_search || '%'
      )
    order by r.created_at desc
  ) entry;

  return v_result;
end;
$$;

create or replace function public.admin_get_request(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_request jsonb;
  v_offers jsonb := '[]'::jsonb;
begin
  if not public.admin_has_permission('requests.view') then
    raise exception 'No autorizado para ver solicitudes.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', r.id,
    'buyerId', r.buyer_id,
    'buyerName', buyer.display_name,
    'title', r.title,
    'description', r.description,
    'categoryId', r.category_id,
    'categoryName', category.name,
    'requestType', r.request_type,
    'specialty', r.specialty,
    'serviceModality', r.service_modality,
    'budgetAmount', r.budget_amount,
    'currency', r.currency,
    'items', r.items,
    'status', r.status,
    'statusReason', r.status_reason,
    'publishedAt', r.published_at,
    'expiresAt', r.expires_at,
    'closedAt', r.closed_at,
    'createdAt', r.created_at,
    'updatedAt', r.updated_at,
    'itemCount', coalesce(jsonb_array_length(r.items), 0),
    'offerCount', (
      select count(*) from public.purchase_offers o where o.request_id = r.id
    ),
    'activeOfferCount', (
      select count(*) from public.purchase_offers o
      where o.request_id = r.id and o.status = 'active'
    )
  )
  into v_request
  from public.purchase_requests r
  left join public.buyer_profiles buyer on buyer.id = r.buyer_id
  left join public.commerce_categories category on category.id = r.category_id
  where r.id = p_request_id;

  if v_request is null then
    raise exception 'La solicitud no existe.';
  end if;

  if not public.admin_has_permission('offers.view') then
    return v_request || jsonb_build_object('offersRestricted', true, 'offers', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(entry.payload), '[]'::jsonb)
  into v_offers
  from (
    select jsonb_build_object(
      'id', o.id,
      'requestId', o.request_id,
      'requestTitle', r.title,
      'buyerName', buyer.display_name,
      'commerceId', o.commerce_id,
      'commerceName', commerce.trade_name,
      'totalAmount', o.total_amount,
      'currency', o.currency,
      'deliveryDays', o.delivery_days,
      'items', o.items,
      'conditions', o.conditions,
      'status', o.status,
      'statusReason', o.status_reason,
      'itemCount', coalesce(jsonb_array_length(o.items), 0),
      'createdAt', o.created_at,
      'updatedAt', o.updated_at
    ) as payload
    from public.purchase_offers o
    join public.purchase_requests r on r.id = o.request_id
    left join public.buyer_profiles buyer on buyer.id = r.buyer_id
    left join public.commerce_profiles commerce on commerce.id = o.commerce_id
    where o.request_id = p_request_id
    order by o.created_at desc
  ) entry;

  return v_request || jsonb_build_object('offersRestricted', false, 'offers', v_offers);
end;
$$;

revoke all on function public.admin_list_requests(text, text) from public;
grant execute on function public.admin_list_requests(text, text) to authenticated;
revoke all on function public.admin_get_request(uuid) from public;
grant execute on function public.admin_get_request(uuid) to authenticated;
