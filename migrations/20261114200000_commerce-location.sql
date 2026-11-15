-- -----------------------------------------------------------------------------
-- Ubicación geográfica de los comercios
-- Las ofertas recibidas muestran la distancia real (km) entre el comprador y
-- el comercio. Solo se guardan coordenadas reales capturadas desde el
-- navegador del comercio; si no existen, la app no inventa una distancia.
-- -----------------------------------------------------------------------------
alter table public.commerce_profiles
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.commerce_profiles
  drop constraint if exists commerce_profiles_latitude_range;
alter table public.commerce_profiles
  add constraint commerce_profiles_latitude_range
  check (latitude is null or (latitude between -90 and 90));

alter table public.commerce_profiles
  drop constraint if exists commerce_profiles_longitude_range;
alter table public.commerce_profiles
  add constraint commerce_profiles_longitude_range
  check (longitude is null or (longitude between -180 and 180));

-- -----------------------------------------------------------------------------
-- app_ensure_profile: además de los datos del negocio, sincroniza las
-- coordenadas guardadas en auth.users.profile.business (latitude/longitude)
-- hacia commerce_profiles. Se validan antes de convertir para no romper el
-- inicio de sesión si el perfil trae un valor no numérico.
-- -----------------------------------------------------------------------------
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
  v_latitude double precision;
  v_longitude double precision;
  v_vehicle_types text[] := '{}'::text[];
  v_inventory_systems text[] := '{}'::text[];
  v_sync_vehicle_types boolean := false;
  v_sync_inventory_systems boolean := false;
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

  v_latitude := case
    when (v_business ->> 'latitude') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (v_business ->> 'latitude')::double precision
    else null
  end;
  v_longitude := case
    when (v_business ->> 'longitude') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (v_business ->> 'longitude')::double precision
    else null
  end;

  v_sync_vehicle_types :=
    coalesce(jsonb_typeof(v_business -> 'vehicleTypes') = 'array', false)
    or coalesce(jsonb_typeof(v_business -> 'vehicle_types') = 'array', false);
  v_sync_inventory_systems :=
    coalesce(jsonb_typeof(v_business -> 'inventorySystems') = 'array', false)
    or coalesce(jsonb_typeof(v_business -> 'inventory_systems') = 'array', false);

  if jsonb_typeof(v_business -> 'vehicleTypes') = 'array' then
    select coalesce(array_agg(distinct trim(value) order by trim(value)), '{}'::text[])
      into v_vehicle_types
      from jsonb_array_elements_text(v_business -> 'vehicleTypes') as entry(value)
      where trim(value) <> '';
  elsif jsonb_typeof(v_business -> 'vehicle_types') = 'array' then
    select coalesce(array_agg(distinct trim(value) order by trim(value)), '{}'::text[])
      into v_vehicle_types
      from jsonb_array_elements_text(v_business -> 'vehicle_types') as entry(value)
      where trim(value) <> '';
  end if;

  if jsonb_typeof(v_business -> 'inventorySystems') = 'array' then
    select coalesce(array_agg(distinct trim(value) order by trim(value)), '{}'::text[])
      into v_inventory_systems
      from jsonb_array_elements_text(v_business -> 'inventorySystems') as entry(value)
      where trim(value) <> '';
  elsif jsonb_typeof(v_business -> 'inventory_systems') = 'array' then
    select coalesce(array_agg(distinct trim(value) order by trim(value)), '{}'::text[])
      into v_inventory_systems
      from jsonb_array_elements_text(v_business -> 'inventory_systems') as entry(value)
      where trim(value) <> '';
  end if;

  if v_role = 'commerce' then
    select * into v_commerce
    from public.commerce_profiles cp
    where cp.owner_user_id = v_uid
    order by cp.created_at
    limit 1;

    if not found then
      insert into public.commerce_profiles (
        owner_user_id, trade_name, legal_name, email, phone, address, city,
        latitude, longitude, vehicle_types, inventory_systems, status
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
        v_latitude,
        v_longitude,
        v_vehicle_types,
        v_inventory_systems,
        'pending'
      )
      returning * into v_commerce;
    else
      update public.commerce_profiles
      set email = coalesce(v_email, email),
          phone = coalesce(v_phone, phone),
          address = coalesce(nullif(trim(coalesce(v_business ->> 'address', '')), ''), address),
          city = coalesce(nullif(trim(coalesce(v_business ->> 'city', '')), ''), city),
          latitude = coalesce(v_latitude, latitude),
          longitude = coalesce(v_longitude, longitude),
          vehicle_types = case
            when v_sync_vehicle_types then v_vehicle_types
            else vehicle_types
          end,
          inventory_systems = case
            when v_sync_inventory_systems then v_inventory_systems
            else inventory_systems
          end,
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
