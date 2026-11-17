-- =============================================================================
-- Chat de Compras · Respuestas de mis ofertas y chat de negociación
--
-- Módulo ADITIVO para talleres verificados y comercios. Reutiliza las tablas
-- existentes (purchase_requests, purchase_offers, chat_threads, chat_messages):
-- NO crea un chat paralelo ni cambia los flujos actuales de comprador/comercio.
--
-- Qué hace:
--   1. Verifica que existan las tablas base.
--   2. Agrega columnas aditivas de negociación/confirmación a purchase_offers y
--      el vínculo offer_id en chat_messages.
--   3. Corrige RLS de chat: elDueño del taller puede ver sus propios hilos.
--   4. Expone RPC SECURITY DEFINER con comprobación estricta de propiedad.
--   5. Configura realtime (canal por oferta + triggers de publicación + RLS).
--
-- Aplicar con:
--   npx -y @insforge/cli db migrations up 20261117180000_offer-responses-negotiation.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Verificación de tablas base (falla en voz alta si falta alguna)
-- -----------------------------------------------------------------------------
do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.purchase_requests') is null then
    v_missing := array_append(v_missing, 'purchase_requests');
  end if;
  if to_regclass('public.purchase_offers') is null then
    v_missing := array_append(v_missing, 'purchase_offers');
  end if;
  if to_regclass('public.chat_threads') is null then
    v_missing := array_append(v_missing, 'chat_threads');
  end if;
  if to_regclass('public.chat_messages') is null then
    v_missing := array_append(v_missing, 'chat_messages');
  end if;
  if to_regclass('public.workshop_profiles') is null then
    v_missing := array_append(v_missing, 'workshop_profiles');
  end if;
  if to_regclass('public.commerce_profiles') is null then
    v_missing := array_append(v_missing, 'commerce_profiles');
  end if;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'Faltan tablas base para respuestas de ofertas: %',
      array_to_string(v_missing, ', ');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Columnas aditivas (no rompen INSERT/SELECT existentes)
-- -----------------------------------------------------------------------------
alter table public.purchase_offers
  add column if not exists negotiation_notes text,
  add column if not exists confirmation_status text not null default 'open',
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid null references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_offers'::regclass
      and conname = 'purchase_offers_confirmation_status_check'
  ) then
    alter table public.purchase_offers
      add constraint purchase_offers_confirmation_status_check
      check (confirmation_status in ('open', 'confirmed'));
  end if;
end $$;

alter table public.chat_messages
  add column if not exists offer_id uuid null
  references public.purchase_offers(id) on delete cascade;

create index if not exists chat_messages_offer_id_idx
  on public.chat_messages (offer_id) where offer_id is not null;

create index if not exists purchase_offers_response_inbox_idx
  on public.purchase_offers (workshop_id, created_at desc)
  where workshop_id is not null;

create index if not exists purchase_offers_commerce_response_idx
  on public.purchase_offers (commerce_id, created_at desc)
  where commerce_id is not null;

-- -----------------------------------------------------------------------------
-- 3. RLS de chat: el taller dueño también puede leer/escribir sus hilos
-- -----------------------------------------------------------------------------
-- app_can_access_chat se usa en las políticas de chat_messages. Antes solo
-- contemplaba comprador y comercio, por lo que un Taller Verificado no podía
-- leer los mensajes de las ofertas que él mismo envió.
create or replace function public.app_can_access_chat(p_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.chat_threads ct
    join public.buyer_profiles bp on bp.id = ct.buyer_id
    where ct.id = p_chat_id and bp.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.chat_threads ct
    join public.commerce_profiles cp on cp.id = ct.commerce_id
    where ct.id = p_chat_id and cp.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.chat_threads ct
    join public.workshop_profiles wp on wp.id = ct.workshop_id
    where ct.id = p_chat_id and wp.user_id = auth.uid()
  );
$$;

revoke all on function public.app_can_access_chat(uuid) from public;
grant execute on function public.app_can_access_chat(uuid) to authenticated;

drop policy if exists chat_threads_read on public.chat_threads;
create policy chat_threads_read
  on public.chat_threads for select to authenticated
  using (
    public.app_is_buyer(buyer_id)
    or public.app_is_commerce(commerce_id)
    or public.app_owns_workshop(workshop_id)
  );

drop policy if exists chat_threads_update on public.chat_threads;
create policy chat_threads_update
  on public.chat_threads for update to authenticated
  using (
    public.app_is_buyer(buyer_id)
    or public.app_is_commerce(commerce_id)
    or public.app_owns_workshop(workshop_id)
  )
  with check (
    public.app_is_buyer(buyer_id)
    or public.app_is_commerce(commerce_id)
    or public.app_owns_workshop(workshop_id)
  );

drop policy if exists chat_threads_insert on public.chat_threads;
create policy chat_threads_insert
  on public.chat_threads for insert to authenticated
  with check (
    ((buyer_id is not null) or (commerce_id is not null) or (workshop_id is not null))
    and (
      public.app_is_buyer(buyer_id)
      or public.app_is_commerce(commerce_id)
      or public.app_owns_workshop(workshop_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Helpers de propiedad (SECURITY DEFINER: evitan recursión de RLS)
-- -----------------------------------------------------------------------------
create or replace function public.app_offer_is_mine(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.purchase_offers po
    where po.id = p_offer_id
      and (
        (
          po.workshop_id is not null
          and exists (
            select 1 from public.workshop_profiles wp
            where wp.id = po.workshop_id and wp.user_id = auth.uid()
          )
        )
        or
        (
          po.commerce_id is not null
          and exists (
            select 1 from public.commerce_profiles cp
            where cp.id = po.commerce_id and cp.owner_user_id = auth.uid()
          )
        )
      )
  );
$$;

revoke all on function public.app_offer_is_mine(uuid) from public;
grant execute on function public.app_offer_is_mine(uuid) to authenticated;

-- Hilo de conversación idempotente para una oferta (taller o comercio).
create or replace function public.app_ensure_offer_chat(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_offer public.purchase_offers%rowtype;
  v_thread_id uuid;
  v_buyer_profile_id uuid;
  v_subject text;
begin
  select * into v_offer
  from public.purchase_offers po
  where po.id = p_offer_id;

  if not found then
    raise exception 'La oferta no existe.';
  end if;

  select ct.id into v_thread_id
  from public.chat_threads ct
  where ct.offer_id = p_offer_id
  order by ct.created_at desc
  limit 1;

  if v_thread_id is not null then
    return v_thread_id;
  end if;

  select pr.buyer_id into v_buyer_profile_id
  from public.purchase_requests pr
  where pr.id = v_offer.request_id;

  if v_offer.workshop_id is not null then
    select wp.workshop_name into v_subject
    from public.workshop_profiles wp
    where wp.id = v_offer.workshop_id;
  else
    select cp.trade_name into v_subject
    from public.commerce_profiles cp
    where cp.id = v_offer.commerce_id;
  end if;

  insert into public.chat_threads (
    buyer_id, commerce_id, workshop_id, offer_id, subject,
    status, selected_offer_items
  )
  values (
    v_buyer_profile_id, v_offer.commerce_id, v_offer.workshop_id, p_offer_id,
    coalesce(v_subject, 'Negociación de servicio'), 'active', '[]'::jsonb
  )
  returning id into v_thread_id;

  return v_thread_id;
end;
$$;

revoke all on function public.app_ensure_offer_chat(uuid) from public;
grant execute on function public.app_ensure_offer_chat(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. RPCs de la bandeja y del chat de negociación
-- -----------------------------------------------------------------------------
-- Bandeja: SOLO ofertas del taller verificado o del comercio de la sesión.
create or replace function public.app_my_offer_responses()
returns table (
  offer_id uuid,
  request_id uuid,
  request_title text,
  client_name text,
  total_amount numeric,
  currency text,
  offer_status text,
  confirmation_status text,
  confirmed_at timestamptz,
  labor_amount numeric,
  estimated_days integer,
  notes text,
  thread_id uuid,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz,
  owner_type text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_workshop_id uuid := public.app_verified_workshop_id();
  v_commerce_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select cp.id into v_commerce_id
  from public.commerce_profiles cp
  where cp.owner_user_id = auth.uid()
  limit 1;

  return query
    select po.id,
           po.request_id,
           pr.title,
           coalesce(nullif(btrim(bp.display_name), ''), 'Cliente'),
           po.total_amount,
           po.currency,
           po.status,
           po.confirmation_status,
           po.confirmed_at,
           po.labor_amount,
           po.estimated_days,
           coalesce(po.negotiation_notes, po.conditions),
           t.thread_id,
           lm.body,
           lm.created_at,
           po.created_at,
           case when po.workshop_id is not null then 'workshop' else 'commerce' end
    from public.purchase_offers po
    join public.purchase_requests pr on pr.id = po.request_id
    left join public.buyer_profiles bp on bp.id = pr.buyer_id
    left join lateral (
      select ct.id as thread_id
      from public.chat_threads ct
      where ct.offer_id = po.id
      order by ct.created_at desc
      limit 1
    ) t on true
    left join lateral (
      select cm.body, cm.created_at
      from public.chat_messages cm
      where cm.chat_id = t.thread_id
      order by cm.created_at desc
      limit 1
    ) lm on true
    where ((v_workshop_id is not null and po.workshop_id = v_workshop_id)
        or (v_commerce_id is not null and po.commerce_id = v_commerce_id))
    order by coalesce(lm.created_at, po.created_at) desc
    limit 100;
end;
$$;

revoke all on function public.app_my_offer_responses() from public;
grant execute on function public.app_my_offer_responses() to authenticated;

-- Detalle de una negociación: oferta + mensajes del hilo. La propiedad se
-- comprueba en el servidor; el cliente nunca puede pedir una oferta ajena.
create or replace function public.app_offer_negotiation(p_offer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_thread_id uuid;
  v_offer jsonb;
  v_messages jsonb;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if not public.app_offer_is_mine(p_offer_id) then
    raise exception 'No tienes acceso a esta negociación.';
  end if;

  v_thread_id := public.app_ensure_offer_chat(p_offer_id);

  select jsonb_build_object(
    'offerId', po.id,
    'requestId', po.request_id,
    'requestTitle', pr.title,
    'clientName', coalesce(nullif(btrim(bp.display_name), ''), 'Cliente'),
    'totalAmount', po.total_amount,
    'currency', po.currency,
    'offerStatus', po.status,
    'confirmationStatus', po.confirmation_status,
    'confirmedAt', po.confirmed_at,
    'laborAmount', po.labor_amount,
    'estimatedDays', po.estimated_days,
    'notes', coalesce(po.negotiation_notes, po.conditions),
    'threadId', v_thread_id,
    'ownerType', case when po.workshop_id is not null then 'workshop' else 'commerce' end
  ) into v_offer
  from public.purchase_offers po
  join public.purchase_requests pr on pr.id = po.request_id
  left join public.buyer_profiles bp on bp.id = pr.buyer_id
  where po.id = p_offer_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cm.id,
        'senderType', cm.sender_type,
        'senderName', cm.sender_name,
        'body', cm.body,
        'createdAt', cm.created_at,
        'isMine', cm.sender_type = 'commerce'
      )
      order by cm.created_at, cm.id
    ),
    '[]'::jsonb
  ) into v_messages
  from public.chat_messages cm
  where cm.chat_id = v_thread_id;

  return jsonb_build_object('offer', v_offer, 'messages', v_messages);
end;
$$;

revoke all on function public.app_offer_negotiation(uuid) from public;
grant execute on function public.app_offer_negotiation(uuid) to authenticated;

-- Enviar un mensaje al hilo de la oferta. Se guarda como 'commerce' para que
-- el comprador lo vea como "el otro lado" en la pantalla /chat/:id existente.
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

  insert into public.chat_messages (chat_id, sender_type, sender_name, body, offer_id)
  values (v_thread_id, 'commerce', v_sender_name, v_body, p_offer_id)
  returning jsonb_build_object(
    'id', id,
    'chatId', chat_id,
    'senderType', sender_type,
    'senderName', sender_name,
    'body', body,
    'createdAt', created_at,
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

-- Afinar detalles del repuesto/servicio sin crear otro canal de datos.
create or replace function public.app_save_offer_negotiation_notes(
  p_offer_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_notes text := btrim(coalesce(p_notes, ''));
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if char_length(v_notes) > 1000 then
    raise exception 'Los detalles no pueden superar los 1000 caracteres.';
  end if;
  if not public.app_offer_is_mine(p_offer_id) then
    raise exception 'No tienes acceso a esta negociación.';
  end if;

  update public.purchase_offers po
  set negotiation_notes = v_notes,
      conditions = v_notes,
      updated_at = now()
  where po.id = p_offer_id;

  select jsonb_build_object(
    'offerId', po.id,
    'notes', po.negotiation_notes,
    'confirmationStatus', po.confirmation_status
  ) into v_result
  from public.purchase_offers po
  where po.id = p_offer_id;

  return v_result;
end;
$$;

revoke all on function public.app_save_offer_negotiation_notes(uuid, text) from public;
grant execute on function public.app_save_offer_negotiation_notes(uuid, text) to authenticated;

-- Confirmación rápida de la cotización. Idempotente: no duplica el mensaje
-- del sistema si ya estaba confirmada.
create or replace function public.app_confirm_offer_service(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_status text;
  v_thread_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if not public.app_offer_is_mine(p_offer_id) then
    raise exception 'No tienes acceso a esta negociación.';
  end if;

  select po.confirmation_status into v_status
  from public.purchase_offers po
  where po.id = p_offer_id;

  if v_status is distinct from 'confirmed' then
    update public.purchase_offers po
    set confirmation_status = 'confirmed',
        confirmed_at = now(),
        confirmed_by = auth.uid(),
        updated_at = now()
    where po.id = p_offer_id;

    v_thread_id := public.app_ensure_offer_chat(p_offer_id);

    insert into public.chat_messages (chat_id, sender_type, sender_name, body, offer_id)
    values (
      v_thread_id,
      'system',
      'Sistema',
      'Servicio / Reserva Confirmada por el proveedor.',
      p_offer_id
    );
  end if;

  select jsonb_build_object(
    'offerId', po.id,
    'confirmationStatus', po.confirmation_status,
    'confirmedAt', po.confirmed_at
  ) into v_result
  from public.purchase_offers po
  where po.id = p_offer_id;

  return v_result;
end;
$$;

revoke all on function public.app_confirm_offer_service(uuid) from public;
grant execute on function public.app_confirm_offer_service(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Realtime: canal por oferta y publicación desde tablas de la app
-- -----------------------------------------------------------------------------
insert into realtime.channels (pattern, description, enabled)
values (
  'offer-negotiation:%',
  'Chat de negociación de respuestas de mis ofertas (talleres y comercios)',
  true
)
on conflict (pattern) do update
set description = excluded.description,
    enabled = true;

create or replace function public.app_publish_offer_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.offer_id is not null then
    perform realtime.publish(
      'offer-negotiation:' || new.offer_id::text,
      'message_created',
      jsonb_build_object(
        'id', new.id,
        'chatId', new.chat_id,
        'offerId', new.offer_id,
        'senderType', new.sender_type,
        'senderName', new.sender_name,
        'body', new.body,
        'createdAt', new.created_at
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists chat_messages_offer_publish on public.chat_messages;
create trigger chat_messages_offer_publish
  after insert on public.chat_messages
  for each row execute function public.app_publish_offer_message();

create or replace function public.app_publish_offer_confirmation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if old.confirmation_status is distinct from new.confirmation_status then
    perform realtime.publish(
      'offer-negotiation:' || new.id::text,
      'confirmation_changed',
      jsonb_build_object(
        'offerId', new.id,
        'confirmationStatus', new.confirmation_status,
        'confirmedAt', new.confirmed_at
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists purchase_offers_confirmation_publish on public.purchase_offers;
create trigger purchase_offers_confirmation_publish
  after update on public.purchase_offers
  for each row execute function public.app_publish_offer_confirmation();

-- RLS de realtime: los patrones existentes siguen igual; el canal nuevo solo
-- se puede suscribir si la oferta pertenece al usuario autenticado.
alter table realtime.channels enable row level security;

drop policy if exists offer_negotiation_channels_read on realtime.channels;
create policy offer_negotiation_channels_read
  on realtime.channels for select to authenticated
  using (
    pattern <> 'offer-negotiation:%'
    or (
      pattern = 'offer-negotiation:%'
      and exists (
        select 1
        from public.purchase_offers po
        where po.id = nullif(split_part(realtime.channel_name(), ':', 2), '')::uuid
          and public.app_offer_is_mine(po.id)
      )
    )
  );

alter table realtime.messages enable row level security;

drop policy if exists offer_negotiation_messages_read on realtime.messages;
create policy offer_negotiation_messages_read
  on realtime.messages for select to authenticated
  using (
    channel_name not like 'offer-negotiation:%'
    or exists (
      select 1
      from public.purchase_offers po
      where po.id = nullif(split_part(channel_name, ':', 2), '')::uuid
        and public.app_offer_is_mine(po.id)
    )
  );

drop policy if exists offer_negotiation_messages_insert on realtime.messages;
create policy offer_negotiation_messages_insert
  on realtime.messages for insert to authenticated
  with check (
    channel_name not like 'offer-negotiation:%'
    or exists (
      select 1
      from public.purchase_offers po
      where po.id = nullif(split_part(channel_name, ':', 2), '')::uuid
        and public.app_offer_is_mine(po.id)
    )
  );

-- Fin de la migración.
