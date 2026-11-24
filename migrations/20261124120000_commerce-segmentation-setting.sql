-- Edición de nichos y líneas de inventario del comercio.
-- No existe política UPDATE directa sobre commerce_profiles: el guardado pasa
-- por una RPC SECURITY DEFINER que solo toca el perfil dueño de la sesión.
-- Estas mismas columnas son las que consume app_commerce_matches_request, así
-- que /dashboard refleja el cambio en la siguiente carga sin caché ni job extra.
-- Idempotente: la función se reemplaza y los permisos se conceden de nuevo.

create or replace function public.app_set_commerce_segmentation(
  p_vehicle_types text[],
  p_inventory_systems text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_commerce_id uuid;
  v_vehicle_types text[];
  v_inventory_systems text[];
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa para guardar los nichos y líneas.';
  end if;

  select coalesce(array_agg(distinct btrim(value) order by btrim(value)), '{}'::text[])
    into v_vehicle_types
    from unnest(coalesce(p_vehicle_types, '{}'::text[])) as entry(value)
   where btrim(coalesce(value, '')) <> '';

  select coalesce(array_agg(distinct btrim(value) order by btrim(value)), '{}'::text[])
    into v_inventory_systems
    from unnest(coalesce(p_inventory_systems, '{}'::text[])) as entry(value)
   where btrim(coalesce(value, '')) <> '';

  if coalesce(array_length(v_vehicle_types, 1), 0) = 0
     or coalesce(array_length(v_inventory_systems, 1), 0) = 0 then
    raise exception 'Selecciona al menos un tipo de vehículo y una línea de inventario.';
  end if;

  update public.commerce_profiles
     set vehicle_types = v_vehicle_types,
         inventory_systems = v_inventory_systems,
         updated_at = now()
   where owner_user_id = v_uid
  returning id into v_commerce_id;

  if v_commerce_id is null then
    raise exception 'No hay un perfil de comercio asociado a esta cuenta.';
  end if;

  return jsonb_build_object(
    'commerceId', v_commerce_id,
    'vehicleTypes', to_jsonb(v_vehicle_types),
    'inventorySystems', to_jsonb(v_inventory_systems)
  );
end;
$$;

revoke all on function public.app_set_commerce_segmentation(text[], text[]) from public;
grant execute on function public.app_set_commerce_segmentation(text[], text[]) to authenticated;
