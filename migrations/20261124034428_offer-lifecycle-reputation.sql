-- Ciclo de vida completo de oferta, entrega y reputación.
-- Idempotente: columnas, constraints, índices, funciones y grants se crean solo
-- si no existen. No se modifica la migración de recomendaciones anterior.

-- -----------------------------------------------------------------------------
-- 1. SLA de respuesta del comercio
-- -----------------------------------------------------------------------------
alter table public.commerce_profiles
  add column if not exists max_response_minutes integer;

update public.commerce_profiles
set max_response_minutes = 15
where max_response_minutes is null;

alter table public.commerce_profiles
  alter column max_response_minutes set default 15,
  alter column max_response_minutes set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'commerce_profiles_max_response_minutes_check'
      and conrelid = 'public.commerce_profiles'::regclass
  ) then
    alter table public.commerce_profiles
      add constraint commerce_profiles_max_response_minutes_check
      check (max_response_minutes in (5, 10, 15, 20, 30));
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Estado de ciclo de vida en el hilo de chat
-- -----------------------------------------------------------------------------
alter table public.chat_threads
  add column if not exists request_id uuid,
  add column if not exists category text,
  add column if not exists lifecycle_state text not null default 'SIN_CICLO',
  add column if not exists response_deadline_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists responded_on_time boolean,
  add column if not exists agreed_delivery_hours numeric,
  add column if not exists agreed_delivery_label text,
  add column if not exists agreed_deadline_at timestamptz,
  add column if not exists delivery_deadline_at timestamptz,
  add column if not exists delay_notice_at timestamptz,
  add column if not exists delay_attempts integer not null default 0,
  add column if not exists extension_reason text,
  add column if not exists extension_deadline_at timestamptz,
  add column if not exists delivery_confirmed_at timestamptz,
  add column if not exists delivered_on_time boolean,
  add column if not exists failure_reason text,
  add column if not exists rating integer,
  add column if not exists arrival_on_time boolean,
  add column if not exists review_comment text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists released_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_threads_lifecycle_state_check'
      and conrelid = 'public.chat_threads'::regclass
  ) then
    alter table public.chat_threads
      add constraint chat_threads_lifecycle_state_check
      check (lifecycle_state in (
        'SIN_CICLO',
        'ESPERANDO_ACEPTACION',
        'EN_NEGOCIACION',
        'LIBERADO_POR_TIEMPO',
        'EN_ENTREGA',
        'ENTREGA_CONFIRMADA',
        'NO_ENTREGADO',
        'CALIFICADO',
        'CANCELADO'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_threads_lifecycle_rating_check'
      and conrelid = 'public.chat_threads'::regclass
  ) then
    alter table public.chat_threads
      add constraint chat_threads_lifecycle_rating_check
      check (rating is null or rating between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_threads_lifecycle_hours_check'
      and conrelid = 'public.chat_threads'::regclass
  ) then
    alter table public.chat_threads
      add constraint chat_threads_lifecycle_hours_check
      check (
        agreed_delivery_hours is null
        or (agreed_delivery_hours > 0 and agreed_delivery_hours <= 720)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_threads_lifecycle_delay_attempts_check'
      and conrelid = 'public.chat_threads'::regclass
  ) then
    alter table public.chat_threads
      add constraint chat_threads_lifecycle_delay_attempts_check
      check (delay_attempts >= 0 and delay_attempts <= 10);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_threads_lifecycle_failure_reason_check'
      and conrelid = 'public.chat_threads'::regclass
  ) then
    alter table public.chat_threads
      add constraint chat_threads_lifecycle_failure_reason_check
      check (
        failure_reason is null
        or failure_reason in (
          'No llegó',
          'Llegó incompleto',
          'Llegó dañado',
          'La empresa no respondió',
          'Otro',
          'Incumplimiento de plazo'
        )
      );
  end if;
end $$;

-- Un hilo por solicitud + oferta. No se reutiliza el hilo buyer + commerce de
-- la versión anterior: cada oferta elegida abre su propio ciclo.
create unique index if not exists chat_threads_request_offer_unique
  on public.chat_threads (request_id, offer_id)
  where request_id is not null and offer_id is not null;

-- Solo una atención activa por solicitud y por categoría/comercio del comprador.
create unique index if not exists chat_threads_active_request_per_buyer
  on public.chat_threads (buyer_id, request_id)
  where request_id is not null
    and lifecycle_state in ('ESPERANDO_ACEPTACION', 'EN_NEGOCIACION', 'EN_ENTREGA');

create unique index if not exists chat_threads_active_category_per_buyer
  on public.chat_threads (buyer_id, category, commerce_id)
  where category is not null
    and commerce_id is not null
    and lifecycle_state in ('ESPERANDO_ACEPTACION', 'EN_NEGOCIACION', 'EN_ENTREGA');

create index if not exists chat_threads_response_deadline_idx
  on public.chat_threads (response_deadline_at)
  where lifecycle_state = 'ESPERANDO_ACEPTACION';

create index if not exists chat_threads_delivery_deadline_idx
  on public.chat_threads (delivery_deadline_at)
  where lifecycle_state = 'EN_ENTREGA';

grant select, insert, update on public.chat_threads to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Helpers internos
-- -----------------------------------------------------------------------------
create or replace function public.app_lifecycle_current_buyer_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select bp.id
  from public.buyer_profiles bp
  where bp.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.app_lifecycle_current_commerce_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select cp.id
  from public.commerce_profiles cp
  where cp.owner_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.app_lifecycle_can_access_chat(p_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.chat_threads ct
    where ct.id = p_chat_id
      and (
        ct.buyer_id = public.app_lifecycle_current_buyer_id()
        or ct.commerce_id = public.app_lifecycle_current_commerce_id()
      )
  );
$$;

create or replace function public.app_lifecycle_system_message(
  p_chat_id uuid,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.app_lifecycle_can_access_chat(p_chat_id) then
    raise exception 'No tienes acceso a esta conversación.';
  end if;

  insert into public.chat_messages (chat_id, sender_type, sender_name, body)
  values (p_chat_id, 'system', 'Sistema', left(p_body, 1000));

  update public.chat_threads
  set last_message_at = now()
  where id = p_chat_id;
end;
$$;

-- Vencimientos bajo demanda. El comprador los ejecuta al entrar a /offers o al
-- abrir el chat; no dependemos de un scheduler externo.
drop function if exists public.app_expire_offer_lifecycles();
create or replace function public.app_expire_offer_lifecycles()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_count integer := 0;
  v_thread record;
begin
  for v_thread in
    select ct.id, ct.subject
    from public.chat_threads ct
    where ct.lifecycle_state = 'ESPERANDO_ACEPTACION'
      and ct.response_deadline_at is not null
      and ct.response_deadline_at < now()
  loop
    update public.chat_threads
    set lifecycle_state = 'LIBERADO_POR_TIEMPO',
        responded_on_time = false,
        released_at = now(),
        updated_at = now()
    where id = v_thread.id;

    perform public.app_lifecycle_system_message(
      v_thread.id,
      'El comercio no respondió dentro del plazo. Ya puedes elegir otro vendedor.'
    );
    v_count := v_count + 1;
  end loop;

  -- El primer vencimiento de entrega no cambia el estado: abre el paso en el
  -- que el comercio explica el retraso y propone un nuevo plazo.
  for v_thread in
    select ct.id
    from public.chat_threads ct
    where ct.lifecycle_state = 'EN_ENTREGA'
      and ct.delivery_deadline_at is not null
      and ct.delivery_deadline_at < now()
      and ct.delay_notice_at is null
  loop
    update public.chat_threads
    set delay_notice_at = now(), updated_at = now()
    where id = v_thread.id;

    perform public.app_lifecycle_system_message(
      v_thread.id,
      'El plazo máximo de entrega venció. El comercio debe indicar por qué no llegó y proponer un nuevo tiempo.'
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Bloquea nuevas ofertas de otro vendedor mientras hay una atención activa para
-- la misma solicitud o categoría del comprador.
create or replace function public.app_block_booked_offer_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_buyer_id uuid;
  v_category text;
begin
  select pr.buyer_id, pr.category into v_buyer_id, v_category
  from public.purchase_requests pr
  where pr.id = new.request_id;

  if v_buyer_id is not null and exists (
    select 1
    from public.chat_threads ct
    where ct.buyer_id = v_buyer_id
      and ct.request_id = new.request_id
      and ct.lifecycle_state in ('ESPERANDO_ACEPTACION', 'EN_NEGOCIACION', 'EN_ENTREGA')
  ) then
    raise exception 'Ya hay un vendedor atendiendo esta solicitud.';
  end if;

  if v_category is not null and new.commerce_id is not null and exists (
    select 1
    from public.chat_threads ct
    where ct.buyer_id = v_buyer_id
      and ct.category = v_category
      and ct.commerce_id is distinct from new.commerce_id
      and ct.lifecycle_state in ('ESPERANDO_ACEPTACION', 'EN_NEGOCIACION', 'EN_ENTREGA')
  ) then
    raise exception 'Ya estás atendiendo otra oferta de esta categoría.';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_offers_block_booked_request on public.purchase_offers;
create trigger purchase_offers_block_booked_request
  before insert on public.purchase_offers
  for each row execute function public.app_block_booked_offer_insert();

-- -----------------------------------------------------------------------------
-- 4. Acciones del ciclo de vida
-- -----------------------------------------------------------------------------
drop function if exists public.app_select_offer_for_lifecycle(uuid, text);
create or replace function public.app_select_offer_for_lifecycle(
  p_offer_id uuid,
  p_category text default null
)
returns table (
  chat_id uuid,
  state text,
  response_deadline_at timestamptz,
  request_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_buyer_id uuid := public.app_lifecycle_current_buyer_id();
  v_buyer_user_id uuid := auth.uid();
  v_offer public.purchase_offers%rowtype;
  v_request public.purchase_requests%rowtype;
  v_commerce_id uuid;
  v_minutes integer;
  v_deadline timestamptz;
  v_thread_id uuid;
  v_category text;
begin
  if v_buyer_user_id is null or v_buyer_id is null then
    raise exception 'No hay una sesión de comprador activa.';
  end if;

  select * into v_offer
  from public.purchase_offers po
  where po.id = p_offer_id;

  if not found then
    raise exception 'La oferta no existe.';
  end if;

  select * into v_request
  from public.purchase_requests pr
  where pr.id = v_offer.request_id;

  if not found or v_request.buyer_id is distinct from v_buyer_id then
    raise exception 'Esta oferta no pertenece a una solicitud tuya.';
  end if;

  if v_offer.status not in ('active', 'sent') then
    raise exception 'Esta oferta ya no está disponible.';
  end if;

  v_commerce_id := v_offer.commerce_id;
  if v_commerce_id is null then
    raise exception 'Esta propuesta no tiene un comercio asociado.';
  end if;

  v_category := nullif(btrim(coalesce(p_category, v_request.category, '')), '');

  perform public.app_expire_offer_lifecycles();

  if exists (
    select 1
    from public.chat_threads ct
    where ct.buyer_id = v_buyer_id
      and ct.request_id = v_offer.request_id
      and ct.lifecycle_state in ('ESPERANDO_ACEPTACION', 'EN_NEGOCIACION', 'EN_ENTREGA')
  ) then
    raise exception 'Te están atendiendo esta solicitud.';
  end if;

  if v_category is not null and exists (
    select 1
    from public.chat_threads ct
    where ct.buyer_id = v_buyer_id
      and ct.category = v_category
      and ct.commerce_id is distinct from v_commerce_id
      and ct.lifecycle_state in ('ESPERANDO_ACEPTACION', 'EN_NEGOCIACION', 'EN_ENTREGA')
  ) then
    raise exception 'Ya estás atendiendo otra oferta de esta categoría.';
  end if;

  select cp.max_response_minutes into v_minutes
  from public.commerce_profiles cp
  where cp.id = v_commerce_id;
  v_minutes := coalesce(v_minutes, 15);
  v_deadline := now() + make_interval(mins => v_minutes);

  select ct.id into v_thread_id
  from public.chat_threads ct
  where ct.request_id = v_offer.request_id
    and ct.offer_id = p_offer_id
  order by ct.created_at desc
  limit 1;

  if v_thread_id is null then
    insert into public.chat_threads (
      buyer_id, commerce_id, workshop_id, request_id, offer_id, category,
      subject, status, lifecycle_state, response_deadline_at,
      selected_offer_items
    )
    values (
      v_buyer_id, v_commerce_id, v_offer.workshop_id, v_offer.request_id,
      p_offer_id, v_category,
      coalesce(v_request.title, 'Solicitud de compra'), 'active',
      'ESPERANDO_ACEPTACION', v_deadline, '[]'::jsonb
    )
    returning id into v_thread_id;
  else
    update public.chat_threads
    set lifecycle_state = 'ESPERANDO_ACEPTACION',
        response_deadline_at = v_deadline,
        responded_at = null,
        responded_on_time = null,
        agreed_delivery_hours = null,
        agreed_delivery_label = null,
        agreed_deadline_at = null,
        delivery_deadline_at = null,
        delay_notice_at = null,
        delay_attempts = 0,
        extension_reason = null,
        extension_deadline_at = null,
        delivery_confirmed_at = null,
        delivered_on_time = null,
        failure_reason = null,
        rating = null,
        arrival_on_time = null,
        review_comment = null,
        reviewed_at = null,
        released_at = null,
        updated_at = now()
    where id = v_thread_id;
  end if;

  perform public.app_lifecycle_system_message(
    v_thread_id,
    'Elegiste esta oferta. El comercio tiene hasta '
      || to_char(v_deadline at time zone 'America/Mexico_City', 'HH24:MI')
      || ' para aceptar la solicitud.'
  );

  return query
    select v_thread_id, 'ESPERANDO_ACEPTACION'::text, v_deadline, v_offer.request_id;
end;
$$;

drop function if exists public.app_accept_offer_request(uuid);
create or replace function public.app_accept_offer_request(p_chat_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_thread public.chat_threads%rowtype;
  v_commerce_id uuid := public.app_lifecycle_current_commerce_id();
begin
  if v_commerce_id is null then
    raise exception 'No hay una sesión de comercio activa.';
  end if;

  perform public.app_expire_offer_lifecycles();

  select * into v_thread
  from public.chat_threads ct
  where ct.id = p_chat_id;

  if not found or v_thread.commerce_id is distinct from v_commerce_id then
    raise exception 'Esta solicitud no pertenece a tu comercio.';
  end if;

  if v_thread.lifecycle_state <> 'ESPERANDO_ACEPTACION' then
    raise exception 'Esta solicitud ya no está esperando respuesta.';
  end if;

  update public.chat_threads
  set lifecycle_state = 'EN_NEGOCIACION',
      responded_at = now(),
      responded_on_time = true,
      updated_at = now()
  where id = p_chat_id;

  perform public.app_lifecycle_system_message(
    p_chat_id,
    'El comercio aceptó la solicitud y responded dentro del plazo.'
  );

  return true;
end;
$$;

drop function if exists public.app_cancel_offer_negotiation(uuid);
create or replace function public.app_cancel_offer_negotiation(p_chat_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_thread public.chat_threads%rowtype;
begin
  if not public.app_lifecycle_can_access_chat(p_chat_id) then
    raise exception 'No tienes acceso a esta conversación.';
  end if;

  select * into v_thread from public.chat_threads ct where ct.id = p_chat_id;
  if v_thread.lifecycle_state <> 'EN_NEGOCIACION' then
    raise exception 'La negociación ya no está abierta.';
  end if;

  update public.chat_threads
  set lifecycle_state = 'CANCELADO', released_at = now(), updated_at = now()
  where id = p_chat_id;

  perform public.app_lifecycle_system_message(
    p_chat_id,
    'La negociación se canceló. Ya puedes elegir otra oferta.'
  );

  return true;
end;
$$;

drop function if exists public.app_agree_delivery(uuid, numeric, text);
create or replace function public.app_agree_delivery(
  p_chat_id uuid,
  p_hours numeric,
  p_label text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_thread public.chat_threads%rowtype;
  v_deadline timestamptz;
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
begin
  if not public.app_lifecycle_can_access_chat(p_chat_id) then
    raise exception 'No tienes acceso a esta conversación.';
  end if;

  if p_hours is null or p_hours <= 0 or p_hours > 720 then
    raise exception 'Indica un plazo de entrega válido (máximo 30 días).';
  end if;

  if v_label is null or char_length(v_label) > 120 then
    raise exception 'Indica el plazo acordado.';
  end if;

  select * into v_thread from public.chat_threads ct where ct.id = p_chat_id;
  if v_thread.lifecycle_state <> 'EN_NEGOCIACION' then
    raise exception 'Primero debe existir una negociación aceptada.';
  end if;

  v_deadline := now() + make_interval(mins => round(p_hours * 60)::integer);

  update public.chat_threads
  set lifecycle_state = 'EN_ENTREGA',
      agreed_delivery_hours = p_hours,
      agreed_delivery_label = v_label,
      agreed_deadline_at = v_deadline,
      delivery_deadline_at = v_deadline,
      delay_notice_at = null,
      delay_attempts = 0,
      extension_reason = null,
      extension_deadline_at = null,
      updated_at = now()
  where id = p_chat_id;

  update public.purchase_offers
  set status = 'accepted', accepted_at = now(), updated_at = now()
  where id = v_thread.offer_id;

  perform public.app_lifecycle_system_message(
    p_chat_id,
    'Acuerdo de entrega: ' || v_label || '. El pedido debe llegar antes de '
      || to_char(v_deadline at time zone 'America/Mexico_City', 'DD/MM HH24:MI')
      || '.'
  );

  return true;
end;
$$;

drop function if exists public.app_report_delivery_delay(uuid, text, numeric);
create or replace function public.app_report_delivery_delay(
  p_chat_id uuid,
  p_reason text,
  p_hours numeric
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_thread public.chat_threads%rowtype;
  v_commerce_id uuid := public.app_lifecycle_current_commerce_id();
  v_deadline timestamptz;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_commerce_id is null then
    raise exception 'No hay una sesión de comercio activa.';
  end if;

  select * into v_thread from public.chat_threads ct where ct.id = p_chat_id;
  if not found or v_thread.commerce_id is distinct from v_commerce_id then
    raise exception 'Esta entrega no pertenece a tu comercio.';
  end if;

  if v_thread.lifecycle_state <> 'EN_ENTREGA' then
    raise exception 'No hay una entrega en curso.';
  end if;

  if v_thread.delivery_deadline_at is null or v_thread.delivery_deadline_at > now() then
    raise exception 'Todavía no venció el plazo acordado.';
  end if;

  if v_thread.delay_attempts >= 2 then
    raise exception 'Ya se agotaron las prórrogas de este pedido.';
  end if;

  if v_reason is null or char_length(v_reason) > 300 then
    raise exception 'Indica por qué no llegó el pedido.';
  end if;

  if p_hours is null or p_hours <= 0 or p_hours > 720 then
    raise exception 'Indica un nuevo plazo válido (máximo 30 días).';
  end if;

  v_deadline := now() + make_interval(mins => round(p_hours * 60)::integer);

  update public.chat_threads
  set extension_reason = v_reason,
      extension_deadline_at = v_deadline,
      delivery_deadline_at = v_deadline,
      delay_notice_at = null,
      delay_attempts = delay_attempts + 1,
      updated_at = now()
  where id = p_chat_id;

  perform public.app_lifecycle_system_message(
    p_chat_id,
    'El comercio indicó: ' || v_reason || '. Nuevo plazo: '
      || to_char(v_deadline at time zone 'America/Mexico_City', 'DD/MM HH24:MI')
      || '.'
  );

  return true;
end;
$$;

drop function if exists public.app_keep_waiting_for_delivery(uuid);
create or replace function public.app_keep_waiting_for_delivery(p_chat_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_thread public.chat_threads%rowtype;
  v_buyer_id uuid := public.app_lifecycle_current_buyer_id();
begin
  if v_buyer_id is null then
    raise exception 'No hay una sesión de comprador activa.';
  end if;

  select * into v_thread from public.chat_threads ct where ct.id = p_chat_id;
  if not found or v_thread.buyer_id is distinct from v_buyer_id then
    raise exception 'Esta compra no es tuya.';
  end if;

  if v_thread.lifecycle_state <> 'EN_ENTREGA'
     or v_thread.delay_attempts < 2
     or v_thread.delivery_deadline_at is null
     or v_thread.delivery_deadline_at > now() then
    raise exception 'Todavía no puedes decidir sobre este incumplimiento.';
  end if;

  update public.chat_threads
  set delay_attempts = 1,
      delivery_deadline_at = now() + interval '24 hours',
      delay_notice_at = null,
      updated_at = now()
  where id = p_chat_id;

  perform public.app_lifecycle_system_message(
    p_chat_id,
    'Decidiste seguir esperando. Se otorgaron 24 horas adicionales para la entrega.'
  );

  return true;
end;
$$;

drop function if exists public.app_cancel_for_breach(uuid);
create or replace function public.app_cancel_for_breach(p_chat_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_thread public.chat_threads%rowtype;
  v_buyer_id uuid := public.app_lifecycle_current_buyer_id();
begin
  if v_buyer_id is null then
    raise exception 'No hay una sesión de comprador activa.';
  end if;

  select * into v_thread from public.chat_threads ct where ct.id = p_chat_id;
  if not found or v_thread.buyer_id is distinct from v_buyer_id then
    raise exception 'Esta compra no es tuya.';
  end if;

  if v_thread.lifecycle_state <> 'EN_ENTREGA'
     or v_thread.delay_attempts < 2
     or v_thread.delivery_deadline_at is null
     or v_thread.delivery_deadline_at > now() then
    raise exception 'Todavía no puedes cancelar por incumplimiento.';
  end if;

  update public.chat_threads
  set lifecycle_state = 'CANCELADO',
      failure_reason = 'Incumplimiento de plazo',
      released_at = now(),
      updated_at = now()
  where id = p_chat_id;

  perform public.app_lifecycle_system_message(
    p_chat_id,
    'Cancelaste la compra por incumplimiento del plazo. Ya puedes elegir otro vendedor.'
  );

  return true;
end;
$$;

drop function if exists public.app_confirm_lifecycle_delivery(uuid);
create or replace function public.app_confirm_lifecycle_delivery(p_chat_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_thread public.chat_threads%rowtype;
  v_buyer_id uuid := public.app_lifecycle_current_buyer_id();
  v_on_time boolean;
begin
  if v_buyer_id is null then
    raise exception 'No hay una sesión de comprador activa.';
  end if;

  select * into v_thread from public.chat_threads ct where ct.id = p_chat_id;
  if not found or v_thread.buyer_id is distinct from v_buyer_id then
    raise exception 'Esta compra no es tuya.';
  end if;

  if v_thread.lifecycle_state <> 'EN_ENTREGA' then
    raise exception 'No hay una entrega en curso.';
  end if;

  v_on_time := v_thread.delivery_deadline_at is null or now() <= v_thread.delivery_deadline_at;

  update public.chat_threads
  set lifecycle_state = 'ENTREGA_CONFIRMADA',
      delivery_confirmed_at = now(),
      delivered_on_time = v_on_time,
      updated_at = now()
  where id = p_chat_id;

  perform public.app_lifecycle_system_message(
    p_chat_id,
    'El comprador confirmó que llegó el pedido.'
      || case when v_on_time then ' Llegó dentro del plazo.' else ' Llegó fuera del plazo.' end
  );

  return v_on_time;
end;
$$;

drop function if exists public.app_report_missing_delivery(uuid, text);
create or replace function public.app_report_missing_delivery(p_chat_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_thread public.chat_threads%rowtype;
  v_buyer_id uuid := public.app_lifecycle_current_buyer_id();
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_buyer_id is null then
    raise exception 'No hay una sesión de comprador activa.';
  end if;

  if v_reason not in (
    'No llegó', 'Llegó incompleto', 'Llegó dañado',
    'La empresa no respondió', 'Otro'
  ) then
    raise exception 'Selecciona un motivo válido.';
  end if;

  select * into v_thread from public.chat_threads ct where ct.id = p_chat_id;
  if not found or v_thread.buyer_id is distinct from v_buyer_id then
    raise exception 'Esta compra no es tuya.';
  end if;

  if v_thread.lifecycle_state not in ('EN_ENTREGA', 'ENTREGA_CONFIRMADA') then
    raise exception 'No hay una entrega que reportar.';
  end if;

  update public.chat_threads
  set lifecycle_state = 'NO_ENTREGADO',
      failure_reason = v_reason,
      delivered_on_time = false,
      updated_at = now()
  where id = p_chat_id;

  perform public.app_lifecycle_system_message(
    p_chat_id,
    'El comprador reportó un problema con la entrega: ' || v_reason || '.'
  );

  return true;
end;
$$;

drop function if exists public.app_rate_lifecycle_delivery(uuid, integer, boolean, text);
create or replace function public.app_rate_lifecycle_delivery(
  p_chat_id uuid,
  p_rating integer,
  p_arrived_on_time boolean,
  p_comment text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_thread public.chat_threads%rowtype;
  v_buyer_id uuid := public.app_lifecycle_current_buyer_id();
  v_buyer_profile_id uuid;
  v_review_body text;
begin
  if v_buyer_id is null then
    raise exception 'No hay una sesión de comprador activa.';
  end if;

  if p_rating is null or not (p_rating between 1 and 5) then
    raise exception 'La calificación debe ser de 1 a 5 estrellas.';
  end if;

  select * into v_thread from public.chat_threads ct where ct.id = p_chat_id;
  if not found or v_thread.buyer_id is distinct from v_buyer_id then
    raise exception 'Esta compra no es tuya.';
  end if;

  if v_thread.lifecycle_state not in ('ENTREGA_CONFIRMADA', 'NO_ENTREGADO') then
    raise exception 'Primero confirma o reporta la entrega.';
  end if;

  v_buyer_profile_id := v_thread.buyer_id;
  v_review_body := concat(
    coalesce(nullif(btrim(coalesce(p_comment, '')), ''), 'Sin comentario'),
    E'\n¿Llegó a tiempo? ',
    case when coalesce(p_arrived_on_time, false) then 'Sí' else 'No' end
  );

  update public.chat_threads
  set lifecycle_state = 'CALIFICADO',
      rating = p_rating,
      arrival_on_time = coalesce(p_arrived_on_time, false),
      review_comment = nullif(btrim(coalesce(p_comment, '')), ''),
      reviewed_at = now(),
      updated_at = now()
  where id = p_chat_id;

  -- El cierre clásico (/closing/:id) sigue insertando en commerce_reviews.
  -- Aquí solo se crea la reseña si todavía no existe para este pedido, para no
  -- duplicar la calificación cuando-el usuario use ambas vías.
  if v_thread.order_id is not null
     and v_thread.commerce_id is not null
     and not exists (
       select 1 from public.commerce_reviews cr where cr.order_id = v_thread.order_id
     ) then
    insert into public.commerce_reviews (
      order_id, buyer_id, commerce_id, rating, comment, status
    )
    values (
      v_thread.order_id, v_buyer_profile_id, v_thread.commerce_id,
      p_rating, left(v_review_body, 2000), 'pending'
    );
  end if;

  perform public.app_lifecycle_system_message(
    p_chat_id,
    'Calificación enviada: ' || p_rating || ' de 5. Gracias por tu opinión.'
  );

  return true;
end;
$$;

drop function if exists public.app_release_for_other_seller(uuid);
create or replace function public.app_release_for_other_seller(p_chat_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_thread public.chat_threads%rowtype;
  v_buyer_id uuid := public.app_lifecycle_current_buyer_id();
begin
  if v_buyer_id is null then
    raise exception 'No hay una sesión de comprador activa.';
  end if;

  select * into v_thread from public.chat_threads ct where ct.id = p_chat_id;
  if not found or v_thread.buyer_id is distinct from v_buyer_id then
    raise exception 'Esta compra no es tuya.';
  end if;

  update public.chat_threads
  set lifecycle_state = 'CANCELADO',
      released_at = now(),
      updated_at = now()
  where id = p_chat_id;

  perform public.app_lifecycle_system_message(
    p_chat_id,
    'Solicitud liberada. Puedes elegir otro vendedor sin repetir tus datos.'
  );

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Reputación calculada para el ordenamiento de ofertas
-- -----------------------------------------------------------------------------
drop function if exists public.app_commerce_reputation(uuid[]);
create or replace function public.app_commerce_reputation(p_commerce_ids uuid[])
returns table (
  commerce_id uuid,
  response_on_time_rate numeric,
  delivery_on_time_rate numeric,
  completed_count integer,
  average_rating numeric
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select c.id,
    (
      select avg(case when ct.responded_on_time then 1::numeric else 0::numeric end)
      from public.chat_threads ct
      where ct.commerce_id = c.id and ct.responded_on_time is not null
    ) as response_on_time_rate,
    (
      select avg(case when ct.delivered_on_time then 1::numeric else 0::numeric end)
      from public.chat_threads ct
      where ct.commerce_id = c.id and ct.delivered_on_time is not null
    ) as delivery_on_time_rate,
    (
      select count(*)::integer
      from public.chat_threads ct
      where ct.commerce_id = c.id and ct.rating is not null
    ) as completed_count,
    (
      select avg(cr.rating::numeric)
      from public.commerce_reviews cr
      where cr.commerce_id = c.id and cr.status = 'published'
    ) as average_rating
  from public.commerce_profiles c
  where c.id = any (coalesce(p_commerce_ids, '{}'::uuid[]));
$$;

-- -----------------------------------------------------------------------------
-- 6. Permisos
-- -----------------------------------------------------------------------------
revoke all on function public.app_lifecycle_current_buyer_id() from public;
revoke all on function public.app_lifecycle_current_commerce_id() from public;
revoke all on function public.app_lifecycle_can_access_chat(uuid) from public;
revoke all on function public.app_lifecycle_system_message(uuid, text) from public;
revoke all on function public.app_expire_offer_lifecycles() from public;
revoke all on function public.app_block_booked_offer_insert() from public;
revoke all on function public.app_select_offer_for_lifecycle(uuid, text) from public;
revoke all on function public.app_accept_offer_request(uuid) from public;
revoke all on function public.app_cancel_offer_negotiation(uuid) from public;
revoke all on function public.app_agree_delivery(uuid, numeric, text) from public;
revoke all on function public.app_report_delivery_delay(uuid, text, numeric) from public;
revoke all on function public.app_keep_waiting_for_delivery(uuid) from public;
revoke all on function public.app_cancel_for_breach(uuid) from public;
revoke all on function public.app_confirm_lifecycle_delivery(uuid) from public;
revoke all on function public.app_report_missing_delivery(uuid, text) from public;
revoke all on function public.app_rate_lifecycle_delivery(uuid, integer, boolean, text) from public;
revoke all on function public.app_release_for_other_seller(uuid) from public;
revoke all on function public.app_commerce_reputation(uuid[]) from public;

grant execute on function public.app_lifecycle_current_buyer_id() to authenticated;
grant execute on function public.app_lifecycle_current_commerce_id() to authenticated;
grant execute on function public.app_lifecycle_can_access_chat(uuid) to authenticated;
grant execute on function public.app_lifecycle_system_message(uuid, text) to authenticated;
grant execute on function public.app_expire_offer_lifecycles() to authenticated;
grant execute on function public.app_select_offer_for_lifecycle(uuid, text) to authenticated;
grant execute on function public.app_accept_offer_request(uuid) to authenticated;
grant execute on function public.app_cancel_offer_negotiation(uuid) to authenticated;
grant execute on function public.app_agree_delivery(uuid, numeric, text) to authenticated;
grant execute on function public.app_report_delivery_delay(uuid, text, numeric) to authenticated;
grant execute on function public.app_keep_waiting_for_delivery(uuid) to authenticated;
grant execute on function public.app_cancel_for_breach(uuid) to authenticated;
grant execute on function public.app_confirm_lifecycle_delivery(uuid) to authenticated;
grant execute on function public.app_report_missing_delivery(uuid, text) to authenticated;
grant execute on function public.app_rate_lifecycle_delivery(uuid, integer, boolean, text) to authenticated;
grant execute on function public.app_release_for_other_seller(uuid) to authenticated;
grant execute on function public.app_commerce_reputation(uuid[]) to authenticated;
