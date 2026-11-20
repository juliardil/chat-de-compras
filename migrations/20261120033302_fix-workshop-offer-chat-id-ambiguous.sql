-- =============================================================================
-- Fix quirúrgico: ambigüedad de `id` en el flujo "Mis propuestas" del taller
--
-- Al pulsar "Chat" desde /workshop-jobs se invocaba
-- `public.app_open_workshop_offer_chat`, que declara `returns table (id uuid)`
-- y después ejecutaba `returning id into v_thread_id`. En PL/pgSQL ese `id` es
-- a la vez variable de salida y columna de `chat_threads`, por lo que
-- PostgreSQL responde:
--   column reference "id" is ambiguous
--
-- La corrección califica TODAS las referencias a `id` del flujo:
--   * `ct.id` en el INSERT de `chat_threads` (alias de tabla).
--   * `cm.id` en el RETURNING del INSERT de `chat_messages`.
--   * `po.id` / `pr.id` en el JOIN de `app_my_service_proposals()`.
--
-- NO modifica tablas, RLS, políticas ni funciones distintas a estas tres.
-- Los contratos (nombres y tipos de retorno) permanecen idénticos.
-- =============================================================================

create or replace function public.app_my_service_proposals()
returns table (
  id uuid,
  request_id uuid,
  request_title text,
  labor_amount numeric,
  estimated_days integer,
  notes text,
  status text,
  created_at timestamptz
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
    raise exception 'Solo un Taller Verificado puede consultar sus propuestas.';
  end if;

  -- `po.id` y `pr.id` calificados: sin ambigüedad entre purchase_offers y
  -- purchase_requests aunque ambas tablas expongan una columna `id`.
  return query
    select po.id, po.request_id, pr.title, po.labor_amount, po.estimated_days,
           po.conditions, po.status, po.created_at
    from public.purchase_offers po
    join public.purchase_requests pr on pr.id = po.request_id
    where po.workshop_id = v_workshop_id
    order by po.created_at desc
    limit 100;
end;
$$;

revoke all on function public.app_my_service_proposals() from public;
grant execute on function public.app_my_service_proposals() to authenticated;

-- Abre (o reutiliza) el hilo de chat de una propuesta de taller. El alias `ct`
-- evita colisionar `chat_threads.id` con la columna de salida `id` de la RPC.
create or replace function public.app_open_workshop_offer_chat(p_offer_id uuid)
returns table (id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.purchase_offers%rowtype;
  v_buyer_id uuid;
  v_buyer_profile_id uuid;
  v_thread_id uuid;
  v_subject text;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select * into v_offer
  from public.purchase_offers po
  where po.id = p_offer_id and po.workshop_id is not null;

  if not found then
    raise exception 'La propuesta de taller no existe.';
  end if;

  select pr.buyer_id into v_buyer_id
  from public.purchase_requests pr
  where pr.id = v_offer.request_id;

  select bp.id into v_buyer_profile_id
  from public.buyer_profiles bp
  where bp.id = v_buyer_id;

  -- Solo el comprador de la solicitud o el taller que cotizó pueden abrirlo.
  if not (
    exists (select 1 from public.buyer_profiles bp where bp.id = v_buyer_id and bp.user_id = v_uid)
    or exists (
      select 1 from public.workshop_profiles wp
      where wp.id = v_offer.workshop_id and wp.user_id = v_uid
    )
  ) then
    raise exception 'No tienes acceso a esta conversación.';
  end if;

  select coalesce(wp.workshop_name, 'Taller Verificado') into v_subject
  from public.workshop_profiles wp
  where wp.id = v_offer.workshop_id;

  select ct.id into v_thread_id
  from public.chat_threads ct
  where ct.offer_id = p_offer_id and ct.workshop_id = v_offer.workshop_id
  order by ct.created_at desc
  limit 1;

  if v_thread_id is null then
    insert into public.chat_threads as ct (
      buyer_id, commerce_id, workshop_id, offer_id, subject,
      status, selected_offer_items
    )
    values (
      v_buyer_profile_id, null, v_offer.workshop_id, p_offer_id, v_subject,
      'active', '[]'::jsonb
    )
    returning ct.id into v_thread_id;
  end if;

  return query select v_thread_id;
end;
$$;

revoke all on function public.app_open_workshop_offer_chat(uuid) from public;
grant execute on function public.app_open_workshop_offer_chat(uuid) to authenticated;

-- Enviar mensajes al chat de negociación: el alias `cm` califica cada columna
-- devuelta para que el INSERT ... RETURNING nunca dependa del search_path ni
-- de variables de salida homónimas.
create or replace function public.app_send_offer_negotiation_message(
  p_offer_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_thread_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_sender_name text;
  v_message jsonb;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'El mensaje debe tener entre 1 y 1000 caracteres.';
  end if;
  if not public.app_offer_is_mine(p_offer_id) then
    raise exception 'No tienes acceso a esta negociación.';
  end if;

  v_thread_id := public.app_ensure_offer_chat(p_offer_id);

  select coalesce(wp.workshop_name, cp.trade_name, 'Proveedor') into v_sender_name
  from public.purchase_offers po
  left join public.workshop_profiles wp on wp.id = po.workshop_id
  left join public.commerce_profiles cp on cp.id = po.commerce_id
  where po.id = p_offer_id;

  insert into public.chat_messages as cm (chat_id, sender_type, sender_name, body, offer_id)
  values (v_thread_id, 'commerce', v_sender_name, v_body, p_offer_id)
  returning jsonb_build_object(
    'id', cm.id,
    'chatId', cm.chat_id,
    'senderType', cm.sender_type,
    'senderName', cm.sender_name,
    'body', cm.body,
    'createdAt', cm.created_at,
    'isMine', true
  ) into v_message;

  update public.chat_threads ct
  set last_message_at = now(), updated_at = now()
  where ct.id = v_thread_id;

  return v_message;
end;
$$;

revoke all on function public.app_send_offer_negotiation_message(uuid, text) from public;
grant execute on function public.app_send_offer_negotiation_message(uuid, text) to authenticated;
