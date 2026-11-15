-- =============================================================================
-- Matching empresa ↔ solicitud (segmentación y RLS)
--
-- Cierra las brechas de la auditoría:
--   * normaliza el vocabulario de vehículos (Auto/Camioneta/Camión → carros,
--     Moto → motos) y las categorías de repuesto;
--   * permite que un comercio aprobado vea solo solicitudes abiertas afines a
--     su segmento;
--   * impide que un comercio envíe ofertas a solicitudes fuera de su nicho.
--
-- Compatibilidad: si una solicitud antigua tiene vehicle_type/category en NULL,
-- se leen también desde el JSONB items. Si no hay ningún dato reconocible, no
-- se bloquea por ese criterio (pero el comercio sí debe tener segmentación).
--
-- La normalización replica src/utils/matching.js para que el filtro del cliente
-- y las políticas del backend produzcan el mismo resultado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Normalización compartida
-- -----------------------------------------------------------------------------
create or replace function public.app_normalize_text(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
  select nullif(
    trim(
      regexp_replace(
        translate(
          lower(trim(coalesce(p_value, ''))),
          'áàäâãéèëêíìïîóòöôõúùüûñç',
          'aaaaaeeeeiiiiooooouuuunc'
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function public.app_vehicle_family(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
  select case public.app_normalize_text(p_value)
    when 'carros' then 'carros'
    when 'carro' then 'carros'
    when 'auto' then 'carros'
    when 'autos' then 'carros'
    when 'automovil' then 'carros'
    when 'automoviles' then 'carros'
    when 'camioneta' then 'carros'
    when 'camionetas' then 'carros'
    when 'camion' then 'carros'
    when 'camiones' then 'carros'
    when 'tractor' then 'carros'
    when 'tractores' then 'carros'
    when 'suv' then 'carros'
    when 'suvs' then 'carros'
    when 'pickup' then 'carros'
    when 'pickups' then 'carros'
    when 'pick up' then 'carros'
    when 'vehiculo' then 'carros'
    when 'vehiculos' then 'carros'
    when 'motos' then 'motos'
    when 'moto' then 'motos'
    when 'motocicleta' then 'motos'
    when 'motocicletas' then 'motos'
    when 'scooter' then 'motos'
    when 'scooters' then 'motos'
    else null
  end;
$$;

create or replace function public.app_category_key(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
  select case public.app_normalize_text(p_value)
    when 'motor' then 'motor'
    when 'motores' then 'motor'
    when 'motor y transmision' then 'motor'
    when 'transmision' then 'motor'
    when 'frenos' then 'frenos'
    when 'freno' then 'frenos'
    when 'sistema de frenos' then 'frenos'
    when 'suspension' then 'suspension'
    when 'suspensiones' then 'suspension'
    when 'amortiguadores' then 'suspension'
    when 'electrico' then 'electrico'
    when 'electrica' then 'electrico'
    when 'electricos' then 'electrico'
    when 'electricidad' then 'electrico'
    when 'sistema electrico' then 'electrico'
    when 'llantas' then 'llantas'
    when 'llanta' then 'llantas'
    when 'neumaticos' then 'llantas'
    when 'neumatico' then 'llantas'
    when 'llantas y neumaticos' then 'llantas'
    when 'interior exterior' then 'interior exterior'
    when 'interior y exterior' then 'interior exterior'
    when 'interior' then 'interior exterior'
    when 'exterior' then 'interior exterior'
    when 'carroceria' then 'interior exterior'
    when 'lubricantes' then 'lubricantes'
    when 'lubricante' then 'lubricantes'
    when 'lubricantes y fluidos' then 'lubricantes'
    when 'fluidos' then 'lubricantes'
    when 'aceites' then 'lubricantes'
    when 'taller' then 'taller'
    when 'taller mecanico' then 'taller'
    when 'servicios' then 'taller'
    when 'servicio mecanico' then 'taller'
    when 'accesorios' then 'accesorios'
    when 'accesorios vehiculares' then 'accesorios'
    when 'accesorios para vehiculos' then 'accesorios'
    when 'audio' then 'audio'
    when 'audio y sonido' then 'audio'
    when 'sonido' then 'audio'
    when 'estereo' then 'audio'
    when 'seguridad' then 'seguridad'
    when 'seguridad vehicular' then 'seguridad'
    else public.app_normalize_text(p_value)
  end;
$$;

-- -----------------------------------------------------------------------------
-- Segmentación efectiva de una solicitud (columnas nuevas + items antiguos)
-- -----------------------------------------------------------------------------
create or replace function public.app_request_vehicle_families(p_request_id uuid)
returns text[]
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with request_row as (
    select r.vehicle_type, r.items
    from public.purchase_requests r
    where r.id = p_request_id
  ),
  vehicle_values as (
    select request_row.vehicle_type as value
    from request_row
    union all
    select value ->> 'vehicleType'
    from request_row
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(request_row.items) = 'array' then request_row.items
        else '[]'::jsonb
      end
    ) as item(value)
    union all
    select value ->> 'vehicle_type'
    from request_row
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(request_row.items) = 'array' then request_row.items
        else '[]'::jsonb
      end
    ) as item(value)
  ),
  families as (
    select distinct public.app_vehicle_family(value) as family
    from vehicle_values
    where public.app_vehicle_family(value) is not null
  )
  select coalesce(array_agg(family order by family), '{}'::text[])
  from families;
$$;

create or replace function public.app_request_categories(p_request_id uuid)
returns text[]
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with request_row as (
    select r.category, r.items
    from public.purchase_requests r
    where r.id = p_request_id
  ),
  category_values as (
    select request_row.category as value
    from request_row
    union all
    select value ->> 'category'
    from request_row
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(request_row.items) = 'array' then request_row.items
        else '[]'::jsonb
      end
    ) as item(value)
  ),
  category_keys as (
    select distinct public.app_category_key(value) as category_key
    from category_values
    where public.app_category_key(value) is not null
  )
  select coalesce(array_agg(category_key order by category_key), '{}'::text[])
  from category_keys;
$$;

-- -----------------------------------------------------------------------------
-- Compatibilidad comercio ↔ solicitud
-- -----------------------------------------------------------------------------
create or replace function public.app_commerce_matches_request(
  p_commerce_id uuid,
  p_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with commerce_row as (
    select
      cp.id,
      coalesce(cp.vehicle_types, '{}'::text[]) as vehicle_types,
      coalesce(cp.inventory_systems, '{}'::text[]) as inventory_systems
    from public.commerce_profiles cp
    where cp.id = p_commerce_id
  ),
  request_row as (
    select
      r.id,
      public.app_request_vehicle_families(r.id) as vehicle_families,
      public.app_request_categories(r.id) as category_keys
    from public.purchase_requests r
    where r.id = p_request_id
  )
  select exists (
    select 1
    from commerce_row c
    cross join request_row r
    where coalesce(array_length(c.vehicle_types, 1), 0) > 0
      and coalesce(array_length(c.inventory_systems, 1), 0) > 0
      and (
        coalesce(array_length(r.vehicle_families, 1), 0) = 0
        or exists (
          select 1
          from unnest(c.vehicle_types) as vt(value)
          where public.app_vehicle_family(vt.value) = any(r.vehicle_families)
        )
      )
      and (
        coalesce(array_length(r.category_keys, 1), 0) = 0
        or exists (
          select 1
          from unnest(c.inventory_systems) as inv(value)
          where public.app_category_key(inv.value) = any(r.category_keys)
        )
      )
  );
$$;

-- Devuelve true si alguno de los comercios aprobados del usuario autenticado
-- es compatible con la solicitud. La política RLS no conoce el commerce_id de
-- antemano, por eso se evalúan todos los perfiles aprobados del usuario.
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
    where cp.owner_user_id = auth.uid()
      and cp.status = 'approved'
      and public.app_commerce_matches_request(cp.id, p_request_id)
  );
$$;

-- -----------------------------------------------------------------------------
-- Ofertas: solo a solicitudes afines al vehículo y categoría del comercio
-- -----------------------------------------------------------------------------
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
      and public.app_commerce_matches_request(cp.id, r.id)
  );
$$;

-- -----------------------------------------------------------------------------
-- Política de lectura de solicitudes
-- -----------------------------------------------------------------------------
-- Un comercio aprobado solo ve solicitudes abiertas de su segmento. Se
-- conserva la cláusula de oferta existente para que un comercio que ya ofertó
-- pueda seguir viendo la solicitud (aunque cambie de estado o segmentación).
drop policy if exists purchase_requests_read on public.purchase_requests;
create policy purchase_requests_read on public.purchase_requests
  for select to authenticated
  using (
    public.app_is_buyer(buyer_id)
    or (status = 'open' and public.app_approved_commerce_matches_request(id))
    or public.app_commerce_has_offer_on_request(id)
  );

-- -----------------------------------------------------------------------------
-- Privilegios
-- -----------------------------------------------------------------------------
revoke all on function public.app_normalize_text(text) from public;
revoke all on function public.app_vehicle_family(text) from public;
revoke all on function public.app_category_key(text) from public;
revoke all on function public.app_request_vehicle_families(uuid) from public;
revoke all on function public.app_request_categories(uuid) from public;
revoke all on function public.app_commerce_matches_request(uuid, uuid) from public;
revoke all on function public.app_approved_commerce_matches_request(uuid) from public;
revoke all on function public.app_can_offer_on_request(uuid, uuid) from public;

-- Las políticas se evalúan con el rol del invocador: estas dos funciones deben
-- ser ejecutables por sesiones autenticadas. Las auxiliares quedan internas.
grant execute on function public.app_approved_commerce_matches_request(uuid) to authenticated;
grant execute on function public.app_can_offer_on_request(uuid, uuid) to authenticated;
