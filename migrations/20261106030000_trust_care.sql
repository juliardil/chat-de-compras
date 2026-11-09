-- =============================================================================
-- Chat de Compras · Administrador · Fase 4
-- Confianza y atención: chats, moderación, reseñas, soporte y comunicaciones.
--
-- IMPORTANTE:
--   * Este archivo NO se ha ejecutado. Se aplica después de las Fases 1, 2 y 3:
--       npx @insforge/cli db migrations up --all
--   * Requiere 20261106000000_admin_foundation.sql,
--     20261106010000_people_catalog.sql y
--     20261106020000_operations.sql aplicadas.
--   * No contiene datos de negocio ni secretos: solo esquema, funciones, RLS y
--     privilegios. No hay semillas de negocio en esta migración.
--   * Las máquinas de estados son POLÍTICA DE IMPLEMENTACIÓN de esta fase y
--     deben confirmarse con el negocio. El servidor y la demo aplican las
--     mismas transiciones.
--   * El contenido de un chat solo se lee con una autorización aprobada,
--     vigente y solicitada por el propio actor. Cada lectura se audita.
--   * NO existe proveedor de correo. Poner una campaña en cola o marcarla como
--     enviada solo registra un estado simulado explícito; no se entrega nada.
--   * El acceso directo a las tablas queda revocado: todo pasa por funciones
--     SECURITY DEFINER con comprobación de permisos y auditoría.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.purchase_orders(id) on delete set null,
  buyer_id uuid references public.buyer_profiles(id) on delete set null,
  commerce_id uuid references public.commerce_profiles(id) on delete set null,
  subject text not null,
  status text not null default 'active'
    check (status in ('active', 'flagged', 'archived')),
  flagged_reason text,
  flagged_at timestamptz,
  flagged_by uuid references auth.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_type text not null check (sender_type in ('buyer', 'commerce', 'support', 'system')),
  sender_name text,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_access_requests (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chat_threads(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_by_name text,
  requested_by_role text,
  reason text not null,
  reason_code text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'expired', 'revoked')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_reason text,
  review_reason_code text,
  expires_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null
    check (report_type in ('chat', 'review', 'offer', 'request', 'commerce', 'buyer')),
  subject text not null,
  entity_type text,
  entity_id text,
  entity_label text,
  description text,
  reporter_name text,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_to_name text,
  assigned_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_by_name text,
  resolved_at timestamptz,
  resolution_reason text,
  resolution_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.purchase_orders(id) on delete set null,
  buyer_id uuid references public.buyer_profiles(id) on delete set null,
  commerce_id uuid references public.commerce_profiles(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  status text not null default 'pending'
    check (status in ('published', 'hidden', 'flagged', 'pending')),
  status_reason text,
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_by_name text,
  moderated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  requester_type text not null default 'buyer'
    check (requester_type in ('buyer', 'commerce')),
  requester_name text,
  requester_email text,
  order_id uuid references public.purchase_orders(id) on delete set null,
  category text not null default 'other'
    check (category in ('order', 'delivery', 'account', 'payment', 'other')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  subject text not null,
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_to_name text,
  assigned_at timestamptz,
  due_at timestamptz,
  status_reason text,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_type text not null check (author_type in ('requester', 'support', 'system')),
  author_name text,
  body text not null,
  internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body text not null,
  segment text not null
    check (segment in ('all_buyers', 'all_commerces', 'mixed', 'active_buyers', 'active_commerces', 'support_contacts')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communication_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id uuid references public.communication_templates(id) on delete set null,
  segment text not null
    check (segment in ('all_buyers', 'all_commerces', 'mixed', 'active_buyers', 'active_commerces', 'support_contacts')),
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'sent', 'cancelled', 'failed')),
  audience_count integer not null default 0,
  simulated boolean not null default true,
  provider_status text not null default 'draft',
  status_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scheduled_at timestamptz,
  queued_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists chat_threads_status_idx on public.chat_threads (status);
create index if not exists chat_threads_last_message_idx on public.chat_threads (last_message_at desc);
create index if not exists chat_messages_chat_idx on public.chat_messages (chat_id, created_at);
create index if not exists chat_access_requests_chat_idx on public.chat_access_requests (chat_id, requested_by);
create index if not exists chat_access_requests_requester_idx on public.chat_access_requests (requested_by, status);
create index if not exists moderation_reports_status_idx on public.moderation_reports (status);
create index if not exists moderation_reports_type_idx on public.moderation_reports (report_type);
create index if not exists commerce_reviews_status_idx on public.commerce_reviews (status);
create index if not exists commerce_reviews_commerce_idx on public.commerce_reviews (commerce_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_due_idx on public.support_tickets (due_at);
create index if not exists support_ticket_messages_ticket_idx on public.support_ticket_messages (ticket_id, created_at);
create index if not exists communication_templates_status_idx on public.communication_templates (status);
create index if not exists communication_campaigns_status_idx on public.communication_campaigns (status);

-- -----------------------------------------------------------------------------
-- Helpers de estado (política de implementación)
-- -----------------------------------------------------------------------------
create or replace function public.admin_chat_access_effective_status(
  p_status text,
  p_expires_at timestamptz
)
returns text
language sql
stable
as $$
  select case
    when p_status = 'approved' and p_expires_at is not null and p_expires_at <= now()
      then 'expired'
    else coalesce(p_status, 'pending')
  end;
$$;

create or replace function public.admin_moderation_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select p_to in (
    case p_from
      when 'open' then 'in_review,dismissed,resolved'
      when 'in_review' then 'resolved,dismissed,open'
      else ''
    end
  );
$$;

create or replace function public.admin_review_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select p_to in (
    case p_from
      when 'published' then 'hidden,flagged'
      when 'flagged' then 'published,hidden'
      when 'hidden' then 'published'
      when 'pending' then 'published,hidden'
      else ''
    end
  );
$$;

create or replace function public.admin_support_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select p_to in (
    case p_from
      when 'open' then 'in_progress,waiting_user,resolved,closed'
      when 'in_progress' then 'waiting_user,resolved,closed'
      when 'waiting_user' then 'in_progress,resolved,closed'
      when 'resolved' then 'closed,open'
      when 'closed' then 'open'
      else ''
    end
  );
$$;

create or replace function public.admin_template_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select p_to in (
    case p_from
      when 'draft' then 'active,archived'
      when 'active' then 'archived'
      when 'archived' then 'draft'
      else ''
    end
  );
$$;

create or replace function public.admin_campaign_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select p_to in (
    case p_from
      when 'draft' then 'queued,cancelled'
      when 'queued' then 'sent,cancelled,failed'
      when 'failed' then 'draft,cancelled'
      else ''
    end
  );
$$;

create or replace function public.admin_chat_access_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select p_to in (
    case p_from
      when 'pending' then 'approved,denied'
      when 'approved' then 'revoked,expired'
      else ''
    end
  );
$$;

create or replace function public.admin_support_sla_hours(p_priority text)
returns integer
language sql
immutable
as $$
  select case p_priority
    when 'urgent' then 4
    when 'high' then 12
    when 'normal' then 24
    else 72
  end;
$$;

create or replace function public.admin_segment_is_broadcast(p_segment text)
returns boolean
language sql
immutable
as $$
  select p_segment in ('all_buyers', 'all_commerces', 'mixed');
$$;

create or replace function public.admin_segment_label(p_segment text)
returns text
language sql
immutable
as $$
  select case p_segment
    when 'all_buyers' then 'Todos los compradores'
    when 'all_commerces' then 'Todos los comercios'
    when 'mixed' then 'Compradores y comercios'
    when 'active_buyers' then 'Compradores activos'
    when 'active_commerces' then 'Comercios activos'
    when 'support_contacts' then 'Contactos con ticket reciente'
    else p_segment
  end;
$$;

create or replace function public.admin_moderation_type_label(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'chat' then 'Conversación'
    when 'review' then 'Reseña'
    when 'offer' then 'Oferta'
    when 'request' then 'Solicitud'
    when 'commerce' then 'Comercio'
    when 'buyer' then 'Comprador'
    else p_type
  end;
$$;

create or replace function public.admin_priority_label(p_priority text)
returns text
language sql
immutable
as $$
  select case p_priority
    when 'low' then 'Baja'
    when 'normal' then 'Normal'
    when 'high' then 'Alta'
    when 'urgent' then 'Urgente'
    else p_priority
  end;
$$;

create or replace function public.admin_support_category_label(p_category text)
returns text
language sql
immutable
as $$
  select case p_category
    when 'order' then 'Pedido'
    when 'delivery' then 'Entrega'
    when 'account' then 'Cuenta'
    when 'payment' then 'Pago'
    else 'Otra consulta'
  end;
$$;

-- -----------------------------------------------------------------------------
-- Chats: metadatos, acceso excepcional y lectura auditada
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_chats(
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
  v_actor uuid := public.admin_current_user_id();
  v_result jsonb := '[]'::jsonb;
begin
  if not public.admin_has_permission('chats.view_metadata') then
    raise exception 'No autorizado para ver chats.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(entry.payload order by entry.last_message_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      c.last_message_at,
      jsonb_build_object(
        'id', c.id,
        'subject', c.subject,
        'orderId', c.order_id,
        'orderNumber', o.order_number,
        'buyerId', c.buyer_id,
        'buyerName', buyer.display_name,
        'commerceId', c.commerce_id,
        'commerceName', commerce.trade_name,
        'status', c.status,
        'flaggedReason', c.flagged_reason,
        'flaggedAt', c.flagged_at,
        'lastMessageAt', c.last_message_at,
        'createdAt', c.created_at,
        'updatedAt', c.updated_at,
        'messageCount', (select count(*) from public.chat_messages m where m.chat_id = c.id),
        'lastMessagePreview', (
          select left(m.body, 140)
          from public.chat_messages m
          where m.chat_id = c.id
          order by m.created_at desc
          limit 1
        ),
        'canReadContent', exists (
          select 1 from public.chat_access_requests r
          where r.chat_id = c.id
            and r.requested_by = v_actor
            and public.admin_chat_access_effective_status(r.status, r.expires_at) = 'approved'
        ),
        'myAccessRequest', (
          select jsonb_build_object(
            'id', r.id,
            'chatId', r.chat_id,
            'requestedByName', r.requested_by_name,
            'reason', r.reason,
            'reasonCode', r.reason_code,
            'status', r.status,
            'effectiveStatus', public.admin_chat_access_effective_status(r.status, r.expires_at),
            'requestedAt', r.requested_at,
            'expiresAt', r.expires_at,
            'reviewReason', r.review_reason,
            'reviewReasonCode', r.review_reason_code,
            'reviewedByName', r.reviewed_by_name,
            'reviewedAt', r.reviewed_at
          )
          from public.chat_access_requests r
          where r.chat_id = c.id and r.requested_by = v_actor
          order by r.requested_at desc
          limit 1
        )
      ) as payload
    from public.chat_threads c
    left join public.purchase_orders o on o.id = c.order_id
    left join public.buyer_profiles buyer on buyer.id = c.buyer_id
    left join public.commerce_profiles commerce on commerce.id = c.commerce_id
    where (p_status is null or c.status = p_status)
      and (
        p_search is null
        or c.subject ilike '%' || p_search || '%'
        or coalesce(buyer.display_name, '') ilike '%' || p_search || '%'
        or coalesce(commerce.trade_name, '') ilike '%' || p_search || '%'
        or coalesce(o.order_number, '') ilike '%' || p_search || '%'
      )
  ) entry;

  return v_result;
end;
$$;

create or replace function public.admin_get_chat(p_chat_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.admin_current_user_id();
  v_can_grant boolean := public.admin_has_permission('chats.grant_access');
  v_chat jsonb;
  v_requests jsonb := '[]'::jsonb;
begin
  if not public.admin_has_permission('chats.view_metadata') then
    raise exception 'No autorizado para ver chats.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', c.id,
    'subject', c.subject,
    'orderId', c.order_id,
    'orderNumber', o.order_number,
    'buyerId', c.buyer_id,
    'buyerName', buyer.display_name,
    'commerceId', c.commerce_id,
    'commerceName', commerce.trade_name,
    'status', c.status,
    'flaggedReason', c.flagged_reason,
    'flaggedAt', c.flagged_at,
    'lastMessageAt', c.last_message_at,
    'createdAt', c.created_at,
    'updatedAt', c.updated_at,
    'messageCount', (select count(*) from public.chat_messages m where m.chat_id = c.id),
    'lastMessagePreview', (
      select left(m.body, 140)
      from public.chat_messages m
      where m.chat_id = c.id
      order by m.created_at desc
      limit 1
    ),
    'canReadContent', exists (
      select 1 from public.chat_access_requests r
      where r.chat_id = c.id
        and r.requested_by = v_actor
        and public.admin_chat_access_effective_status(r.status, r.expires_at) = 'approved'
    ),
    'activeAccessRequestId', (
      select r.id
      from public.chat_access_requests r
      where r.chat_id = c.id
        and r.requested_by = v_actor
        and public.admin_chat_access_effective_status(r.status, r.expires_at) = 'approved'
      order by r.requested_at desc
      limit 1
    ),
    'accessExpiresAt', (
      select r.expires_at
      from public.chat_access_requests r
      where r.chat_id = c.id
        and r.requested_by = v_actor
        and public.admin_chat_access_effective_status(r.status, r.expires_at) = 'approved'
      order by r.requested_at desc
      limit 1
    ),
    'canGrantAccess', v_can_grant,
    'accessRequestsRestricted', not v_can_grant
  )
  into v_chat
  from public.chat_threads c
  left join public.purchase_orders o on o.id = c.order_id
  left join public.buyer_profiles buyer on buyer.id = c.buyer_id
  left join public.commerce_profiles commerce on commerce.id = c.commerce_id
  where c.id = p_chat_id;

  if v_chat is null then
    raise exception 'La conversación no existe.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'chatId', r.chat_id,
    'requestedById', r.requested_by,
    'requestedByName', r.requested_by_name,
    'requestedByRole', r.requested_by_role,
    'reason', r.reason,
    'reasonCode', r.reason_code,
    'status', r.status,
    'effectiveStatus', public.admin_chat_access_effective_status(r.status, r.expires_at),
    'requestedAt', r.requested_at,
    'reviewedByName', r.reviewed_by_name,
    'reviewedAt', r.reviewed_at,
    'reviewReason', r.review_reason,
    'reviewReasonCode', r.review_reason_code,
    'expiresAt', r.expires_at,
    'revokedAt', r.revoked_at
  ) order by r.requested_at desc), '[]'::jsonb)
  into v_requests
  from public.chat_access_requests r
  where r.chat_id = p_chat_id
    and (v_can_grant or r.requested_by = v_actor);

  return v_chat || jsonb_build_object(
    'accessRequests', v_requests,
    'myAccessRequest', (
      select jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'effectiveStatus', public.admin_chat_access_effective_status(r.status, r.expires_at),
        'reason', r.reason,
        'requestedAt', r.requested_at,
        'expiresAt', r.expires_at
      )
      from public.chat_access_requests r
      where r.chat_id = p_chat_id and r.requested_by = v_actor
      order by r.requested_at desc
      limit 1
    )
  );
end;
$$;

create or replace function public.admin_request_chat_access(
  p_chat_id uuid,
  p_reason text,
  p_reason_code text default 'other'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.admin_current_user_id();
  v_member public.admin_members%rowtype;
  v_role_key text;
  v_chat public.chat_threads%rowtype;
  v_request public.chat_access_requests%rowtype;
begin
  if not public.admin_has_permission('chats.request_access') then
    raise exception 'No autorizado para solicitar acceso.' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;

  select * into v_chat from public.chat_threads where id = p_chat_id;
  if not found then
    raise exception 'La conversación no existe.';
  end if;

  select * into v_member from public.admin_members where user_id = v_actor;
  select key into v_role_key
  from public.admin_roles
  where id = v_member.role_id;

  if exists (
    select 1 from public.chat_access_requests r
    where r.chat_id = p_chat_id
      and r.requested_by = v_actor
      and public.admin_chat_access_effective_status(r.status, r.expires_at) in ('pending', 'approved')
  ) then
    raise exception 'Ya existe una solicitud pendiente o aprobada para esta conversación.';
  end if;

  insert into public.chat_access_requests (
    chat_id, requested_by, requested_by_name, requested_by_role,
    reason, reason_code, status
  )
  values (
    p_chat_id, v_actor, v_member.display_name, v_role_key,
    trim(p_reason), p_reason_code, 'pending'
  )
  returning * into v_request;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'chat.access.request', 'Chats', 'chat_access_request', v_request.id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object('chatId', p_chat_id, 'reasonCode', p_reason_code)
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return jsonb_build_object(
    'id', v_request.id,
    'chatId', v_request.chat_id,
    'status', v_request.status,
    'effectiveStatus', 'pending',
    'reason', v_request.reason,
    'reasonCode', v_request.reason_code,
    'requestedAt', v_request.requested_at
  );
end;
$$;

create or replace function public.admin_decide_chat_access(
  p_access_request_id uuid,
  p_decision text,
  p_reason text,
  p_reason_code text default null,
  p_expires_in_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.admin_current_user_id();
  v_member public.admin_members%rowtype;
  v_request public.chat_access_requests%rowtype;
  v_previous text;
  v_hours integer;
begin
  if not public.admin_has_permission('chats.grant_access') then
    raise exception 'No autorizado para decidir accesos.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'denied', 'revoked') then
    raise exception 'Decisión de acceso no válida.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;

  select * into v_request
  from public.chat_access_requests
  where id = p_access_request_id
  for update;
  if not found then
    raise exception 'La solicitud de acceso no existe.';
  end if;

  if not public.admin_chat_access_transition_allowed(v_request.status, p_decision) then
    raise exception 'Transición de acceso no permitida para esta solicitud.';
  end if;

  select * into v_member from public.admin_members where user_id = v_actor;

  v_previous := v_request.status;
  v_hours := least(greatest(coalesce(p_expires_in_hours, 24), 1), 168);

  update public.chat_access_requests
  set status = p_decision,
      reviewed_by = v_actor,
      reviewed_by_name = v_member.display_name,
      reviewed_at = now(),
      review_reason = trim(p_reason),
      review_reason_code = p_reason_code,
      expires_at = case when p_decision = 'approved'
        then now() + make_interval(hours => v_hours)
        else expires_at end,
      revoked_at = case when p_decision = 'revoked' then now() else revoked_at end
  where id = p_access_request_id
  returning * into v_request;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'chat.access.' || p_decision, 'Chats', 'chat_access_request',
    v_request.id::text, p_reason_code, trim(p_reason),
    jsonb_build_object(
      'decision', p_decision,
      'previousStatus', v_previous,
      'chatId', v_request.chat_id,
      'requestedById', v_request.requested_by,
      'expiresAt', v_request.expires_at,
      'reasonCode', p_reason_code
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return jsonb_build_object(
    'id', v_request.id,
    'chatId', v_request.chat_id,
    'status', v_request.status,
    'effectiveStatus', public.admin_chat_access_effective_status(v_request.status, v_request.expires_at),
    'reviewedByName', v_request.reviewed_by_name,
    'reviewedAt', v_request.reviewed_at,
    'reviewReason', v_request.review_reason,
    'expiresAt', v_request.expires_at,
    'revokedAt', v_request.revoked_at
  );
end;
$$;

create or replace function public.admin_read_chat_content(p_chat_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.admin_current_user_id();
  v_chat public.chat_threads%rowtype;
  v_access public.chat_access_requests%rowtype;
  v_messages jsonb := '[]'::jsonb;
begin
  if not public.admin_has_permission('chats.access_content') then
    raise exception 'No autorizado para leer contenido de chats.' using errcode = '42501';
  end if;

  select * into v_chat from public.chat_threads where id = p_chat_id;
  if not found then
    raise exception 'La conversación no existe.';
  end if;

  select * into v_access
  from public.chat_access_requests r
  where r.chat_id = p_chat_id
    and r.requested_by = v_actor
    and public.admin_chat_access_effective_status(r.status, r.expires_at) = 'approved'
  order by r.requested_at desc
  limit 1;

  if not found then
    raise exception 'No tienes una autorización aprobada y vigente para esta conversación.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'chatId', m.chat_id,
    'senderType', m.sender_type,
    'senderName', m.sender_name,
    'body', m.body,
    'createdAt', m.created_at
  ) order by m.created_at), '[]'::jsonb)
  into v_messages
  from public.chat_messages m
  where m.chat_id = p_chat_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'chat.content.read', 'Chats', 'chat_thread', v_chat.id::text,
    'authorized_read', v_access.reason,
    jsonb_build_object(
      'accessRequestId', v_access.id,
      'messageCount', jsonb_array_length(v_messages),
      'expiresAt', v_access.expires_at,
      'result', 'granted'
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return jsonb_build_object(
    'id', v_chat.id,
    'subject', v_chat.subject,
    'accessRequestId', v_access.id,
    'accessExpiresAt', v_access.expires_at,
    'messages', v_messages,
    'simulated', false
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Moderación
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_moderation_reports(
  p_search text default null,
  p_status text default null,
  p_report_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.admin_current_user_id();
  v_result jsonb := '[]'::jsonb;
begin
  if not public.admin_has_permission('moderation.view') then
    raise exception 'No autorizado para ver moderación.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(entry.payload order by entry.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      r.created_at,
      jsonb_build_object(
        'id', r.id,
        'reportType', r.report_type,
        'typeLabel', public.admin_moderation_type_label(r.report_type),
        'subject', r.subject,
        'entityType', r.entity_type,
        'entityId', r.entity_id,
        'entityLabel', r.entity_label,
        'description', r.description,
        'reporterName', r.reporter_name,
        'priority', r.priority,
        'priorityLabel', public.admin_priority_label(r.priority),
        'status', r.status,
        'assignedToId', r.assigned_to,
        'assignedToName', r.assigned_to_name,
        'assignedToMe', r.assigned_to = v_actor,
        'assignedAt', r.assigned_at,
        'resolvedById', r.resolved_by,
        'resolvedByName', r.resolved_by_name,
        'resolvedAt', r.resolved_at,
        'resolutionReason', r.resolution_reason,
        'resolutionCode', r.resolution_code,
        'createdAt', r.created_at,
        'updatedAt', r.updated_at
      ) as payload
    from public.moderation_reports r
    where (p_status is null or r.status = p_status)
      and (p_report_type is null or r.report_type = p_report_type)
      and (
        p_search is null
        or r.subject ilike '%' || p_search || '%'
        or coalesce(r.entity_label, '') ilike '%' || p_search || '%'
        or coalesce(r.reporter_name, '') ilike '%' || p_search || '%'
        or coalesce(r.description, '') ilike '%' || p_search || '%'
      )
  ) entry;

  return v_result;
end;
$$;

create or replace function public.admin_get_moderation_report(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.admin_current_user_id();
  v_report jsonb;
begin
  if not public.admin_has_permission('moderation.view') then
    raise exception 'No autorizado para ver moderación.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', r.id,
    'reportType', r.report_type,
    'typeLabel', public.admin_moderation_type_label(r.report_type),
    'subject', r.subject,
    'entityType', r.entity_type,
    'entityId', r.entity_id,
    'entityLabel', r.entity_label,
    'description', r.description,
    'reporterName', r.reporter_name,
    'priority', r.priority,
    'priorityLabel', public.admin_priority_label(r.priority),
    'status', r.status,
    'assignedToId', r.assigned_to,
    'assignedToName', r.assigned_to_name,
    'assignedToMe', r.assigned_to = v_actor,
    'assignedAt', r.assigned_at,
    'resolvedById', r.resolved_by,
    'resolvedByName', r.resolved_by_name,
    'resolvedAt', r.resolved_at,
    'resolutionReason', r.resolution_reason,
    'resolutionCode', r.resolution_code,
    'createdAt', r.created_at,
    'updatedAt', r.updated_at
  )
  into v_report
  from public.moderation_reports r
  where r.id = p_report_id;

  if v_report is null then
    raise exception 'El reporte de moderación no existe.';
  end if;

  return v_report;
end;
$$;

create or replace function public.admin_update_moderation_report(
  p_report_id uuid,
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
  v_actor uuid := public.admin_current_user_id();
  v_member public.admin_members%rowtype;
  v_report public.moderation_reports%rowtype;
  v_previous text;
  v_permission text;
  v_action text;
begin
  select * into v_report from public.moderation_reports where id = p_report_id for update;
  if not found then
    raise exception 'El reporte de moderación no existe.';
  end if;
  if p_status not in ('open', 'in_review', 'resolved', 'dismissed') then
    raise exception 'Estado de moderación no válido.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;
  if not public.admin_moderation_transition_allowed(v_report.status, p_status) then
    raise exception 'Transición de moderación no permitida.';
  end if;

  v_permission := case when p_status = 'in_review' then 'moderation.assign' else 'moderation.resolve' end;
  if not public.admin_has_permission(v_permission) then
    raise exception 'No autorizado para actualizar reportes de moderación.' using errcode = '42501';
  end if;

  select * into v_member from public.admin_members where user_id = v_actor;
  v_previous := v_report.status;
  v_action := case
    when p_status = 'in_review' then 'moderation.assign'
    when p_status = 'dismissed' then 'moderation.dismiss'
    else 'moderation.resolve'
  end;

  update public.moderation_reports
  set status = p_status,
      assigned_to = case when p_status = 'in_review' then v_actor else assigned_to end,
      assigned_to_name = case when p_status = 'in_review' then v_member.display_name else assigned_to_name end,
      assigned_at = case when p_status = 'in_review' then now() else assigned_at end,
      resolved_by = case when p_status in ('resolved', 'dismissed') then v_actor else resolved_by end,
      resolved_by_name = case when p_status in ('resolved', 'dismissed') then v_member.display_name else resolved_by_name end,
      resolved_at = case when p_status in ('resolved', 'dismissed') then now() else resolved_at end,
      resolution_reason = case when p_status in ('resolved', 'dismissed') then trim(p_reason) else resolution_reason end,
      resolution_code = case when p_status in ('resolved', 'dismissed') then p_reason_code else resolution_code end,
      updated_at = now()
  where id = p_report_id
  returning * into v_report;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    v_action, 'Moderación', 'moderation_report', v_report.id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object(
      'previousStatus', v_previous,
      'newStatus', p_status,
      'reportType', v_report.report_type,
      'assignedToId', v_report.assigned_to,
      'reasonCode', p_reason_code
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return public.admin_get_moderation_report(v_report.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Reseñas
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_reviews(
  p_search text default null,
  p_status text default null,
  p_rating integer default null
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
  if not public.admin_has_permission('reviews.view') then
    raise exception 'No autorizado para ver reseñas.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(entry.payload order by entry.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      r.created_at,
      jsonb_build_object(
        'id', r.id,
        'orderId', r.order_id,
        'orderNumber', o.order_number,
        'buyerId', r.buyer_id,
        'buyerName', buyer.display_name,
        'commerceId', r.commerce_id,
        'commerceName', commerce.trade_name,
        'rating', r.rating,
        'comment', r.comment,
        'status', r.status,
        'statusReason', r.status_reason,
        'moderatedById', r.moderated_by,
        'moderatedByName', r.moderated_by_name,
        'moderatedAt', r.moderated_at,
        'publishedAt', r.published_at,
        'createdAt', r.created_at
      ) as payload
    from public.commerce_reviews r
    left join public.purchase_orders o on o.id = r.order_id
    left join public.buyer_profiles buyer on buyer.id = r.buyer_id
    left join public.commerce_profiles commerce on commerce.id = r.commerce_id
    where (p_status is null or r.status = p_status)
      and (p_rating is null or r.rating = p_rating)
      and (
        p_search is null
        or coalesce(r.comment, '') ilike '%' || p_search || '%'
        or coalesce(buyer.display_name, '') ilike '%' || p_search || '%'
        or coalesce(commerce.trade_name, '') ilike '%' || p_search || '%'
        or coalesce(o.order_number, '') ilike '%' || p_search || '%'
      )
  ) entry;

  return v_result;
end;
$$;

create or replace function public.admin_get_review(p_review_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_review jsonb;
begin
  if not public.admin_has_permission('reviews.view') then
    raise exception 'No autorizado para ver reseñas.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', r.id,
    'orderId', r.order_id,
    'orderNumber', o.order_number,
    'buyerId', r.buyer_id,
    'buyerName', buyer.display_name,
    'commerceId', r.commerce_id,
    'commerceName', commerce.trade_name,
    'rating', r.rating,
    'comment', r.comment,
    'status', r.status,
    'statusReason', r.status_reason,
    'moderatedById', r.moderated_by,
    'moderatedByName', r.moderated_by_name,
    'moderatedAt', r.moderated_at,
    'publishedAt', r.published_at,
    'createdAt', r.created_at
  )
  into v_review
  from public.commerce_reviews r
  left join public.purchase_orders o on o.id = r.order_id
  left join public.buyer_profiles buyer on buyer.id = r.buyer_id
  left join public.commerce_profiles commerce on commerce.id = r.commerce_id
  where r.id = p_review_id;

  if v_review is null then
    raise exception 'La reseña no existe.';
  end if;

  return v_review;
end;
$$;

create or replace function public.admin_set_review_status(
  p_review_id uuid,
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
  v_actor uuid := public.admin_current_user_id();
  v_member public.admin_members%rowtype;
  v_review public.commerce_reviews%rowtype;
  v_previous text;
  v_action text;
begin
  if not public.admin_has_permission('reviews.moderate') then
    raise exception 'No autorizado para moderar reseñas.' using errcode = '42501';
  end if;

  select * into v_review from public.commerce_reviews where id = p_review_id for update;
  if not found then
    raise exception 'La reseña no existe.';
  end if;
  if p_status not in ('published', 'hidden', 'flagged', 'pending') then
    raise exception 'Estado de reseña no válido.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;
  if not public.admin_review_transition_allowed(v_review.status, p_status) then
    raise exception 'Transición de reseña no permitida.';
  end if;

  select * into v_member from public.admin_members where user_id = v_actor;
  v_previous := v_review.status;

  if p_status = 'hidden' then
    v_action := 'review.hide';
  elsif p_status = 'flagged' then
    v_action := 'review.flag';
  elsif v_previous = 'pending' then
    v_action := 'review.publish';
  else
    v_action := 'review.restore';
  end if;

  update public.commerce_reviews
  set status = p_status,
      status_reason = trim(p_reason),
      moderated_by = v_actor,
      moderated_by_name = v_member.display_name,
      moderated_at = now(),
      published_at = case when p_status = 'published' and published_at is null then now() else published_at end,
      updated_at = now()
  where id = p_review_id
  returning * into v_review;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    v_action, 'Reseñas', 'commerce_review', v_review.id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object(
      'previousStatus', v_previous,
      'newStatus', p_status,
      'rating', v_review.rating,
      'commerceId', v_review.commerce_id,
      'reasonCode', p_reason_code
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return public.admin_get_review(v_review.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Soporte
-- -----------------------------------------------------------------------------
create or replace function public.admin_support_ticket_summary(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket jsonb;
begin
  select jsonb_build_object(
    'id', t.id,
    'ticketNumber', t.ticket_number,
    'requesterType', t.requester_type,
    'requesterName', t.requester_name,
    'requesterEmail', t.requester_email,
    'orderId', t.order_id,
    'orderNumber', o.order_number,
    'category', t.category,
    'categoryLabel', public.admin_support_category_label(t.category),
    'priority', t.priority,
    'priorityLabel', public.admin_priority_label(t.priority),
    'status', t.status,
    'subject', t.subject,
    'description', t.description,
    'assignedToId', t.assigned_to,
    'assignedToName', t.assigned_to_name,
    'assignedAt', t.assigned_at,
    'dueAt', t.due_at,
    'statusReason', t.status_reason,
    'resolvedAt', t.resolved_at,
    'closedAt', t.closed_at,
    'createdAt', t.created_at,
    'updatedAt', t.updated_at,
    'messageCount', (select count(*) from public.support_ticket_messages m where m.ticket_id = t.id),
    'isOverdue', t.status in ('open', 'in_progress', 'waiting_user')
      and t.due_at is not null and t.due_at < now()
  )
  into v_ticket
  from public.support_tickets t
  left join public.purchase_orders o on o.id = t.order_id
  where t.id = p_ticket_id;

  return v_ticket;
end;
$$;

create or replace function public.admin_list_support_tickets(
  p_search text default null,
  p_status text default null,
  p_priority text default null
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
  if not public.admin_has_permission('support.view') then
    raise exception 'No autorizado para ver soporte.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(entry.payload order by entry.updated_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      t.updated_at,
      public.admin_support_ticket_summary(t.id) as payload
    from public.support_tickets t
    where (p_status is null or t.status = p_status)
      and (p_priority is null or t.priority = p_priority)
      and (
        p_search is null
        or t.ticket_number ilike '%' || p_search || '%'
        or t.subject ilike '%' || p_search || '%'
        or coalesce(t.requester_name, '') ilike '%' || p_search || '%'
        or coalesce(t.description, '') ilike '%' || p_search || '%'
      )
  ) entry;

  return v_result;
end;
$$;

create or replace function public.admin_get_support_ticket(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket jsonb;
  v_messages jsonb := '[]'::jsonb;
begin
  if not public.admin_has_permission('support.view') then
    raise exception 'No autorizado para ver soporte.' using errcode = '42501';
  end if;

  v_ticket := public.admin_support_ticket_summary(p_ticket_id);
  if v_ticket is null then
    raise exception 'El ticket de soporte no existe.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'ticketId', m.ticket_id,
    'authorType', m.author_type,
    'authorName', m.author_name,
    'body', m.body,
    'internal', m.internal,
    'createdAt', m.created_at
  ) order by m.created_at), '[]'::jsonb)
  into v_messages
  from public.support_ticket_messages m
  where m.ticket_id = p_ticket_id;

  return v_ticket || jsonb_build_object('messages', v_messages);
end;
$$;

create or replace function public.admin_assign_support_ticket(
  p_ticket_id uuid,
  p_reason text default 'Asignación manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.admin_current_user_id();
  v_member public.admin_members%rowtype;
  v_ticket public.support_tickets%rowtype;
  v_previous_assignee uuid;
begin
  if not public.admin_has_permission('support.assign') then
    raise exception 'No autorizado para asignar tickets.' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'El ticket de soporte no existe.';
  end if;
  if v_ticket.status = 'closed' then
    raise exception 'No se puede asignar un ticket cerrado. Reábrelo primero.';
  end if;

  select * into v_member from public.admin_members where user_id = v_actor;
  v_previous_assignee := v_ticket.assigned_to;

  update public.support_tickets
  set assigned_to = v_actor,
      assigned_to_name = v_member.display_name,
      assigned_at = now(),
      updated_at = now()
  where id = p_ticket_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'support.assign', 'Soporte', 'support_ticket', v_ticket.id::text, trim(p_reason),
    jsonb_build_object(
      'previousAssigneeId', v_previous_assignee,
      'assignedToId', v_actor,
      'status', v_ticket.status
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return public.admin_get_support_ticket(p_ticket_id);
end;
$$;

create or replace function public.admin_update_support_status(
  p_ticket_id uuid,
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
  v_actor uuid := public.admin_current_user_id();
  v_ticket public.support_tickets%rowtype;
  v_previous text;
  v_permission text;
  v_action text;
begin
  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'El ticket de soporte no existe.';
  end if;
  if p_status not in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed') then
    raise exception 'Estado de soporte no válido.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;
  if not public.admin_support_transition_allowed(v_ticket.status, p_status) then
    raise exception 'Transición de soporte no permitida.';
  end if;

  v_permission := case when p_status in ('resolved', 'closed') then 'support.close' else 'support.reply' end;
  if not public.admin_has_permission(v_permission) then
    raise exception 'No autorizado para cambiar el estado del ticket.' using errcode = '42501';
  end if;

  v_previous := v_ticket.status;
  v_action := case
    when p_status = 'resolved' then 'support.resolve'
    when p_status = 'closed' then 'support.close'
    when v_previous in ('resolved', 'closed') and p_status = 'open' then 'support.reopen'
    else 'support.status'
  end;

  update public.support_tickets
  set status = p_status,
      status_reason = trim(p_reason),
      resolved_at = case when p_status = 'resolved' then now() else resolved_at end,
      closed_at = case when p_status = 'closed' then now() else closed_at end,
      due_at = case when p_status = 'open'
        then now() + make_interval(hours => public.admin_support_sla_hours(v_ticket.priority))
        else due_at end,
      updated_at = now()
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    v_action, 'Soporte', 'support_ticket', v_ticket.id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object(
      'previousStatus', v_previous,
      'newStatus', p_status,
      'assignedToId', v_ticket.assigned_to,
      'reasonCode', p_reason_code
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return public.admin_get_support_ticket(p_ticket_id);
end;
$$;

create or replace function public.admin_reply_support_ticket(
  p_ticket_id uuid,
  p_body text,
  p_internal boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.admin_current_user_id();
  v_member public.admin_members%rowtype;
  v_ticket public.support_tickets%rowtype;
  v_previous text;
  v_message_id uuid;
begin
  if not public.admin_has_permission('support.reply') then
    raise exception 'No autorizado para responder tickets.' using errcode = '42501';
  end if;
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'La respuesta no puede estar vacía.';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'El ticket de soporte no existe.';
  end if;
  if v_ticket.status = 'closed' then
    raise exception 'El ticket está cerrado. Reábrelo antes de responder.';
  end if;

  select * into v_member from public.admin_members where user_id = v_actor;
  v_previous := v_ticket.status;

  insert into public.support_ticket_messages (
    ticket_id, author_type, author_name, body, internal
  )
  values (
    p_ticket_id, 'support', v_member.display_name, trim(p_body), coalesce(p_internal, false)
  )
  returning id into v_message_id;

  update public.support_tickets
  set status = case when status = 'open' then 'in_progress' else status end,
      assigned_to = coalesce(assigned_to, v_actor),
      assigned_to_name = coalesce(assigned_to_name, v_member.display_name),
      assigned_at = coalesce(assigned_at, now()),
      updated_at = now()
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'support.reply', 'Soporte', 'support_ticket', v_ticket.id::text,
    case when p_internal then 'Nota interna añadida' else 'Respuesta pública enviada' end,
    jsonb_build_object(
      'internal', coalesce(p_internal, false),
      'messageId', v_message_id,
      'previousStatus', v_previous,
      'newStatus', v_ticket.status,
      'delivery', 'not_sent_no_provider'
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return public.admin_get_support_ticket(p_ticket_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Comunicaciones (sin proveedor de correo: todo envío es simulado)
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_communication_templates(
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
  if not public.admin_has_permission('communications.view') then
    raise exception 'No autorizado para ver comunicaciones.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'subject', t.subject,
    'body', t.body,
    'segment', t.segment,
    'segmentLabel', public.admin_segment_label(t.segment),
    'status', t.status,
    'createdByName', t.created_by_name,
    'createdAt', t.created_at,
    'updatedAt', t.updated_at
  ) order by t.updated_at desc), '[]'::jsonb)
  into v_result
  from public.communication_templates t
  where (p_status is null or t.status = p_status)
    and (
      p_search is null
      or t.name ilike '%' || p_search || '%'
      or t.subject ilike '%' || p_search || '%'
      or coalesce(t.body, '') ilike '%' || p_search || '%'
      or public.admin_segment_label(t.segment) ilike '%' || p_search || '%'
    );

  return v_result;
end;
$$;

create or replace function public.admin_set_communication_template_status(
  p_template_id uuid,
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
  v_actor uuid := public.admin_current_user_id();
  v_template public.communication_templates%rowtype;
  v_previous text;
begin
  if not public.admin_has_permission('communications.template') then
    raise exception 'No autorizado para cambiar plantillas.' using errcode = '42501';
  end if;

  select * into v_template from public.communication_templates where id = p_template_id for update;
  if not found then
    raise exception 'La plantilla no existe.';
  end if;
  if p_status not in ('draft', 'active', 'archived') then
    raise exception 'Estado de plantilla no válido.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;
  if not public.admin_template_transition_allowed(v_template.status, p_status) then
    raise exception 'Transición de plantilla no permitida.';
  end if;

  v_previous := v_template.status;

  update public.communication_templates
  set status = p_status, updated_at = now()
  where id = p_template_id
  returning * into v_template;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'communications.template.' || p_status, 'Comunicaciones', 'communication_template',
    v_template.id::text, p_reason_code, trim(p_reason),
    jsonb_build_object(
      'previousStatus', v_previous,
      'newStatus', p_status,
      'segment', v_template.segment,
      'reasonCode', p_reason_code
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return jsonb_build_object(
    'id', v_template.id,
    'name', v_template.name,
    'subject', v_template.subject,
    'body', v_template.body,
    'segment', v_template.segment,
    'segmentLabel', public.admin_segment_label(v_template.segment),
    'status', v_template.status,
    'updatedAt', v_template.updated_at
  );
end;
$$;

create or replace function public.admin_segment_audience_count(p_segment text)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_segment
    when 'all_buyers' then (select count(*) from public.buyer_profiles)
    when 'active_buyers' then (select count(*) from public.buyer_profiles where status = 'active')
    when 'all_commerces' then (select count(*) from public.commerce_profiles)
    when 'active_commerces' then (select count(*) from public.commerce_profiles where status = 'approved')
    when 'mixed' then (
      (select count(*) from public.buyer_profiles)
      + (select count(*) from public.commerce_profiles)
    )
    when 'support_contacts' then (
      select count(distinct lower(trim(requester_email)))
      from public.support_tickets
      where requester_email is not null and length(trim(requester_email)) > 0
    )
    else 0
  end;
$$;

create or replace function public.admin_list_communication_campaigns(
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
  if not public.admin_has_permission('communications.view') then
    raise exception 'No autorizado para ver comunicaciones.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'templateId', c.template_id,
    'templateName', t.name,
    'segment', c.segment,
    'segmentLabel', public.admin_segment_label(c.segment),
    'status', c.status,
    'audienceCount', c.audience_count,
    'simulated', c.simulated,
    'providerStatus', c.provider_status,
    'statusReason', c.status_reason,
    'createdByName', c.created_by_name,
    'createdAt', c.created_at,
    'updatedAt', c.updated_at,
    'scheduledAt', c.scheduled_at,
    'queuedAt', c.queued_at,
    'sentAt', c.sent_at,
    'cancelledAt', c.cancelled_at
  ) order by c.updated_at desc), '[]'::jsonb)
  into v_result
  from public.communication_campaigns c
  left join public.communication_templates t on t.id = c.template_id
  where (p_status is null or c.status = p_status)
    and (
      p_search is null
      or c.name ilike '%' || p_search || '%'
      or coalesce(t.name, '') ilike '%' || p_search || '%'
      or public.admin_segment_label(c.segment) ilike '%' || p_search || '%'
    );

  return v_result;
end;
$$;

create or replace function public.admin_create_communication_campaign(
  p_name text,
  p_template_id uuid,
  p_segment text,
  p_scheduled_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.admin_current_user_id();
  v_member public.admin_members%rowtype;
  v_template public.communication_templates%rowtype;
  v_campaign public.communication_campaigns%rowtype;
  v_permission text;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre de la campaña es obligatorio.';
  end if;
  if p_segment not in ('all_buyers', 'all_commerces', 'mixed', 'active_buyers', 'active_commerces', 'support_contacts') then
    raise exception 'Segmento de comunicación no válido.';
  end if;

  v_permission := case when public.admin_segment_is_broadcast(p_segment)
    then 'communications.broadcast' else 'communications.send' end;
  if not public.admin_has_permission(v_permission) then
    raise exception 'No autorizado para crear esta campaña.' using errcode = '42501';
  end if;

  select * into v_template from public.communication_templates where id = p_template_id;
  if not found then
    raise exception 'La plantilla seleccionada no existe.';
  end if;
  if v_template.status <> 'active' then
    raise exception 'Solo se pueden usar plantillas activas en una campaña.';
  end if;

  select * into v_member from public.admin_members where user_id = v_actor;

  insert into public.communication_campaigns (
    name, template_id, segment, status, audience_count,
    simulated, provider_status, created_by, created_by_name, scheduled_at
  )
  values (
    trim(p_name), p_template_id, p_segment, 'draft',
    public.admin_segment_audience_count(p_segment),
    true, 'draft', v_actor, v_member.display_name, p_scheduled_at
  )
  returning * into v_campaign;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'communications.campaign.create', 'Comunicaciones', 'communication_campaign',
    v_campaign.id::text, 'Campaña creada en modo demostración',
    jsonb_build_object(
      'templateId', p_template_id,
      'segment', p_segment,
      'audienceCount', v_campaign.audience_count,
      'simulated', true,
      'provider', 'none'
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return jsonb_build_object(
    'id', v_campaign.id,
    'name', v_campaign.name,
    'templateId', v_campaign.template_id,
    'templateName', v_template.name,
    'segment', v_campaign.segment,
    'segmentLabel', public.admin_segment_label(v_campaign.segment),
    'status', v_campaign.status,
    'audienceCount', v_campaign.audience_count,
    'simulated', v_campaign.simulated,
    'providerStatus', v_campaign.provider_status,
    'createdByName', v_campaign.created_by_name,
    'createdAt', v_campaign.created_at,
    'updatedAt', v_campaign.updated_at,
    'scheduledAt', v_campaign.scheduled_at
  );
end;
$$;

create or replace function public.admin_set_campaign_status(
  p_campaign_id uuid,
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
  v_actor uuid := public.admin_current_user_id();
  v_campaign public.communication_campaigns%rowtype;
  v_template_name text;
  v_previous text;
  v_permission text;
  v_action text;
  v_reason text;
begin
  select * into v_campaign from public.communication_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'La campaña no existe.';
  end if;
  if p_status not in ('draft', 'queued', 'sent', 'cancelled', 'failed') then
    raise exception 'Estado de campaña no válido.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;
  if not public.admin_campaign_transition_allowed(v_campaign.status, p_status) then
    raise exception 'Transición de campaña no permitida.';
  end if;

  v_permission := case when public.admin_segment_is_broadcast(v_campaign.segment)
    then 'communications.broadcast' else 'communications.send' end;
  if not public.admin_has_permission(v_permission) then
    raise exception 'No autorizado para enviar esta campaña.' using errcode = '42501';
  end if;

  v_previous := v_campaign.status;
  v_action := case
    when p_status = 'queued' then 'queue'
    when p_status = 'sent' then 'send'
    when p_status = 'cancelled' then 'cancel'
    when p_status = 'failed' then 'fail'
    when p_status = 'draft' then 'draft'
    else 'change'
  end;

  -- No hay proveedor: los estados de envío son siempre simulados.
  v_reason := case
    when p_status = 'queued' then
      'En cola simulada: no existe proveedor de correo conectado en esta instalación'
    when p_status = 'sent' then
      'Marcada como enviada en la simulación; no se entregó ningún mensaje real'
    else trim(p_reason)
  end;

  update public.communication_campaigns
  set status = p_status,
      status_reason = v_reason,
      simulated = true,
      provider_status = case
        when p_status = 'queued' then 'demo_pending'
        when p_status = 'sent' then 'demo_simulated'
        when p_status = 'failed' then 'failed'
        else provider_status end,
      queued_at = case when p_status = 'queued' then now() else queued_at end,
      sent_at = case when p_status = 'sent' then now() else sent_at end,
      cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
      updated_at = now()
  where id = p_campaign_id
  returning * into v_campaign;

  select name into v_template_name
  from public.communication_templates
  where id = v_campaign.template_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'communications.campaign.' || v_action, 'Comunicaciones', 'communication_campaign',
    v_campaign.id::text, p_reason_code, v_reason,
    jsonb_build_object(
      'previousStatus', v_previous,
      'newStatus', p_status,
      'reasonCode', p_reason_code,
      'simulated', true,
      'providerStatus', v_campaign.provider_status,
      'audienceCount', v_campaign.audience_count,
      'segment', v_campaign.segment,
      'delivery', 'not_sent_no_provider'
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return jsonb_build_object(
    'id', v_campaign.id,
    'name', v_campaign.name,
    'templateId', v_campaign.template_id,
    'templateName', v_template_name,
    'segment', v_campaign.segment,
    'segmentLabel', public.admin_segment_label(v_campaign.segment),
    'status', v_campaign.status,
    'audienceCount', v_campaign.audience_count,
    'simulated', v_campaign.simulated,
    'providerStatus', v_campaign.provider_status,
    'statusReason', v_campaign.status_reason,
    'createdByName', v_campaign.created_by_name,
    'createdAt', v_campaign.created_at,
    'updatedAt', v_campaign.updated_at,
    'scheduledAt', v_campaign.scheduled_at,
    'queuedAt', v_campaign.queued_at,
    'sentAt', v_campaign.sent_at,
    'cancelledAt', v_campaign.cancelled_at
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Métricas de confianza y atención (se combinan con admin_dashboard_metrics)
-- -----------------------------------------------------------------------------
create or replace function public.admin_trust_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_can_chats boolean := public.admin_has_permission('chats.view_metadata');
  v_can_grant boolean := public.admin_has_permission('chats.grant_access');
  v_can_moderation boolean := public.admin_has_permission('moderation.view');
  v_can_reviews boolean := public.admin_has_permission('reviews.view');
  v_can_support boolean := public.admin_has_permission('support.view');
  v_can_communications boolean := public.admin_has_permission('communications.view');
  v_flagged_chats integer := 0;
  v_pending_access integer := 0;
  v_total_chats integer := 0;
  v_open_reports integer := 0;
  v_in_review_reports integer := 0;
  v_total_reports integer := 0;
  v_published_reviews integer := 0;
  v_hidden_reviews integer := 0;
  v_flagged_reviews integer := 0;
  v_total_reviews integer := 0;
  v_open_tickets integer := 0;
  v_in_progress_tickets integer := 0;
  v_overdue_tickets integer := 0;
  v_total_tickets integer := 0;
  v_active_templates integer := 0;
  v_queued_campaigns integer := 0;
  v_total_templates integer := 0;
  v_total_campaigns integer := 0;
  v_attention jsonb := '[]'::jsonb;
begin
  if v_can_chats then
    select count(*) filter (where status = 'flagged'), count(*)
    into v_flagged_chats, v_total_chats
    from public.chat_threads;

    select count(*) into v_pending_access
    from public.chat_access_requests r
    where public.admin_chat_access_effective_status(r.status, r.expires_at) = 'pending';
  end if;

  if v_can_moderation then
    select count(*) filter (where status = 'open'),
           count(*) filter (where status = 'in_review'),
           count(*)
    into v_open_reports, v_in_review_reports, v_total_reports
    from public.moderation_reports;
  end if;

  if v_can_reviews then
    select count(*) filter (where status = 'published'),
           count(*) filter (where status = 'hidden'),
           count(*) filter (where status = 'flagged'),
           count(*)
    into v_published_reviews, v_hidden_reviews, v_flagged_reviews, v_total_reviews
    from public.commerce_reviews;
  end if;

  if v_can_support then
    select count(*) filter (where status = 'open'),
           count(*) filter (where status = 'in_progress'),
           count(*) filter (
             where status in ('open', 'in_progress', 'waiting_user')
               and due_at is not null and due_at < now()
           ),
           count(*)
    into v_open_tickets, v_in_progress_tickets, v_overdue_tickets, v_total_tickets
    from public.support_tickets;
  end if;

  if v_can_communications then
    select count(*) filter (where status = 'active'), count(*)
    into v_active_templates, v_total_templates
    from public.communication_templates;

    select count(*) filter (where status = 'queued'), count(*)
    into v_queued_campaigns, v_total_campaigns
    from public.communication_campaigns;
  end if;

  if v_can_grant and v_pending_access > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'pendingChatAccess',
      'label', v_pending_access || ' solicitud(es) de acceso a chats pendiente(s)',
      'tone', 'warning',
      'path', '/chats'
    ));
  end if;

  if v_can_chats and v_flagged_chats > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'flaggedChats',
      'label', v_flagged_chats || ' conversación(es) marcada(s) por moderación',
      'tone', 'warning',
      'path', '/chats'
    ));
  end if;

  if v_can_moderation and v_open_reports > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'openModerationReports',
      'label', v_open_reports || ' reporte(s) de moderación sin asignar',
      'tone', 'danger',
      'path', '/moderacion'
    ));
  end if;

  if v_can_moderation and v_in_review_reports > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'inReviewModerationReports',
      'label', v_in_review_reports || ' reporte(s) de moderación en revisión',
      'tone', 'info',
      'path', '/moderacion'
    ));
  end if;

  if v_can_reviews and v_flagged_reviews > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'flaggedReviews',
      'label', v_flagged_reviews || ' reseña(s) marcada(s) para revisión',
      'tone', 'warning',
      'path', '/resenas'
    ));
  end if;

  if v_can_support and v_overdue_tickets > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'overdueSupportTickets',
      'label', v_overdue_tickets || ' ticket(s) de soporte fuera de plazo',
      'tone', 'danger',
      'path', '/soporte'
    ));
  end if;

  if v_can_support and v_open_tickets > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'openSupportTickets',
      'label', v_open_tickets || ' ticket(s) de soporte sin asignar',
      'tone', 'warning',
      'path', '/soporte'
    ));
  end if;

  if v_can_communications and v_queued_campaigns > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'queuedCampaigns',
      'label', v_queued_campaigns || ' campaña(s) en cola simulada sin proveedor de envío',
      'tone', 'neutral',
      'path', '/comunicaciones'
    ));
  end if;

  return jsonb_build_object(
    'flaggedChats', v_flagged_chats,
    'pendingChatAccessRequests', v_pending_access,
    'totalChats', v_total_chats,
    'openModerationReports', v_open_reports,
    'inReviewModerationReports', v_in_review_reports,
    'totalModerationReports', v_total_reports,
    'publishedReviews', v_published_reviews,
    'hiddenReviews', v_hidden_reviews,
    'flaggedReviews', v_flagged_reviews,
    'totalReviews', v_total_reviews,
    'openSupportTickets', v_open_tickets,
    'inProgressSupportTickets', v_in_progress_tickets,
    'overdueSupportTickets', v_overdue_tickets,
    'totalSupportTickets', v_total_tickets,
    'activeTemplates', v_active_templates,
    'queuedCampaigns', v_queued_campaigns,
    'totalTemplates', v_total_templates,
    'totalCampaigns', v_total_campaigns,
    'attention', v_attention
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS y privilegios
-- El cliente no lee estas tablas directamente: todo pasa por funciones con
-- permisos, auditoría y sin exponer contenido de chats sin autorización.
-- -----------------------------------------------------------------------------
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_access_requests enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.commerce_reviews enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.communication_templates enable row level security;
alter table public.communication_campaigns enable row level security;

revoke all on public.chat_threads from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;
revoke all on public.chat_access_requests from anon, authenticated;
revoke all on public.moderation_reports from anon, authenticated;
revoke all on public.commerce_reviews from anon, authenticated;
revoke all on public.support_tickets from anon, authenticated;
revoke all on public.support_ticket_messages from anon, authenticated;
revoke all on public.communication_templates from anon, authenticated;
revoke all on public.communication_campaigns from anon, authenticated;

revoke execute on function public.admin_chat_access_effective_status(text, timestamptz) from public;
revoke execute on function public.admin_moderation_transition_allowed(text, text) from public;
revoke execute on function public.admin_review_transition_allowed(text, text) from public;
revoke execute on function public.admin_support_transition_allowed(text, text) from public;
revoke execute on function public.admin_template_transition_allowed(text, text) from public;
revoke execute on function public.admin_campaign_transition_allowed(text, text) from public;
revoke execute on function public.admin_chat_access_transition_allowed(text, text) from public;
revoke execute on function public.admin_support_sla_hours(text) from public;
revoke execute on function public.admin_segment_is_broadcast(text) from public;
revoke execute on function public.admin_segment_label(text) from public;
revoke execute on function public.admin_moderation_type_label(text) from public;
revoke execute on function public.admin_priority_label(text) from public;
revoke execute on function public.admin_support_category_label(text) from public;
revoke execute on function public.admin_list_chats(text, text) from public;
revoke execute on function public.admin_get_chat(uuid) from public;
revoke execute on function public.admin_request_chat_access(uuid, text, text) from public;
revoke execute on function public.admin_decide_chat_access(uuid, text, text, text, integer) from public;
revoke execute on function public.admin_read_chat_content(uuid) from public;
revoke execute on function public.admin_list_moderation_reports(text, text, text) from public;
revoke execute on function public.admin_get_moderation_report(uuid) from public;
revoke execute on function public.admin_update_moderation_report(uuid, text, text, text) from public;
revoke execute on function public.admin_list_reviews(text, text, integer) from public;
revoke execute on function public.admin_get_review(uuid) from public;
revoke execute on function public.admin_set_review_status(uuid, text, text, text) from public;
revoke execute on function public.admin_support_ticket_summary(uuid) from public;
revoke execute on function public.admin_list_support_tickets(text, text, text) from public;
revoke execute on function public.admin_get_support_ticket(uuid) from public;
revoke execute on function public.admin_assign_support_ticket(uuid, text) from public;
revoke execute on function public.admin_update_support_status(uuid, text, text, text) from public;
revoke execute on function public.admin_reply_support_ticket(uuid, text, boolean) from public;
revoke execute on function public.admin_list_communication_templates(text, text) from public;
revoke execute on function public.admin_set_communication_template_status(uuid, text, text, text) from public;
revoke execute on function public.admin_segment_audience_count(text) from public;
revoke execute on function public.admin_list_communication_campaigns(text, text) from public;
revoke execute on function public.admin_create_communication_campaign(text, uuid, text, timestamptz) from public;
revoke execute on function public.admin_set_campaign_status(uuid, text, text, text) from public;
revoke execute on function public.admin_trust_metrics() from public;

grant execute on function public.admin_list_chats(text, text) to authenticated;
grant execute on function public.admin_get_chat(uuid) to authenticated;
grant execute on function public.admin_request_chat_access(uuid, text, text) to authenticated;
grant execute on function public.admin_decide_chat_access(uuid, text, text, text, integer) to authenticated;
grant execute on function public.admin_read_chat_content(uuid) to authenticated;
grant execute on function public.admin_list_moderation_reports(text, text, text) to authenticated;
grant execute on function public.admin_get_moderation_report(uuid) to authenticated;
grant execute on function public.admin_update_moderation_report(uuid, text, text, text) to authenticated;
grant execute on function public.admin_list_reviews(text, text, integer) to authenticated;
grant execute on function public.admin_get_review(uuid) to authenticated;
grant execute on function public.admin_set_review_status(uuid, text, text, text) to authenticated;
grant execute on function public.admin_list_support_tickets(text, text, text) to authenticated;
grant execute on function public.admin_get_support_ticket(uuid) to authenticated;
grant execute on function public.admin_assign_support_ticket(uuid, text) to authenticated;
grant execute on function public.admin_update_support_status(uuid, text, text, text) to authenticated;
grant execute on function public.admin_reply_support_ticket(uuid, text, boolean) to authenticated;
grant execute on function public.admin_list_communication_templates(text, text) to authenticated;
grant execute on function public.admin_set_communication_template_status(uuid, text, text, text) to authenticated;
grant execute on function public.admin_list_communication_campaigns(text, text) to authenticated;
grant execute on function public.admin_create_communication_campaign(text, uuid, text, timestamptz) to authenticated;
grant execute on function public.admin_set_campaign_status(uuid, text, text, text) to authenticated;
grant execute on function public.admin_trust_metrics() to authenticated;
