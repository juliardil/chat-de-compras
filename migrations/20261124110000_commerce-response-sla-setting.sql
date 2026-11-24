-- Configuración visible del tiempo máximo de respuesta del comercio.
-- No hay política UPDATE directa sobre commerce_profiles: el cambio pasa por
-- una RPC SECURITY DEFINER que valida los únicos valores permitidos y solo
-- actualiza el perfil dueño de la sesión. Idempotente: la función se reemplaza
-- y los permisos se conceden de nuevo sin duplicar nada.

create or replace function public.app_set_max_response_minutes(p_minutes integer)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_commerce_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa para guardar el tiempo de respuesta.';
  end if;

  if p_minutes is null or p_minutes not in (5, 10, 15, 20, 30) then
    raise exception 'El tiempo de respuesta debe ser 5, 10, 15, 20 o 30 minutos.';
  end if;

  update public.commerce_profiles
     set max_response_minutes = p_minutes,
         updated_at = now()
   where owner_user_id = v_uid
  returning id into v_commerce_id;

  if v_commerce_id is null then
    raise exception 'No hay un perfil de comercio asociado a esta cuenta.';
  end if;

  return jsonb_build_object(
    'commerceId', v_commerce_id,
    'maxResponseMinutes', p_minutes
  );
end;
$$;

revoke all on function public.app_set_max_response_minutes(integer) from public;
grant execute on function public.app_set_max_response_minutes(integer) to authenticated;
