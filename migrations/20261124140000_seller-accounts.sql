-- Cuentas de vendedores afiliados.
--
-- La tabla commerce_members es la fuente de verdad de la relación entre un
-- usuario de auth y un comercio. Los dueños existentes se siembran como
-- role='owner' para que las mismas reglas RLS cubran a propietarios y
-- vendedores. Las columnas de atribución se agregan de forma aditiva y se
-- rellenan con triggers BEFORE INSERT/UPDATE; ningún RPC existente se
-- reescribe para conservar los flujos de oferta, entrega y reputación.

-- -----------------------------------------------------------------------------
-- Esquema
-- -----------------------------------------------------------------------------
create table if not exists public.commerce_members (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_url text,
  role text not null default 'seller',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.commerce_members'::regclass
      and conname = 'commerce_members_user_id_key'
  ) then
    alter table public.commerce_members add constraint commerce_members_user_id_key unique (user_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.commerce_members'::regclass
      and conname = 'commerce_members_role_check'
  ) then
    alter table public.commerce_members add constraint commerce_members_role_check
      check (role in ('owner', 'seller'));
  end if;
end $$;

alter table public.purchase_offers
  add column if not exists created_by_user_id uuid;

alter table public.chat_threads
  add column if not exists assigned_seller_id uuid,
  add column if not exists assigned_seller_name text,
  add column if not exists assigned_seller_avatar text;

alter table public.purchase_orders
  add column if not exists sold_by_user_id uuid,
  add column if not exists sold_by_name text;

create index if not exists commerce_members_commerce_id_idx
  on public.commerce_members (commerce_id);
create index if not exists purchase_offers_created_by_user_id_idx
  on public.purchase_offers (created_by_user_id);
create index if not exists chat_threads_assigned_seller_id_idx
  on public.chat_threads (assigned_seller_id);
create index if not exists purchase_orders_sold_by_user_id_idx
  on public.purchase_orders (sold_by_user_id);

-- -----------------------------------------------------------------------------
-- Helpers RLS (SECURITY DEFINER para evitar recursión entre tablas)
-- -----------------------------------------------------------------------------
create or replace function public.app_can_manage_commerce_members()
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
  );
$$;

create or replace function public.app_my_seller_membership()
returns table (
  id uuid,
  commerce_id uuid,
  user_id uuid,
  full_name text,
  email text,
  avatar_url text,
  role text,
  is_active boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select m.id, m.commerce_id, m.user_id, m.full_name, m.email,
         m.avatar_url, m.role, m.is_active
  from public.commerce_members m
  where m.user_id = auth.uid()
  order by case when m.role = 'owner' then 0 else 1 end, m.created_at
  limit 1;
$$;

create or replace function public.app_my_commerce()
returns table (
  id uuid,
  trade_name text,
  status text,
  vehicle_types text[],
  inventory_systems text[],
  max_response_minutes integer,
  owner_user_id uuid
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with candidates as (
    select cp.id, cp.trade_name, cp.status, cp.vehicle_types,
           cp.inventory_systems, cp.max_response_minutes, cp.owner_user_id, 0 as priority
    from public.commerce_profiles cp
    where cp.owner_user_id = auth.uid()
    union all
    select cp.id, cp.trade_name, cp.status, cp.vehicle_types,
           cp.inventory_systems, cp.max_response_minutes, cp.owner_user_id, 1 as priority
    from public.commerce_members m
    join public.commerce_profiles cp on cp.id = m.commerce_id
    where m.user_id = auth.uid()
      and m.is_active
  )
  select id, trade_name, status, vehicle_types, inventory_systems,
         max_response_minutes, owner_user_id
  from candidates
  order by priority
  limit 1;
$$;

create or replace function public.app_commerce_team()
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  avatar_url text,
  role text,
  is_active boolean,
  created_at timestamptz,
  offers_sent integer,
  sales_closed integer,
  sales_amount numeric,
  rating numeric
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with owned as (
    select cp.id
    from public.commerce_profiles cp
    where cp.owner_user_id = auth.uid()
    order by cp.created_at
    limit 1
  )
  select m.id, m.user_id, m.full_name, m.email, m.avatar_url, m.role,
         m.is_active, m.created_at,
         (
           select count(*)::integer
           from public.purchase_offers po
           where po.commerce_id = (select id from owned)
             and po.created_by_user_id = m.user_id
         ) as offers_sent,
         (
           select count(*)::integer
           from public.purchase_orders o
           where o.commerce_id = (select id from owned)
             and o.sold_by_user_id = m.user_id
         ) as sales_closed,
         coalesce((
           select sum(o.total_amount)
           from public.purchase_orders o
           where o.commerce_id = (select id from owned)
             and o.sold_by_user_id = m.user_id
         ), 0) as sales_amount,
         (
           select avg(ct.rating::numeric)
           from public.chat_threads ct
           where ct.commerce_id = (select id from owned)
             and ct.assigned_seller_id = m.user_id
             and ct.rating is not null
         ) as rating
  from public.commerce_members m, owned
  where m.commerce_id = owned.id
  order by case when m.role = 'owner' then 0 else 1 end, m.created_at;
$$;

-- -----------------------------------------------------------------------------
-- Extensión de helpers existentes: un miembro activo opera como el comercio.
-- Se mantienen las firmas y los permisos originales.
-- -----------------------------------------------------------------------------
create or replace function public.app_is_commerce(p_commerce_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p_commerce_id is not null
    and (
      exists (
        select 1
        from public.commerce_profiles cp
        where cp.id = p_commerce_id
          and cp.owner_user_id = auth.uid()
      )
      or exists (
        select 1
        from public.commerce_members m
        where m.commerce_id = p_commerce_id
          and m.user_id = auth.uid()
          and m.is_active
      )
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
  ) or exists (
    select 1
    from public.commerce_members m
    join public.commerce_profiles cp on cp.id = m.commerce_id
    where m.user_id = auth.uid()
      and m.is_active
      and cp.status = 'approved'
  );
$$;

create or replace function public.app_can_offer_on_request(p_request_id uuid, p_commerce_id uuid)
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
      and cp.status = 'approved'
      and (
        cp.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.commerce_members m
          where m.commerce_id = cp.id
            and m.user_id = auth.uid()
            and m.is_active
        )
      )
      and public.app_commerce_matches_request(cp.id, r.id)
  );
$$;

create or replace function public.app_approved_commerce_matches_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.commerce_profiles cp
    where (
        cp.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.commerce_members m
          where m.commerce_id = cp.id
            and m.user_id = auth.uid()
            and m.is_active
        )
      )
      and cp.status = 'approved'
      and public.app_commerce_matches_request(cp.id, p_request_id)
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
      and (
        cp.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.commerce_members m
          where m.commerce_id = cp.id
            and m.user_id = auth.uid()
            and m.is_active
        )
      )
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
    where ct.id = p_chat_id and bp.user_id = auth.uid()
  )
  or public.app_is_commerce((
    select ct.commerce_id
    from public.chat_threads ct
    where ct.id = p_chat_id
  ))
  or exists (
    select 1
    from public.chat_threads ct
    join public.workshop_profiles wp on wp.id = ct.workshop_id
    where ct.id = p_chat_id and wp.user_id = auth.uid()
  );
$$;

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
        or public.app_is_commerce(po.commerce_id)
      )
  );
$$;

create or replace function public.app_lifecycle_current_commerce_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with candidates as (
    select cp.id as commerce_id, 0 as priority
    from public.commerce_profiles cp
    where cp.owner_user_id = auth.uid()
    union all
    select m.commerce_id, 1 as priority
    from public.commerce_members m
    where m.user_id = auth.uid()
      and m.is_active
  )
  select commerce_id
  from candidates
  order by priority
  limit 1;
$$;

-- La foto del vendedor se guarda en commerce_members para que el comprador la
-- lea desde chat_threads sin depender del perfil privado de auth.users.
create or replace function public.app_set_avatar_url(p_avatar_url text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_user auth.users%rowtype;
  v_role text;
  v_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
  v_buyer_id uuid;
  v_commerce_id uuid;
  v_member_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa para guardar la foto.';
  end if;

  select * into v_user from auth.users where id = v_uid;
  if not found then
    raise exception 'La cuenta no existe.';
  end if;

  if v_url is not null and char_length(v_url) > 2048 then
    raise exception 'La URL de la foto es demasiado larga.';
  end if;

  v_role := case
    when coalesce(v_user.profile ->> 'role', 'user') = 'commerce' then 'commerce'
    when exists (select 1 from public.commerce_members m where m.user_id = v_uid) then 'seller'
    else 'user'
  end;

  if v_role = 'commerce' then
    update public.commerce_profiles
    set avatar_url = v_url,
        updated_at = now()
    where owner_user_id = v_uid
    returning id into v_commerce_id;
  elsif v_role = 'seller' then
    update public.commerce_members
    set avatar_url = v_url
    where user_id = v_uid
    returning id into v_member_id;
  else
    update public.buyer_profiles
    set avatar_url = v_url,
        updated_at = now()
    where user_id = v_uid
    returning id into v_buyer_id;
  end if;

  return jsonb_build_object(
    'role', v_role,
    'avatar_url', v_url,
    'buyer_id', v_buyer_id,
    'commerce_id', v_commerce_id,
    'member_id', v_member_id
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Atribución aditiva
-- -----------------------------------------------------------------------------
create or replace function public.app_apply_offer_seller_attribution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if NEW.commerce_id is not null and NEW.created_by_user_id is null and auth.uid() is not null then
    select m.user_id
    into NEW.created_by_user_id
    from public.commerce_members m
    where m.commerce_id = NEW.commerce_id
      and m.user_id = auth.uid()
      and m.is_active
    limit 1;

    if NEW.created_by_user_id is null
       and exists (
         select 1
         from public.commerce_profiles cp
         where cp.id = NEW.commerce_id and cp.owner_user_id = auth.uid()
       ) then
      NEW.created_by_user_id := auth.uid();
    end if;
  end if;

  return NEW;
end;
$$;

create or replace function public.app_apply_chat_seller_attribution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_user_id uuid;
  v_name text;
  v_avatar text;
begin
  if NEW.commerce_id is null then
    return NEW;
  end if;

  if NEW.offer_id is not null then
    select po.created_by_user_id
    into v_user_id
    from public.purchase_offers po
    where po.id = NEW.offer_id;
  end if;

  if v_user_id is null and auth.uid() is not null then
    select m.user_id
    into v_user_id
    from public.commerce_members m
    where m.commerce_id = NEW.commerce_id
      and m.user_id = auth.uid()
      and m.is_active
    limit 1;
  end if;

  if v_user_id is not null then
    select m.full_name, m.avatar_url
    into v_name, v_avatar
    from public.commerce_members m
    where m.commerce_id = NEW.commerce_id
      and m.user_id = v_user_id;

    NEW.assigned_seller_id := coalesce(NEW.assigned_seller_id, v_user_id);
    NEW.assigned_seller_name := coalesce(NEW.assigned_seller_name, v_name);
    NEW.assigned_seller_avatar := coalesce(NEW.assigned_seller_avatar, v_avatar);
  end if;

  return NEW;
end;
$$;

create or replace function public.app_apply_order_seller_attribution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_user_id uuid;
  v_name text;
begin
  if NEW.commerce_id is null then
    return NEW;
  end if;

  if NEW.offer_id is not null then
    select po.created_by_user_id
    into v_user_id
    from public.purchase_offers po
    where po.id = NEW.offer_id;
  end if;

  if v_user_id is null and auth.uid() is not null then
    select m.user_id
    into v_user_id
    from public.commerce_members m
    where m.commerce_id = NEW.commerce_id
      and m.user_id = auth.uid()
      and m.is_active
    limit 1;
  end if;

  if v_user_id is not null then
    select m.full_name
    into v_name
    from public.commerce_members m
    where m.commerce_id = NEW.commerce_id
      and m.user_id = v_user_id;

    NEW.sold_by_user_id := coalesce(NEW.sold_by_user_id, v_user_id);
    NEW.sold_by_name := coalesce(NEW.sold_by_name, v_name);
  end if;

  return NEW;
end;
$$;

drop trigger if exists app_offer_seller_attribution on public.purchase_offers;
create trigger app_offer_seller_attribution
  before insert on public.purchase_offers
  for each row execute function public.app_apply_offer_seller_attribution();

drop trigger if exists app_chat_seller_attribution on public.chat_threads;
create trigger app_chat_seller_attribution
  before insert or update of offer_id, commerce_id
  on public.chat_threads
  for each row execute function public.app_apply_chat_seller_attribution();

drop trigger if exists app_order_seller_attribution on public.purchase_orders;
create trigger app_order_seller_attribution
  before insert on public.purchase_orders
  for each row execute function public.app_apply_order_seller_attribution();

-- -----------------------------------------------------------------------------
-- Seguridad y permisos
-- -----------------------------------------------------------------------------
alter table public.commerce_members enable row level security;

drop policy if exists commerce_members_select on public.commerce_members;
create policy commerce_members_select on public.commerce_members
  for select to authenticated
  using (
    public.app_can_manage_commerce_members()
    or user_id = auth.uid()
  );

revoke all on public.commerce_members from anon;
revoke insert, update, delete on public.commerce_members from authenticated;
grant select on public.commerce_members to authenticated;

revoke all on function public.app_can_manage_commerce_members() from public;
revoke all on function public.app_my_seller_membership() from public;
revoke all on function public.app_my_commerce() from public;
revoke all on function public.app_commerce_team() from public;
revoke all on function public.app_apply_offer_seller_attribution() from public;
revoke all on function public.app_apply_chat_seller_attribution() from public;
revoke all on function public.app_apply_order_seller_attribution() from public;

grant execute on function public.app_can_manage_commerce_members() to authenticated;
grant execute on function public.app_my_seller_membership() to authenticated;
grant execute on function public.app_my_commerce() to authenticated;
grant execute on function public.app_commerce_team() to authenticated;

-- Los dueños ya existentes pasan a ser miembros owner. El repo de usuarios se
-- siembra desde la tabla de comercios; ON CONFLICT evita duplicados.
insert into public.commerce_members (
  commerce_id, user_id, full_name, email, avatar_url, role, is_active
)
select cp.id,
       cp.owner_user_id,
       coalesce(
         nullif(btrim(coalesce(u.profile ->> 'name', '')), ''),
         nullif(btrim(coalesce(cp.trade_name, '')), ''),
         split_part(coalesce(cp.email, 'comercio'), '@', 1)
       ),
       coalesce(cp.email, ''),
       cp.avatar_url,
       'owner',
       true
from public.commerce_profiles cp
join auth.users u on u.id = cp.owner_user_id
on conflict (user_id) do nothing;
