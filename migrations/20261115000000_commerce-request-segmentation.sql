-- -----------------------------------------------------------------------------
-- Segmentación comercio ↔ solicitud
--
-- Brechas 1–3 de la auditoría técnica:
--   * El comercio elige tipos de vehículo (carros/motos) y sistemas de
--     inventario (frenos, llantas, …) al registrarse, pero esos datos solo
--     vivían en auth.users.profile.business (JSONB). Aquí se persisten en
--     columnas propias de commerce_profiles para poder filtrar sin abrir el
--     JSONB de autenticación.
--   * El comprador captura tipo de vehículo y categoría, pero solo viajaban
--     dentro de purchase_requests.items (JSONB) y category_id quedaba NULL.
--     Aquí se exponen como columnas principales de la solicitud.
--
-- Todos los cambios son aditivos y con valores por defecto seguros, por lo que
-- las filas existentes y el código actual siguen funcionando. Las filas ya
-- creadas se sincronizan la próxima vez que app_ensure_profile() corre (login o
-- guardado de perfil).
-- -----------------------------------------------------------------------------

alter table public.commerce_profiles
  add column if not exists vehicle_types text[] not null default '{}'::text[],
  add column if not exists inventory_systems text[] not null default '{}'::text[];

alter table public.purchase_requests
  add column if not exists vehicle_type text,
  add column if not exists category text;

-- Los arreglos se consultan con operadores de contención (ej. @>).
create index if not exists commerce_profiles_vehicle_types_idx
  on public.commerce_profiles using gin (vehicle_types);
create index if not exists commerce_profiles_inventory_systems_idx
  on public.commerce_profiles using gin (inventory_systems);

-- La segmentación de solicitudes se usa para filtrar el tablero del comercio.
create index if not exists purchase_requests_vehicle_type_idx
  on public.purchase_requests (vehicle_type);
create index if not exists purchase_requests_category_idx
  on public.purchase_requests (category);

-- -----------------------------------------------------------------------------
-- app_ensure_profile: además de los datos del negocio y las coordenadas,
-- sincroniza los arreglos de segmentación guardados en
-- auth.users.profile.business.
--
-- Acepta las claves camelCase que escribe la app (vehicleTypes /
-- inventorySystems) y también snake_case por compatibilidad. En el UPDATE solo
-- se sobrescriben los arreglos cuando el perfil de autenticación trae la clave
-- correspondiente; si no la trae se conserva lo que ya estaba guardado, para
-- no borrar datos con parches parciales.
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
      'status', v_commerce.status,
      'vehicle_types', v_commerce.vehicle_types,
      'inventory_systems', v_commerce.inventory_systems
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

-- `create or replace` conserva los privilegios, pero se reafirman para que la
-- función siga siendo invocable solo por sesiones autenticadas.
revoke all on function public.app_ensure_profile() from public;
grant execute on function public.app_ensure_profile() to authenticated;
