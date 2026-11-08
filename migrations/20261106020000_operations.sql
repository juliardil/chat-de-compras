-- =============================================================================
-- Chat de Compras · Administrador · Fase 3
-- Operación: solicitudes, ofertas, pedidos, disputas, entregas e incidencias.
--
-- IMPORTANTE:
--   * Este archivo NO se ha ejecutado. Se aplica después de las Fases 1 y 2 con:
--       npx @insforge/cli db migrations up --all
--   * Requiere 20261106000000_admin_foundation.sql y
--     20261106010000_people_catalog.sql aplicadas.
--   * No contiene datos de negocio ni secretos: solo esquema, funciones, RLS y
--     privilegios.
--   * Las máquinas de estados son POLÍTICA DE IMPLEMENTACIÓN de esta fase y
--     deben confirmarse con el negocio. El servidor y la demo aplican las
--     mismas transiciones.
--   * El acceso directo a las tablas queda revocado: todo pasa por funciones
--     SECURITY DEFINER con comprobación de permisos y auditoría.
--   * La evidencia de entrega no se crea desde esta migración. La tabla guarda
--     metadatos y una ruta de almacenamiento privada; la URL firmada solo se
--     emite por función autorizada.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyer_profiles(id) on delete restrict,
  title text not null,
  description text,
  category_id uuid references public.commerce_categories(id) on delete set null,
  budget_amount numeric(12, 2),
  currency text not null default 'USD',
  items jsonb not null default '[]'::jsonb,
  status text not null default 'open'
    check (status in ('open', 'hidden', 'closed', 'cancelled', 'expired')),
  status_reason text,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  commerce_id uuid not null references public.commerce_profiles(id) on delete restrict,
  total_amount numeric(12, 2) not null,
  currency text not null default 'USD',
  delivery_days integer,
  items jsonb not null default '[]'::jsonb,
  conditions text,
  status text not null default 'active'
    check (status in ('active', 'flagged', 'accepted', 'withdrawn', 'withdrawn_admin', 'expired')),
  status_reason text,
  flagged_reason text,
  flagged_at timestamptz,
  flagged_by uuid references auth.users(id) on delete set null,
  withdrawn_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  request_id uuid references public.purchase_requests(id) on delete set null,
  offer_id uuid references public.purchase_offers(id) on delete set null,
  buyer_id uuid not null references public.buyer_profiles(id) on delete restrict,
  commerce_id uuid not null references public.commerce_profiles(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed', 'disputed', 'cancelled')),
  status_reason text,
  total_amount numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  snapshot jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  placed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  event_type text not null,
  status text,
  description text,
  actor_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'resolved')),
  reason text not null,
  resolution text,
  resolution_reason text,
  opened_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz
);

create table if not exists public.order_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.purchase_orders(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'preparing', 'shipped', 'in_transit', 'delivered', 'failed', 'returned', 'cancelled')),
  carrier text,
  tracking_code text,
  status_reason text,
  estimated_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_incidents (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.order_deliveries(id) on delete cascade,
  incident_type text not null
    check (incident_type in ('not_received', 'damaged', 'delayed', 'wrong_address', 'carrier_issue', 'other')),
  description text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  reported_by uuid references auth.users(id) on delete set null,
  reported_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_reason text
);

create table if not exists public.delivery_evidence (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.order_deliveries(id) on delete cascade,
  evidence_type text not null
    check (evidence_type in ('delivery_photo', 'signature', 'delivery_note', 'other')),
  file_name text not null,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  note text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists purchase_requests_status_idx on public.purchase_requests (status);
create index if not exists purchase_requests_buyer_idx on public.purchase_requests (buyer_id);
create index if not exists purchase_requests_created_idx on public.purchase_requests (created_at desc);
create index if not exists purchase_offers_request_idx on public.purchase_offers (request_id);
create index if not exists purchase_offers_commerce_idx on public.purchase_offers (commerce_id);
create index if not exists purchase_offers_status_idx on public.purchase_offers (status);
create index if not exists purchase_orders_status_idx on public.purchase_orders (status);
create index if not exists purchase_orders_buyer_idx on public.purchase_orders (buyer_id);
create index if not exists purchase_orders_commerce_idx on public.purchase_orders (commerce_id);
create index if not exists purchase_orders_created_idx on public.purchase_orders (created_at desc);
create index if not exists purchase_order_events_order_idx on public.purchase_order_events (order_id, created_at);
create index if not exists purchase_order_disputes_order_idx on public.purchase_order_disputes (order_id);
create index if not exists order_deliveries_status_idx on public.order_deliveries (status);
create index if not exists delivery_incidents_delivery_idx on public.delivery_incidents (delivery_id);
create index if not exists delivery_incidents_status_idx on public.delivery_incidents (status);
create index if not exists delivery_evidence_delivery_idx on public.delivery_evidence (delivery_id);

-- -----------------------------------------------------------------------------
-- Inmutabilidad del snapshot del pedido
-- Los ítems y el snapshot se copian al crear el pedido y no pueden cambiar.
-- -----------------------------------------------------------------------------
create or replace function public.admin_guard_order_snapshot()
returns trigger
language plpgsql
as $$
begin
  if new.items is distinct from old.items
     or new.snapshot is distinct from old.snapshot
     or new.request_id is distinct from old.request_id
     or new.offer_id is distinct from old.offer_id
     or new.buyer_id is distinct from old.buyer_id
     or new.commerce_id is distinct from old.commerce_id
     or new.total_amount is distinct from old.total_amount
     or new.currency is distinct from old.currency
     or new.order_number is distinct from old.order_number then
    raise exception 'El snapshot y los ítems del pedido son inmutables.';
  end if;
  return new;
end;
$$;

drop trigger if exists purchase_orders_snapshot_guard on public.purchase_orders;
create trigger purchase_orders_snapshot_guard
before update on public.purchase_orders
for each row execute function public.admin_guard_order_snapshot();

-- -----------------------------------------------------------------------------
-- Helpers de transición (misma política que src/admin/constants/phase3.js)
-- -----------------------------------------------------------------------------
create or replace function public.admin_request_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'open' then p_to in ('hidden', 'closed', 'cancelled')
    when 'hidden' then p_to in ('open', 'closed', 'cancelled')
    when 'expired' then p_to in ('closed', 'cancelled')
    else false
  end;
$$;

create or replace function public.admin_offer_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'active' then p_to in ('flagged', 'withdrawn_admin')
    when 'flagged' then p_to in ('active', 'withdrawn_admin')
    else false
  end;
$$;

create or replace function public.admin_order_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'pending' then p_to in ('confirmed', 'cancelled')
    when 'confirmed' then p_to in ('preparing', 'cancelled', 'disputed')
    when 'preparing' then p_to in ('shipped', 'cancelled', 'disputed')
    when 'shipped' then p_to in ('delivered', 'disputed')
    when 'delivered' then p_to in ('completed', 'disputed')
    when 'completed' then p_to in ('disputed')
    when 'disputed' then p_to in ('completed', 'cancelled')
    else false
  end;
$$;

create or replace function public.admin_delivery_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'pending' then p_to in ('preparing', 'cancelled')
    when 'preparing' then p_to in ('shipped', 'cancelled')
    when 'shipped' then p_to in ('in_transit', 'delivered', 'failed')
    when 'in_transit' then p_to in ('delivered', 'failed')
    when 'failed' then p_to in ('in_transit', 'delivered', 'returned')
    else false
  end;
$$;

create or replace function public.admin_delivery_incident_label(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'not_received' then 'No recibido'
    when 'damaged' then 'Dañado o incompleto'
    when 'delayed' then 'Retraso'
    when 'wrong_address' then 'Dirección incorrecta'
    when 'carrier_issue' then 'Incidencia del transportista'
    else 'Otra incidencia'
  end;
$$;

create or replace function public.admin_delivery_evidence_label(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'delivery_photo' then 'Foto de entrega'
    when 'signature' then 'Firma de recepción'
    when 'delivery_note' then 'Nota de entrega'
    else 'Otra evidencia'
  end;
$$;

-- -----------------------------------------------------------------------------
-- Resumen y detalle de entrega (reutilizado por pedidos y entregas)
-- No comprueba permisos: los RPC que lo llaman lo hacen antes.
-- -----------------------------------------------------------------------------
create or replace function public.admin_delivery_summary(p_delivery_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', d.id,
    'orderId', d.order_id,
    'orderNumber', o.order_number,
    'orderStatus', o.status,
    'orderTotalAmount', o.total_amount,
    'currency', o.currency,
    'buyerName', buyer.display_name,
    'commerceName', commerce.trade_name,
    'status', d.status,
    'carrier', d.carrier,
    'trackingCode', d.tracking_code,
    'statusReason', d.status_reason,
    'estimatedAt', d.estimated_at,
    'shippedAt', d.shipped_at,
    'deliveredAt', d.delivered_at,
    'createdAt', d.created_at,
    'updatedAt', d.updated_at,
    'incidentCount', (
      select count(*) from public.delivery_incidents i where i.delivery_id = d.id
    ),
    'openIncidentCount', (
      select count(*) from public.delivery_incidents i
      where i.delivery_id = d.id and i.status = 'open'
    ),
    'evidenceCount', (
      select count(*) from public.delivery_evidence e where e.delivery_id = d.id
    )
  )
  from public.order_deliveries d
  join public.purchase_orders o on o.id = d.order_id
  left join public.buyer_profiles buyer on buyer.id = o.buyer_id
  left join public.commerce_profiles commerce on commerce.id = o.commerce_id
  where d.id = p_delivery_id;
$$;

create or replace function public.admin_delivery_detail(p_delivery_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_base jsonb;
  v_incidents jsonb := '[]'::jsonb;
  v_evidence jsonb := '[]'::jsonb;
begin
  v_base := public.admin_delivery_summary(p_delivery_id);
  if v_base is null then
    return null;
  end if;

  select coalesce(jsonb_agg(entry.payload), '[]'::jsonb)
  into v_incidents
  from (
    select jsonb_build_object(
      'id', i.id,
      'deliveryId', i.delivery_id,
      'incidentType', i.incident_type,
      'typeLabel', public.admin_delivery_incident_label(i.incident_type),
      'description', i.description,
      'status', i.status,
      'reportedByName', reporter.display_name,
      'reportedAt', i.reported_at,
      'resolvedByName', resolver.display_name,
      'resolvedAt', i.resolved_at,
      'resolutionReason', i.resolution_reason
    ) as payload
    from public.delivery_incidents i
    left join public.admin_members reporter on reporter.user_id = i.reported_by
    left join public.admin_members resolver on resolver.user_id = i.resolved_by
    where i.delivery_id = p_delivery_id
    order by i.reported_at desc
  ) entry;

  select coalesce(jsonb_agg(entry.payload), '[]'::jsonb)
  into v_evidence
  from (
    select jsonb_build_object(
      'id', e.id,
      'deliveryId', e.delivery_id,
      'evidenceType', e.evidence_type,
      'typeLabel', public.admin_delivery_evidence_label(e.evidence_type),
      'fileName', e.file_name,
      'mimeType', e.mime_type,
      'sizeBytes', e.size_bytes,
      'note', e.note,
      'uploadedAt', e.uploaded_at,
      'hasFile', e.storage_path is not null
    ) as payload
    from public.delivery_evidence e
    where e.delivery_id = p_delivery_id
    order by e.uploaded_at desc
  ) entry;

  return v_base || jsonb_build_object('incidents', v_incidents, 'evidence', v_evidence);
end;
$$;

-- -----------------------------------------------------------------------------
-- Solicitudes
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

create or replace function public.admin_set_request_status(
  p_request_id uuid,
  p_status text,
  p_reason text,
  p_reason_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.purchase_requests%rowtype;
  v_previous text;
  v_action text;
  v_permission text;
begin
  select * into v_request from public.purchase_requests where id = p_request_id for update;
  if not found then
    raise exception 'La solicitud no existe.';
  end if;

  if p_status not in ('open', 'hidden', 'closed', 'cancelled', 'expired') then
    raise exception 'Estado de solicitud no válido.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;
  if not public.admin_request_transition_allowed(v_request.status, p_status) then
    raise exception 'Transición de solicitud no permitida.';
  end if;

  v_permission := case
    when p_status in ('hidden', 'open') then 'requests.moderate'
    else 'requests.close'
  end;

  if not public.admin_has_permission(v_permission) then
    raise exception 'No autorizado para cambiar el estado de la solicitud.' using errcode = '42501';
  end if;

  v_previous := v_request.status;
  v_action := case
    when p_status = 'hidden' then 'request.hide'
    when p_status = 'open' then 'request.restore'
    when p_status = 'closed' then 'request.close'
    else 'request.cancel'
  end;

  update public.purchase_requests
  set status = p_status,
      status_reason = trim(p_reason),
      closed_at = case when p_status in ('closed', 'cancelled') then now() else closed_at end,
      updated_at = now()
  where id = p_request_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text,
    before_data, after_data, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    v_action, 'Solicitudes', 'purchase_request', v_request.id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', p_status),
    jsonb_build_object('previousStatus', v_previous, 'newStatus', p_status)
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return jsonb_build_object(
    'id', v_request.id,
    'status', p_status,
    'statusReason', trim(p_reason),
    'updatedAt', now()
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Ofertas
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_offers(
  p_search text default null,
  p_status text default null,
  p_request_id uuid default null
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
  if not public.admin_has_permission('offers.view') then
    raise exception 'No autorizado para ver ofertas.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(entry.payload), '[]'::jsonb)
  into v_result
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
      'flaggedReason', o.flagged_reason,
      'flaggedAt', o.flagged_at,
      'flaggedByName', flagger.display_name,
      'withdrawnAt', o.withdrawn_at,
      'acceptedAt', o.accepted_at,
      'expiresAt', o.expires_at,
      'createdAt', o.created_at,
      'updatedAt', o.updated_at,
      'itemCount', coalesce(jsonb_array_length(o.items), 0)
    ) as payload
    from public.purchase_offers o
    join public.purchase_requests r on r.id = o.request_id
    left join public.buyer_profiles buyer on buyer.id = r.buyer_id
    left join public.commerce_profiles commerce on commerce.id = o.commerce_id
    left join public.admin_members flagger on flagger.user_id = o.flagged_by
    where (p_status is null or o.status = p_status)
      and (p_request_id is null or o.request_id = p_request_id)
      and (
        p_search is null
        or r.title ilike '%' || p_search || '%'
        or coalesce(buyer.display_name, '') ilike '%' || p_search || '%'
        or coalesce(commerce.trade_name, '') ilike '%' || p_search || '%'
        or coalesce(o.conditions, '') ilike '%' || p_search || '%'
        or coalesce(o.status_reason, '') ilike '%' || p_search || '%'
      )
    order by o.created_at desc
  ) entry;

  return v_result;
end;
$$;

create or replace function public.admin_get_offer(p_offer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_offer jsonb;
begin
  if not public.admin_has_permission('offers.view') then
    raise exception 'No autorizado para ver ofertas.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', o.id,
    'requestId', o.request_id,
    'requestTitle', r.title,
    'requestStatus', r.status,
    'requestDescription', r.description,
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
    'flaggedReason', o.flagged_reason,
    'flaggedAt', o.flagged_at,
    'flaggedByName', flagger.display_name,
    'withdrawnAt', o.withdrawn_at,
    'acceptedAt', o.accepted_at,
    'expiresAt', o.expires_at,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'itemCount', coalesce(jsonb_array_length(o.items), 0)
  )
  into v_offer
  from public.purchase_offers o
  join public.purchase_requests r on r.id = o.request_id
  left join public.buyer_profiles buyer on buyer.id = r.buyer_id
  left join public.commerce_profiles commerce on commerce.id = o.commerce_id
  left join public.admin_members flagger on flagger.user_id = o.flagged_by
  where o.id = p_offer_id;

  if v_offer is null then
    raise exception 'La oferta no existe.';
  end if;

  return v_offer;
end;
$$;

create or replace function public.admin_set_offer_status(
  p_offer_id uuid,
  p_status text,
  p_reason text,
  p_reason_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offer public.purchase_offers%rowtype;
  v_previous text;
  v_action text;
  v_permission text;
begin
  select * into v_offer from public.purchase_offers where id = p_offer_id for update;
  if not found then
    raise exception 'La oferta no existe.';
  end if;

  if p_status not in ('active', 'flagged', 'accepted', 'withdrawn', 'withdrawn_admin', 'expired') then
    raise exception 'Estado de oferta no válido.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;
  if not public.admin_offer_transition_allowed(v_offer.status, p_status) then
    raise exception 'Transición de oferta no permitida.';
  end if;

  v_permission := case
    when p_status = 'withdrawn_admin' then 'offers.withdraw_admin'
    else 'offers.flag'
  end;

  if not public.admin_has_permission(v_permission) then
    raise exception 'No autorizado para cambiar el estado de la oferta.' using errcode = '42501';
  end if;

  v_previous := v_offer.status;
  v_action := case
    when p_status = 'withdrawn_admin' then 'offer.withdraw_admin'
    when p_status = 'flagged' then 'offer.flag'
    else 'offer.unflag'
  end;

  update public.purchase_offers
  set status = p_status,
      status_reason = trim(p_reason),
      flagged_reason = case when p_status = 'flagged' then trim(p_reason) when p_status = 'active' then null else flagged_reason end,
      flagged_at = case when p_status = 'flagged' then now() when p_status = 'active' then null else flagged_at end,
      flagged_by = case when p_status = 'flagged' then public.admin_current_user_id() when p_status = 'active' then null else flagged_by end,
      withdrawn_at = case when p_status = 'withdrawn_admin' then now() else withdrawn_at end,
      updated_at = now()
  where id = p_offer_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text,
    before_data, after_data, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    v_action, 'Ofertas', 'purchase_offer', v_offer.id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', p_status),
    jsonb_build_object('previousStatus', v_previous, 'newStatus', p_status, 'requestId', v_offer.request_id)
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return jsonb_build_object(
    'id', v_offer.id,
    'status', p_status,
    'statusReason', trim(p_reason),
    'updatedAt', now()
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Pedidos
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_orders(
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
  v_can_deliveries boolean := public.admin_has_permission('deliveries.view');
begin
  if not public.admin_has_permission('orders.view') then
    raise exception 'No autorizado para ver pedidos.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(entry.payload), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', o.id,
      'orderNumber', o.order_number,
      'requestId', o.request_id,
      'offerId', o.offer_id,
      'buyerId', o.buyer_id,
      'buyerName', buyer.display_name,
      'commerceId', o.commerce_id,
      'commerceName', commerce.trade_name,
      'status', o.status,
      'statusReason', o.status_reason,
      'totalAmount', o.total_amount,
      'currency', o.currency,
      'snapshot', o.snapshot,
      'items', o.items,
      'placedAt', o.placed_at,
      'confirmedAt', o.confirmed_at,
      'deliveredAt', o.delivered_at,
      'completedAt', o.completed_at,
      'cancelledAt', o.cancelled_at,
      'createdAt', o.created_at,
      'updatedAt', o.updated_at,
      'itemCount', coalesce(jsonb_array_length(o.items), 0),
      'deliveryId', (
        select d.id from public.order_deliveries d where d.order_id = o.id
      ),
      'deliveryStatus', case
        when v_can_deliveries then (
          select d.status from public.order_deliveries d where d.order_id = o.id
        )
        else null
      end,
      'hasOpenDispute', exists (
        select 1 from public.purchase_order_disputes dispute
        where dispute.order_id = o.id and dispute.status = 'open'
      )
    ) as payload
    from public.purchase_orders o
    left join public.buyer_profiles buyer on buyer.id = o.buyer_id
    left join public.commerce_profiles commerce on commerce.id = o.commerce_id
    where (p_status is null or o.status = p_status)
      and (
        p_search is null
        or o.order_number ilike '%' || p_search || '%'
        or coalesce(o.snapshot ->> 'requestTitle', '') ilike '%' || p_search || '%'
        or coalesce(o.snapshot ->> 'commerceTradeName', '') ilike '%' || p_search || '%'
        or coalesce(buyer.display_name, '') ilike '%' || p_search || '%'
        or coalesce(commerce.trade_name, '') ilike '%' || p_search || '%'
      )
    order by o.created_at desc
  ) entry;

  return v_result;
end;
$$;

create or replace function public.admin_get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_order jsonb;
  v_timeline jsonb := '[]'::jsonb;
  v_disputes jsonb := '[]'::jsonb;
  v_delivery jsonb := null;
  v_delivery_id uuid;
  v_can_deliveries boolean := public.admin_has_permission('deliveries.view');
begin
  if not public.admin_has_permission('orders.view') then
    raise exception 'No autorizado para ver pedidos.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'requestId', o.request_id,
    'offerId', o.offer_id,
    'buyerId', o.buyer_id,
    'buyerName', buyer.display_name,
    'commerceId', o.commerce_id,
    'commerceName', commerce.trade_name,
    'status', o.status,
    'statusReason', o.status_reason,
    'totalAmount', o.total_amount,
    'currency', o.currency,
    'snapshot', o.snapshot,
    'items', o.items,
    'placedAt', o.placed_at,
    'confirmedAt', o.confirmed_at,
    'deliveredAt', o.delivered_at,
    'completedAt', o.completed_at,
    'cancelledAt', o.cancelled_at,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'itemCount', coalesce(jsonb_array_length(o.items), 0),
    'deliveryId', (
      select d.id from public.order_deliveries d where d.order_id = o.id
    ),
    'deliveryStatus', case
      when v_can_deliveries then (
        select d.status from public.order_deliveries d where d.order_id = o.id
      )
      else null
    end,
    'hasOpenDispute', exists (
      select 1 from public.purchase_order_disputes dispute
      where dispute.order_id = o.id and dispute.status = 'open'
    ),
    'deliveryRestricted', not v_can_deliveries
  )
  into v_order
  from public.purchase_orders o
  left join public.buyer_profiles buyer on buyer.id = o.buyer_id
  left join public.commerce_profiles commerce on commerce.id = o.commerce_id
  where o.id = p_order_id;

  if v_order is null then
    raise exception 'El pedido no existe.';
  end if;

  select coalesce(jsonb_agg(entry.payload), '[]'::jsonb)
  into v_timeline
  from (
    select jsonb_build_object(
      'id', e.id,
      'orderId', e.order_id,
      'eventType', e.event_type,
      'status', e.status,
      'description', e.description,
      'actorName', e.actor_name,
      'metadata', e.metadata,
      'createdAt', e.created_at
    ) as payload
    from public.purchase_order_events e
    where e.order_id = p_order_id
    order by e.created_at asc
  ) entry;

  select coalesce(jsonb_agg(entry.payload), '[]'::jsonb)
  into v_disputes
  from (
    select jsonb_build_object(
      'id', dispute.id,
      'orderId', dispute.order_id,
      'status', dispute.status,
      'reason', dispute.reason,
      'resolution', dispute.resolution,
      'resolutionReason', dispute.resolution_reason,
      'openedByName', opener.display_name,
      'openedAt', dispute.opened_at,
      'resolvedByName', resolver.display_name,
      'resolvedAt', dispute.resolved_at
    ) as payload
    from public.purchase_order_disputes dispute
    left join public.admin_members opener on opener.user_id = dispute.opened_by
    left join public.admin_members resolver on resolver.user_id = dispute.resolved_by
    where dispute.order_id = p_order_id
    order by dispute.opened_at desc
  ) entry;

  if v_can_deliveries then
    select d.id into v_delivery_id
    from public.order_deliveries d
    where d.order_id = p_order_id;

    if v_delivery_id is not null then
      v_delivery := public.admin_delivery_detail(v_delivery_id);
    end if;
  end if;

  return v_order || jsonb_build_object(
    'timeline', v_timeline,
    'disputes', v_disputes,
    'delivery', v_delivery
  );
end;
$$;

create or replace function public.admin_transition_order(
  p_order_id uuid,
  p_status text,
  p_reason text,
  p_reason_code text default null,
  p_resolution text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_dispute public.purchase_order_disputes%rowtype;
  v_previous text;
  v_action text;
  v_permission text;
  v_event_type text;
begin
  select * into v_order from public.purchase_orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe.';
  end if;

  if p_status not in ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed', 'disputed', 'cancelled') then
    raise exception 'Estado de pedido no válido.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;
  if not public.admin_order_transition_allowed(v_order.status, p_status) then
    raise exception 'Transición de pedido no permitida.';
  end if;

  v_permission := case
    when v_order.status = 'disputed' then 'orders.resolve_dispute'
    when p_status = 'cancelled' then 'orders.cancel'
    else 'orders.transition'
  end;

  if not public.admin_has_permission(v_permission) then
    raise exception 'No autorizado para cambiar el estado del pedido.' using errcode = '42501';
  end if;

  if v_order.status = 'disputed' then
    if p_resolution is null
       or p_resolution not in ('favor_buyer', 'favor_commerce', 'partial', 'no_fault', 'other') then
      raise exception 'Debes indicar una resolución válida para la disputa.';
    end if;

    select * into v_dispute
    from public.purchase_order_disputes
    where order_id = p_order_id and status = 'open'
    order by opened_at desc
    limit 1
    for update;

    if not found then
      raise exception 'El pedido no tiene una disputa abierta que resolver.';
    end if;
  end if;

  v_previous := v_order.status;

  update public.purchase_orders
  set status = p_status,
      status_reason = trim(p_reason),
      confirmed_at = case when p_status = 'confirmed' and confirmed_at is null then now() else confirmed_at end,
      delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
      completed_at = case when p_status = 'completed' then now() else completed_at end,
      cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
      updated_at = now()
  where id = p_order_id;

  if p_status = 'disputed' then
    insert into public.purchase_order_disputes (order_id, status, reason, opened_by, opened_at)
    values (p_order_id, 'open', trim(p_reason), public.admin_current_user_id(), now());
  end if;

  if v_order.status = 'disputed' then
    update public.purchase_order_disputes
    set status = 'resolved',
        resolution = p_resolution,
        resolution_reason = trim(p_reason),
        resolved_by = public.admin_current_user_id(),
        resolved_at = now()
    where id = v_dispute.id;
  end if;

  v_action := case
    when v_order.status = 'disputed' then 'order.resolve_dispute'
    when p_status = 'disputed' then 'order.dispute'
    when p_status = 'cancelled' then 'order.cancel'
    else 'order.transition'
  end;

  v_event_type := case
    when v_order.status = 'disputed' then 'dispute_resolved'
    else p_status
  end;

  insert into public.purchase_order_events (order_id, event_type, status, description, actor_name, metadata)
  select
    p_order_id, v_event_type, p_status, trim(p_reason), actor.display_name,
    jsonb_build_object('reasonCode', p_reason_code, 'resolution', p_resolution)
  from public.admin_members actor
  where actor.user_id = public.admin_current_user_id();

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text,
    before_data, after_data, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    v_action, 'Pedidos', 'purchase_order', v_order.id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', p_status),
    jsonb_build_object('previousStatus', v_previous, 'newStatus', p_status, 'resolution', p_resolution)
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return public.admin_get_order(p_order_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Entregas e incidencias
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_deliveries(
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
  if not public.admin_has_permission('deliveries.view') then
    raise exception 'No autorizado para ver entregas.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(entry.payload), '[]'::jsonb)
  into v_result
  from (
    select public.admin_delivery_summary(d.id) as payload
    from public.order_deliveries d
    join public.purchase_orders o on o.id = d.order_id
    left join public.buyer_profiles buyer on buyer.id = o.buyer_id
    left join public.commerce_profiles commerce on commerce.id = o.commerce_id
    where (p_status is null or d.status = p_status)
      and (
        p_search is null
        or o.order_number ilike '%' || p_search || '%'
        or coalesce(buyer.display_name, '') ilike '%' || p_search || '%'
        or coalesce(commerce.trade_name, '') ilike '%' || p_search || '%'
        or coalesce(d.carrier, '') ilike '%' || p_search || '%'
        or coalesce(d.tracking_code, '') ilike '%' || p_search || '%'
      )
    order by d.updated_at desc
  ) entry;

  return v_result;
end;
$$;

create or replace function public.admin_get_delivery(p_delivery_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery jsonb;
begin
  if not public.admin_has_permission('deliveries.view') then
    raise exception 'No autorizado para ver entregas.' using errcode = '42501';
  end if;

  v_delivery := public.admin_delivery_detail(p_delivery_id);
  if v_delivery is null then
    raise exception 'La entrega no existe.';
  end if;

  return v_delivery;
end;
$$;

create or replace function public.admin_update_delivery(
  p_delivery_id uuid,
  p_status text,
  p_reason text,
  p_reason_code text default null,
  p_carrier text default null,
  p_tracking_code text default null,
  p_estimated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery public.order_deliveries%rowtype;
  v_previous text;
  v_permission text;
begin
  select * into v_delivery from public.order_deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'La entrega no existe.';
  end if;

  if p_status not in ('pending', 'preparing', 'shipped', 'in_transit', 'delivered', 'failed', 'returned', 'cancelled') then
    raise exception 'Estado de entrega no válido.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;
  if not public.admin_delivery_transition_allowed(v_delivery.status, p_status) then
    raise exception 'Transición de entrega no permitida.';
  end if;

  v_permission := case when p_status = 'delivered' then 'deliveries.confirm' else 'deliveries.update' end;
  if not public.admin_has_permission(v_permission) then
    raise exception 'No autorizado para actualizar la entrega.' using errcode = '42501';
  end if;

  v_previous := v_delivery.status;

  update public.order_deliveries
  set status = p_status,
      status_reason = trim(p_reason),
      carrier = coalesce(p_carrier, carrier),
      tracking_code = coalesce(p_tracking_code, tracking_code),
      estimated_at = coalesce(p_estimated_at, estimated_at),
      shipped_at = case when p_status = 'shipped' and shipped_at is null then now() else shipped_at end,
      delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
      updated_at = now()
  where id = p_delivery_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text,
    before_data, after_data, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    case when p_status = 'delivered' then 'delivery.confirm' else 'delivery.update' end,
    'Entregas', 'order_delivery', v_delivery.id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', p_status),
    jsonb_build_object('previousStatus', v_previous, 'newStatus', p_status, 'orderId', v_delivery.order_id)
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return public.admin_delivery_detail(p_delivery_id);
end;
$$;

create or replace function public.admin_confirm_delivery(
  p_delivery_id uuid,
  p_reason text,
  p_reason_code text default 'received'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.admin_update_delivery(
    p_delivery_id,
    'delivered',
    p_reason,
    p_reason_code,
    null,
    null,
    null
  );
end;
$$;

create or replace function public.admin_report_delivery_incident(
  p_delivery_id uuid,
  p_incident_type text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery public.order_deliveries%rowtype;
  v_incident public.delivery_incidents%rowtype;
begin
  if not public.admin_has_permission('deliveries.update') then
    raise exception 'No autorizado para registrar incidencias.' using errcode = '42501';
  end if;

  if p_incident_type not in ('not_received', 'damaged', 'delayed', 'wrong_address', 'carrier_issue', 'other') then
    raise exception 'Tipo de incidencia no válido.';
  end if;
  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'La descripción es obligatoria.';
  end if;

  select * into v_delivery from public.order_deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'La entrega no existe.';
  end if;

  insert into public.delivery_incidents (
    delivery_id, incident_type, description, status, reported_by, reported_at
  )
  values (
    p_delivery_id, p_incident_type, trim(p_description), 'open',
    public.admin_current_user_id(), now()
  )
  returning * into v_incident;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text,
    metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'delivery.incident', 'Entregas', 'order_delivery', v_delivery.id::text,
    p_incident_type, trim(p_description),
    jsonb_build_object('incidentId', v_incident.id, 'incidentType', p_incident_type, 'orderId', v_delivery.order_id)
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return public.admin_delivery_detail(p_delivery_id);
end;
$$;

create or replace function public.admin_resolve_delivery_incident(
  p_incident_id uuid,
  p_resolution_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_incident public.delivery_incidents%rowtype;
begin
  if not public.admin_has_permission('deliveries.update') then
    raise exception 'No autorizado para resolver incidencias.' using errcode = '42501';
  end if;

  if p_resolution_reason is null or length(trim(p_resolution_reason)) = 0 then
    raise exception 'La resolución es obligatoria.';
  end if;

  select * into v_incident from public.delivery_incidents where id = p_incident_id for update;
  if not found then
    raise exception 'La incidencia no existe.';
  end if;
  if v_incident.status = 'resolved' then
    raise exception 'La incidencia ya está resuelta.';
  end if;

  update public.delivery_incidents
  set status = 'resolved',
      resolution_reason = trim(p_resolution_reason),
      resolved_by = public.admin_current_user_id(),
      resolved_at = now()
  where id = p_incident_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text,
    metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'delivery.incident.resolve', 'Entregas', 'delivery_incident', v_incident.id::text,
    null, trim(p_resolution_reason),
    jsonb_build_object('deliveryId', v_incident.delivery_id, 'incidentType', v_incident.incident_type)
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return jsonb_build_object(
    'id', v_incident.id,
    'deliveryId', v_incident.delivery_id,
    'incidentType', v_incident.incident_type,
    'typeLabel', public.admin_delivery_incident_label(v_incident.incident_type),
    'description', v_incident.description,
    'status', 'resolved',
    'resolutionReason', trim(p_resolution_reason),
    'resolvedAt', now()
  );
end;
$$;

create or replace function public.admin_delivery_evidence_path(p_evidence_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_path text;
begin
  if not public.admin_has_permission('deliveries.view') then
    raise exception 'No autorizado para ver evidencias de entrega.' using errcode = '42501';
  end if;

  select storage_path into v_path
  from public.delivery_evidence
  where id = p_evidence_id;

  if not found then
    raise exception 'La evidencia no existe.';
  end if;

  return jsonb_build_object('storagePath', v_path);
end;
$$;

-- -----------------------------------------------------------------------------
-- Panel: métricas ampliadas con operación
-- Reemplaza la versión de Fase 2 manteniendo sus claves.
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_can_staff boolean := public.admin_has_permission('staff.view');
  v_can_audit boolean := public.admin_has_permission('audit.view');
  v_can_buyers boolean := public.admin_has_permission('users.view');
  v_can_commerce boolean := public.admin_has_permission('commerce.view');
  v_can_documents boolean := public.admin_has_permission('commerce.documents.view');
  v_can_catalog boolean := public.admin_has_permission('catalog.view');
  v_can_requests boolean := public.admin_has_permission('requests.view');
  v_can_offers boolean := public.admin_has_permission('offers.view');
  v_can_orders boolean := public.admin_has_permission('orders.view');
  v_can_deliveries boolean := public.admin_has_permission('deliveries.view');
  v_active_members integer := 0;
  v_suspended_members integer := 0;
  v_total_members integer := 0;
  v_pending_invitations integer := 0;
  v_audit_today integer := 0;
  v_active_buyers integer := 0;
  v_suspended_buyers integer := 0;
  v_blocked_buyers integer := 0;
  v_total_buyers integer := 0;
  v_pending_commerces integer := 0;
  v_in_review_commerces integer := 0;
  v_approved_commerces integer := 0;
  v_suspended_commerces integer := 0;
  v_total_commerces integer := 0;
  v_active_categories integer := 0;
  v_inactive_categories integer := 0;
  v_total_categories integer := 0;
  v_pending_documents integer := 0;
  v_verified_documents integer := 0;
  v_rejected_documents integer := 0;
  v_total_documents integer := 0;
  v_open_requests integer := 0;
  v_hidden_requests integer := 0;
  v_expired_requests integer := 0;
  v_closed_requests integer := 0;
  v_total_requests integer := 0;
  v_active_offers integer := 0;
  v_flagged_offers integer := 0;
  v_withdrawn_offers integer := 0;
  v_total_offers integer := 0;
  v_pending_orders integer := 0;
  v_in_progress_orders integer := 0;
  v_disputed_orders integer := 0;
  v_completed_orders integer := 0;
  v_cancelled_orders integer := 0;
  v_total_orders integer := 0;
  v_pending_deliveries integer := 0;
  v_in_transit_deliveries integer := 0;
  v_failed_deliveries integer := 0;
  v_delivered_deliveries integer := 0;
  v_open_incidents integer := 0;
  v_total_deliveries integer := 0;
  v_attention jsonb := '[]'::jsonb;
  v_recent jsonb := '[]'::jsonb;
begin
  if v_can_staff then
    select count(*) filter (where status = 'active'),
           count(*) filter (where status = 'suspended'),
           count(*)
    into v_active_members, v_suspended_members, v_total_members
    from public.admin_members;

    select count(*) into v_pending_invitations
    from public.admin_invitations where status = 'pending';
  end if;

  if v_can_audit then
    select count(*) into v_audit_today
    from public.admin_audit_logs
    where created_at >= date_trunc('day', now());

    select coalesce(jsonb_agg(to_jsonb(entry)), '[]'::jsonb)
    into v_recent
    from (
      select *
      from public.admin_audit_logs
      order by created_at desc
      limit 6
    ) entry;
  end if;

  if v_can_buyers then
    select count(*) filter (where status = 'active'),
           count(*) filter (where status = 'suspended'),
           count(*) filter (where status = 'blocked'),
           count(*)
    into v_active_buyers, v_suspended_buyers, v_blocked_buyers, v_total_buyers
    from public.buyer_profiles;
  end if;

  if v_can_commerce then
    select count(*) filter (where status = 'pending'),
           count(*) filter (where status = 'in_review'),
           count(*) filter (where status = 'approved'),
           count(*) filter (where status = 'suspended'),
           count(*)
    into v_pending_commerces, v_in_review_commerces, v_approved_commerces,
         v_suspended_commerces, v_total_commerces
    from public.commerce_profiles;
  end if;

  if v_can_catalog then
    select count(*) filter (where status = 'active'),
           count(*) filter (where status = 'inactive'),
           count(*)
    into v_active_categories, v_inactive_categories, v_total_categories
    from public.commerce_categories;
  end if;

  if v_can_documents then
    select count(*) filter (where status = 'pending'),
           count(*) filter (where status = 'verified'),
           count(*) filter (where status = 'rejected'),
           count(*)
    into v_pending_documents, v_verified_documents, v_rejected_documents, v_total_documents
    from public.commerce_documents;
  end if;

  if v_can_requests then
    select count(*) filter (where status = 'open'),
           count(*) filter (where status = 'hidden'),
           count(*) filter (where status = 'expired'),
           count(*) filter (where status = 'closed'),
           count(*)
    into v_open_requests, v_hidden_requests, v_expired_requests, v_closed_requests, v_total_requests
    from public.purchase_requests;
  end if;

  if v_can_offers then
    select count(*) filter (where status = 'active'),
           count(*) filter (where status = 'flagged'),
           count(*) filter (where status in ('withdrawn', 'withdrawn_admin')),
           count(*)
    into v_active_offers, v_flagged_offers, v_withdrawn_offers, v_total_offers
    from public.purchase_offers;
  end if;

  if v_can_orders then
    select count(*) filter (where status = 'pending'),
           count(*) filter (where status in ('confirmed', 'preparing', 'shipped')),
           count(*) filter (where status = 'disputed'),
           count(*) filter (where status = 'completed'),
           count(*) filter (where status = 'cancelled'),
           count(*)
    into v_pending_orders, v_in_progress_orders, v_disputed_orders,
         v_completed_orders, v_cancelled_orders, v_total_orders
    from public.purchase_orders;
  end if;

  if v_can_deliveries then
    select count(*) filter (where status in ('pending', 'preparing')),
           count(*) filter (where status in ('shipped', 'in_transit')),
           count(*) filter (where status = 'failed'),
           count(*) filter (where status = 'delivered'),
           count(*)
    into v_pending_deliveries, v_in_transit_deliveries, v_failed_deliveries,
         v_delivered_deliveries, v_total_deliveries
    from public.order_deliveries;

    select count(*) into v_open_incidents
    from public.delivery_incidents where status = 'open';
  end if;

  if v_can_staff and v_pending_invitations > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'invitations',
      'label', v_pending_invitations || ' invitación(es) pendiente(s) de aceptación',
      'tone', 'warning',
      'path', '/personal'
    ));
  end if;

  if v_can_staff and v_suspended_members > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'suspended',
      'label', v_suspended_members || ' cuenta(s) administrativa(s) suspendida(s)',
      'tone', 'neutral',
      'path', '/personal'
    ));
  end if;

  if v_can_commerce and v_pending_commerces > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'pendingCommerces',
      'label', v_pending_commerces || ' comercio(s) pendiente(s) de verificación',
      'tone', 'warning',
      'path', '/comercios'
    ));
  end if;

  if v_can_commerce and v_in_review_commerces > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'inReviewCommerces',
      'label', v_in_review_commerces || ' comercio(s) en revisión',
      'tone', 'info',
      'path', '/comercios'
    ));
  end if;

  if v_can_documents and v_rejected_documents > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'rejectedDocuments',
      'label', v_rejected_documents || ' documento(s) rechazado(s) por corregir',
      'tone', 'warning',
      'path', '/comercios'
    ));
  end if;

  if v_can_buyers and v_blocked_buyers > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'blockedBuyers',
      'label', v_blocked_buyers || ' comprador(es) bloqueado(s)',
      'tone', 'neutral',
      'path', '/compradores'
    ));
  end if;

  if v_can_requests and v_hidden_requests > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'hiddenRequests',
      'label', v_hidden_requests || ' solicitud(es) oculta(s) por moderación',
      'tone', 'warning',
      'path', '/solicitudes'
    ));
  end if;

  if v_can_offers and v_flagged_offers > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'flaggedOffers',
      'label', v_flagged_offers || ' oferta(s) marcada(s) como irregular(es)',
      'tone', 'warning',
      'path', '/ofertas'
    ));
  end if;

  if v_can_orders and v_disputed_orders > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'disputedOrders',
      'label', v_disputed_orders || ' pedido(s) en disputa',
      'tone', 'danger',
      'path', '/pedidos'
    ));
  end if;

  if v_can_deliveries and v_failed_deliveries > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'failedDeliveries',
      'label', v_failed_deliveries || ' entrega(s) con fallo de reparto',
      'tone', 'danger',
      'path', '/entregas'
    ));
  end if;

  if v_can_deliveries and v_open_incidents > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'openIncidents',
      'label', v_open_incidents || ' incidencia(s) de entrega sin resolver',
      'tone', 'warning',
      'path', '/entregas'
    ));
  end if;

  return jsonb_build_object(
    'activeMembers', v_active_members,
    'suspendedMembers', v_suspended_members,
    'pendingInvitations', v_pending_invitations,
    'auditToday', v_audit_today,
    'totalMembers', v_total_members,
    'activeBuyers', v_active_buyers,
    'suspendedBuyers', v_suspended_buyers,
    'blockedBuyers', v_blocked_buyers,
    'totalBuyers', v_total_buyers,
    'pendingCommerces', v_pending_commerces,
    'inReviewCommerces', v_in_review_commerces,
    'approvedCommerces', v_approved_commerces,
    'suspendedCommerces', v_suspended_commerces,
    'totalCommerces', v_total_commerces,
    'activeCategories', v_active_categories,
    'inactiveCategories', v_inactive_categories,
    'totalCategories', v_total_categories,
    'pendingDocuments', v_pending_documents,
    'verifiedDocuments', v_verified_documents,
    'rejectedDocuments', v_rejected_documents,
    'totalDocuments', v_total_documents,
    'openRequests', v_open_requests,
    'hiddenRequests', v_hidden_requests,
    'expiredRequests', v_expired_requests,
    'closedRequests', v_closed_requests,
    'totalRequests', v_total_requests,
    'activeOffers', v_active_offers,
    'flaggedOffers', v_flagged_offers,
    'withdrawnOffers', v_withdrawn_offers,
    'totalOffers', v_total_offers,
    'pendingOrders', v_pending_orders,
    'inProgressOrders', v_in_progress_orders,
    'disputedOrders', v_disputed_orders,
    'completedOrders', v_completed_orders,
    'cancelledOrders', v_cancelled_orders,
    'totalOrders', v_total_orders,
    'pendingDeliveries', v_pending_deliveries,
    'inTransitDeliveries', v_in_transit_deliveries,
    'failedDeliveries', v_failed_deliveries,
    'deliveredDeliveries', v_delivered_deliveries,
    'openIncidents', v_open_incidents,
    'totalDeliveries', v_total_deliveries,
    'recentAudit', v_recent,
    'attention', v_attention
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS y privilegios
-- El cliente no lee estas tablas directamente: todo pasa por funciones con
-- permisos, auditoría y sin exponer rutas de almacenamiento.
-- -----------------------------------------------------------------------------
alter table public.purchase_requests enable row level security;
alter table public.purchase_offers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_events enable row level security;
alter table public.purchase_order_disputes enable row level security;
alter table public.order_deliveries enable row level security;
alter table public.delivery_incidents enable row level security;
alter table public.delivery_evidence enable row level security;

revoke all on public.purchase_requests from anon, authenticated;
revoke all on public.purchase_offers from anon, authenticated;
revoke all on public.purchase_orders from anon, authenticated;
revoke all on public.purchase_order_events from anon, authenticated;
revoke all on public.purchase_order_disputes from anon, authenticated;
revoke all on public.order_deliveries from anon, authenticated;
revoke all on public.delivery_incidents from anon, authenticated;
revoke all on public.delivery_evidence from anon, authenticated;

revoke execute on function public.admin_guard_order_snapshot() from public;
revoke execute on function public.admin_request_transition_allowed(text, text) from public;
revoke execute on function public.admin_offer_transition_allowed(text, text) from public;
revoke execute on function public.admin_order_transition_allowed(text, text) from public;
revoke execute on function public.admin_delivery_transition_allowed(text, text) from public;
revoke execute on function public.admin_delivery_incident_label(text) from public;
revoke execute on function public.admin_delivery_evidence_label(text) from public;
revoke execute on function public.admin_delivery_summary(uuid) from public;
revoke execute on function public.admin_delivery_detail(uuid) from public;
revoke execute on function public.admin_list_requests(text, text) from public;
revoke execute on function public.admin_get_request(uuid) from public;
revoke execute on function public.admin_set_request_status(uuid, text, text, text) from public;
revoke execute on function public.admin_list_offers(text, text, uuid) from public;
revoke execute on function public.admin_get_offer(uuid) from public;
revoke execute on function public.admin_set_offer_status(uuid, text, text, text) from public;
revoke execute on function public.admin_list_orders(text, text) from public;
revoke execute on function public.admin_get_order(uuid) from public;
revoke execute on function public.admin_transition_order(uuid, text, text, text, text) from public;
revoke execute on function public.admin_list_deliveries(text, text) from public;
revoke execute on function public.admin_get_delivery(uuid) from public;
revoke execute on function public.admin_update_delivery(uuid, text, text, text, text, text, timestamptz) from public;
revoke execute on function public.admin_confirm_delivery(uuid, text, text) from public;
revoke execute on function public.admin_report_delivery_incident(uuid, text, text) from public;
revoke execute on function public.admin_resolve_delivery_incident(uuid, text) from public;
revoke execute on function public.admin_delivery_evidence_path(uuid) from public;
revoke execute on function public.admin_dashboard_metrics() from public;

grant execute on function public.admin_list_requests(text, text) to authenticated;
grant execute on function public.admin_get_request(uuid) to authenticated;
grant execute on function public.admin_set_request_status(uuid, text, text, text) to authenticated;
grant execute on function public.admin_list_offers(text, text, uuid) to authenticated;
grant execute on function public.admin_get_offer(uuid) to authenticated;
grant execute on function public.admin_set_offer_status(uuid, text, text, text) to authenticated;
grant execute on function public.admin_list_orders(text, text) to authenticated;
grant execute on function public.admin_get_order(uuid) to authenticated;
grant execute on function public.admin_transition_order(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_list_deliveries(text, text) to authenticated;
grant execute on function public.admin_get_delivery(uuid) to authenticated;
grant execute on function public.admin_update_delivery(uuid, text, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.admin_confirm_delivery(uuid, text, text) to authenticated;
grant execute on function public.admin_report_delivery_incident(uuid, text, text) to authenticated;
grant execute on function public.admin_resolve_delivery_incident(uuid, text) to authenticated;
grant execute on function public.admin_delivery_evidence_path(uuid) to authenticated;
grant execute on function public.admin_dashboard_metrics() to authenticated;
