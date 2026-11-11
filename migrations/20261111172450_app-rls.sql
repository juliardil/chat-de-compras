-- =============================================================================
-- Chat de Compras · Acceso de compradores y comercios (RLS)
--
-- Habilita el acceso real de los usuarios autenticados a sus propios datos:
--   * compradores: perfil, solicitudes, ofertas recibidas, pedidos, chats,
--     mensajes y reseñas;
--   * comercios: perfil, solicitudes abiertas, ofertas, pedidos, chats,
--     mensajes y reseñas.
--
-- Reglas:
--   * Los helpers de pertenencia son SECURITY DEFINER para evitar recursión de
--     políticas y para que una política pueda comprobar otra tabla sin exponer
--     filas ajenas.
--   * Las escrituras directas se limitan a las filas propias. Los perfiles se
--     provisionan con app_ensure_profile(), no con INSERT directo, para que el
--     estado (pending/active) no pueda ser manipulado por el cliente.
--   * No se concede DELETE: las bajas se gestionan desde administración.
--   * Este archivo no contiene datos de ejemplo ni secretos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers de identidad y pertenencia
-- -----------------------------------------------------------------------------
create or replace function public.app_is_buyer(p_buyer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p_buyer_id is not null
    and exists (
      select 1
      from public.buyer_profiles bp
      where bp.id = p_buyer_id
        and bp.user_id = auth.uid()
    );
$$;

create or replace function public.app_is_commerce(p_commerce_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p_commerce_id is not null
    and exists (
      select 1
      from public.commerce_profiles cp
      where cp.id = p_commerce_id
        and cp.owner_user_id = auth.uid()
    );
$$;

create or replace function public.app_is_approved_commerce()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.commerce_profiles cp
    where cp.owner_user_id = auth.uid()
      and cp.status = 'approved'
  );
$$;

create or replace function public.app_is_buyer_of_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.purchase_requests r
    join public.buyer_profiles bp on bp.id = r.buyer_id
    where r.id = p_request_id
      and bp.user_id = auth.uid()
  );
$$;

create or replace function public.app_commerce_has_offer_on_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.purchase_offers o
    join public.commerce_profiles cp on cp.id = o.commerce_id
    where o.request_id = p_request_id
      and cp.owner_user_id = auth.uid()
  );
$$;

create or replace function public.app_can_offer_on_request(
  p_request_id uuid,
  p_commerce_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.purchase_requests r
    join public.commerce_profiles cp on cp.id = p_commerce_id
    where r.id = p_request_id
      and r.status = 'open'
      and cp.owner_user_id = auth.uid()
      and cp.status = 'approved'
  );
$$;

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
    where ct.id = p_chat_id
      and bp.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.chat_threads ct
    join public.commerce_profiles cp on cp.id = ct.commerce_id
    where ct.id = p_chat_id
      and cp.owner_user_id = auth.uid()
  );
$$;

create or replace function public.app_can_review_order(
  p_order_id uuid,
  p_buyer_id uuid,
  p_commerce_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.purchase_orders o
    where o.id = p_order_id
      and o.buyer_id = p_buyer_id
      and (p_commerce_id is null or o.commerce_id = p_commerce_id)
  );
$$;

-- Provisiona el perfil de negocio del usuario autenticado a partir de
-- auth.users.profile. Es idempotente: se llama al iniciar sesión, al confirmar
-- el registro y al guardar el perfil. No permite fijar estados ni aprobar
-- comercios: eso sigue siendo exclusivo de administración.
create or replace function public.app_ensure_profile()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_user auth.users%rowtype;
  v_role text;
  v_name text;
  v_email text;
  v_phone text;
  v_business jsonb;
  v_buyer public.buyer_profiles%rowtype;
  v_commerce public.commerce_profiles%rowtype;
begin
  if v_uid is null then
    return null;
  end if;

  select * into v_user from auth.users where id = v_uid;
  if not found then
    return null;
  end if;

  v_business := case
    when jsonb_typeof(v_user.profile -> 'business') = 'object'
      then v_user.profile -> 'business'
    else '{}'::jsonb
  end;
  v_role := case
    when coalesce(v_user.profile ->> 'role', 'user') = 'commerce' then 'commerce'
    else 'user'
  end;
  v_name := nullif(trim(coalesce(v_user.profile ->> 'name', '')), '');
  v_email := nullif(trim(coalesce(v_user.email, '')), '');
  v_phone := nullif(trim(coalesce(v_user.profile ->> 'phone', v_business ->> 'phone', '')), '');

  if v_role = 'commerce' then
    select * into v_commerce
    from public.commerce_profiles cp
    where cp.owner_user_id = v_uid
    order by cp.created_at
    limit 1;

    if not found then
      insert into public.commerce_profiles (
        owner_user_id, trade_name, legal_name, email, phone, address, city, status
      )
      values (
        v_uid,
        coalesce(
          v_name,
          nullif(trim(coalesce(v_business ->> 'tradeName', '')), ''),
          split_part(coalesce(v_email, 'comercio'), '@', 1)
        ),
        coalesce(
          nullif(trim(coalesce(v_business ->> 'legalName', '')), ''),
          v_name,
          split_part(coalesce(v_email, 'comercio'), '@', 1)
        ),
        v_email,
        v_phone,
        nullif(trim(coalesce(v_business ->> 'address', '')), ''),
        nullif(trim(coalesce(v_business ->> 'city', '')), ''),
        'pending'
      )
      returning * into v_commerce;
    else
      update public.commerce_profiles
      set email = coalesce(v_email, email),
          phone = coalesce(v_phone, phone),
          address = coalesce(nullif(trim(coalesce(v_business ->> 'address', '')), ''), address),
          city = coalesce(nullif(trim(coalesce(v_business ->> 'city', '')), ''), city),
          updated_at = now()
      where id = v_commerce.id
      returning * into v_commerce;
    end if;

    return jsonb_build_object(
      'id', v_commerce.id,
      'role', 'commerce',
      'name', v_commerce.trade_name,
      'status', v_commerce.status
    );
  end if;

  insert into public.buyer_profiles (user_id, display_name, email, phone, status)
  values (
    v_uid,
    coalesce(v_name, split_part(coalesce(v_email, 'comprador'), '@', 1)),
    v_email,
    v_phone,
    'active'
  )
  on conflict (user_id) do nothing
  returning * into v_buyer;

  if v_buyer.id is null then
    select * into v_buyer
    from public.buyer_profiles bp
    where bp.user_id = v_uid;

    update public.buyer_profiles
    set display_name = coalesce(v_name, display_name),
        email = coalesce(v_email, email),
        phone = coalesce(v_phone, phone),
        updated_at = now()
    where id = v_buyer.id
    returning * into v_buyer;
  end if;

  return jsonb_build_object(
    'id', v_buyer.id,
    'role', 'user',
    'name', v_buyer.display_name,
    'status', v_buyer.status
  );
end;
$$;

revoke all on function public.app_is_buyer(uuid) from public;
revoke all on function public.app_is_commerce(uuid) from public;
revoke all on function public.app_is_approved_commerce() from public;
revoke all on function public.app_is_buyer_of_request(uuid) from public;
revoke all on function public.app_commerce_has_offer_on_request(uuid) from public;
revoke all on function public.app_can_offer_on_request(uuid, uuid) from public;
revoke all on function public.app_can_access_chat(uuid) from public;
revoke all on function public.app_can_review_order(uuid, uuid, uuid) from public;
revoke all on function public.app_ensure_profile() from public;

grant execute on function public.app_is_buyer(uuid) to authenticated;
grant execute on function public.app_is_commerce(uuid) to authenticated;
grant execute on function public.app_is_approved_commerce() to authenticated;
grant execute on function public.app_is_buyer_of_request(uuid) to authenticated;
grant execute on function public.app_commerce_has_offer_on_request(uuid) to authenticated;
grant execute on function public.app_can_offer_on_request(uuid, uuid) to authenticated;
grant execute on function public.app_can_access_chat(uuid) to authenticated;
grant execute on function public.app_can_review_order(uuid, uuid, uuid) to authenticated;
grant execute on function public.app_ensure_profile() to authenticated;

-- -----------------------------------------------------------------------------
-- Índices usados por las políticas y las consultas de la app
-- -----------------------------------------------------------------------------
create index if not exists commerce_profiles_owner_user_idx
  on public.commerce_profiles (owner_user_id);
create index if not exists chat_threads_buyer_idx
  on public.chat_threads (buyer_id);
create index if not exists chat_threads_commerce_idx
  on public.chat_threads (commerce_id);
create index if not exists commerce_reviews_buyer_idx
  on public.commerce_reviews (buyer_id);
create index if not exists purchase_offers_request_commerce_idx
  on public.purchase_offers (request_id, commerce_id);

-- -----------------------------------------------------------------------------
-- Privilegios para el rol authenticated
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select on public.buyer_profiles to authenticated;
grant select on public.commerce_profiles to authenticated;
grant select on public.commerce_categories to authenticated;

grant select, insert, update on public.purchase_requests to authenticated;
grant select, insert, update on public.purchase_offers to authenticated;
grant select, insert, update on public.purchase_orders to authenticated;
grant select, insert, update on public.chat_threads to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert on public.commerce_reviews to authenticated;

-- -----------------------------------------------------------------------------
-- Políticas RLS
-- -----------------------------------------------------------------------------
alter table public.buyer_profiles enable row level security;
alter table public.commerce_profiles enable row level security;
alter table public.commerce_categories enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.purchase_offers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.commerce_reviews enable row level security;

-- Perfiles ------------------------------------------------------------------
drop policy if exists buyer_profiles_self_read on public.buyer_profiles;
create policy buyer_profiles_self_read on public.buyer_profiles
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists commerce_profiles_self_or_public_read on public.commerce_profiles;
create policy commerce_profiles_self_or_public_read on public.commerce_profiles
  for select to authenticated
  using (owner_user_id = auth.uid() or status = 'approved');

drop policy if exists commerce_categories_active_read on public.commerce_categories;
create policy commerce_categories_active_read on public.commerce_categories
  for select to authenticated
  using (status = 'active');

-- Solicitudes ---------------------------------------------------------------
drop policy if exists purchase_requests_read on public.purchase_requests;
create policy purchase_requests_read on public.purchase_requests
  for select to authenticated
  using (
    public.app_is_buyer(buyer_id)
    or (status = 'open' and public.app_is_approved_commerce())
    or public.app_commerce_has_offer_on_request(id)
  );

drop policy if exists purchase_requests_insert on public.purchase_requests;
create policy purchase_requests_insert on public.purchase_requests
  for insert to authenticated
  with check (
    public.app_is_buyer(buyer_id)
    and status in ('open', 'hidden')
  );

drop policy if exists purchase_requests_update on public.purchase_requests;
create policy purchase_requests_update on public.purchase_requests
  for update to authenticated
  using (public.app_is_buyer(buyer_id))
  with check (public.app_is_buyer(buyer_id));

-- Ofertas -------------------------------------------------------------------
drop policy if exists purchase_offers_read on public.purchase_offers;
create policy purchase_offers_read on public.purchase_offers
  for select to authenticated
  using (
    public.app_is_buyer_of_request(request_id)
    or public.app_is_commerce(commerce_id)
  );

drop policy if exists purchase_offers_insert on public.purchase_offers;
create policy purchase_offers_insert on public.purchase_offers
  for insert to authenticated
  with check (public.app_can_offer_on_request(request_id, commerce_id));

drop policy if exists purchase_offers_update on public.purchase_offers;
create policy purchase_offers_update on public.purchase_offers
  for update to authenticated
  using (public.app_is_commerce(commerce_id))
  with check (public.app_is_commerce(commerce_id));

-- Pedidos -------------------------------------------------------------------
drop policy if exists purchase_orders_read on public.purchase_orders;
create policy purchase_orders_read on public.purchase_orders
  for select to authenticated
  using (
    public.app_is_buyer(buyer_id)
    or public.app_is_commerce(commerce_id)
  );

drop policy if exists purchase_orders_insert on public.purchase_orders;
create policy purchase_orders_insert on public.purchase_orders
  for insert to authenticated
  with check (
    public.app_is_buyer(buyer_id)
    and status = 'pending'
  );

drop policy if exists purchase_orders_update on public.purchase_orders;
create policy purchase_orders_update on public.purchase_orders
  for update to authenticated
  using (
    public.app_is_buyer(buyer_id)
    or public.app_is_commerce(commerce_id)
  )
  with check (
    public.app_is_buyer(buyer_id)
    or public.app_is_commerce(commerce_id)
  );

-- Chats ---------------------------------------------------------------------
drop policy if exists chat_threads_read on public.chat_threads;
create policy chat_threads_read on public.chat_threads
  for select to authenticated
  using (
    public.app_is_buyer(buyer_id)
    or public.app_is_commerce(commerce_id)
  );

drop policy if exists chat_threads_insert on public.chat_threads;
create policy chat_threads_insert on public.chat_threads
  for insert to authenticated
  with check (
    (buyer_id is not null or commerce_id is not null)
    and (
      public.app_is_buyer(buyer_id)
      or public.app_is_commerce(commerce_id)
    )
  );

drop policy if exists chat_threads_update on public.chat_threads;
create policy chat_threads_update on public.chat_threads
  for update to authenticated
  using (
    public.app_is_buyer(buyer_id)
    or public.app_is_commerce(commerce_id)
  )
  with check (
    public.app_is_buyer(buyer_id)
    or public.app_is_commerce(commerce_id)
  );

drop policy if exists chat_messages_read on public.chat_messages;
create policy chat_messages_read on public.chat_messages
  for select to authenticated
  using (public.app_can_access_chat(chat_id));

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (public.app_can_access_chat(chat_id));

-- Reseñas -------------------------------------------------------------------
drop policy if exists commerce_reviews_read on public.commerce_reviews;
create policy commerce_reviews_read on public.commerce_reviews
  for select to authenticated
  using (
    public.app_is_buyer(buyer_id)
    or public.app_is_commerce(commerce_id)
    or status = 'published'
  );

drop policy if exists commerce_reviews_insert on public.commerce_reviews;
create policy commerce_reviews_insert on public.commerce_reviews
  for insert to authenticated
  with check (
    public.app_is_buyer(buyer_id)
    and status = 'pending'
    and order_id is not null
    and public.app_can_review_order(order_id, buyer_id, commerce_id)
  );

-- -----------------------------------------------------------------------------
-- Backfill de perfiles para las cuentas que ya existen
-- (usuarios creados antes de habilitar app_ensure_profile)
-- -----------------------------------------------------------------------------
insert into public.buyer_profiles (user_id, display_name, email, status)
select
  u.id,
  coalesce(nullif(trim(u.profile ->> 'name'), ''), split_part(coalesce(u.email, 'comprador'), '@', 1)),
  nullif(trim(u.email), ''),
  'active'
from auth.users u
where coalesce(u.profile ->> 'role', 'user') <> 'commerce'
on conflict (user_id) do nothing;

insert into public.commerce_profiles (
  owner_user_id, trade_name, legal_name, email, phone, address, city, status
)
select
  u.id,
  coalesce(
    nullif(trim(u.profile -> 'business' ->> 'tradeName'), ''),
    nullif(trim(u.profile ->> 'name'), ''),
    split_part(coalesce(u.email, 'comercio'), '@', 1)
  ),
  coalesce(
    nullif(trim(u.profile -> 'business' ->> 'legalName'), ''),
    nullif(trim(u.profile ->> 'name'), ''),
    split_part(coalesce(u.email, 'comercio'), '@', 1)
  ),
  nullif(trim(u.email), ''),
  nullif(trim(coalesce(u.profile -> 'business' ->> 'phone', u.profile ->> 'phone')), ''),
  nullif(trim(u.profile -> 'business' ->> 'address'), ''),
  nullif(trim(u.profile -> 'business' ->> 'city'), ''),
  'pending'
from auth.users u
where coalesce(u.profile ->> 'role', '') = 'commerce'
  and not exists (
    select 1
    from public.commerce_profiles cp
    where cp.owner_user_id = u.id
  );

notify pgrst, 'reload schema';
