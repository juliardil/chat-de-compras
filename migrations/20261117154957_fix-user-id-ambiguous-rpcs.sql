-- =============================================================================
-- Fix quirúrgico: ambigüedad de `user_id` en RPCs de clubes/talleres
--
-- La RPC `public.app_save_workshop` declara `user_id` como columna de salida de
-- `RETURNS TABLE`. En PL/pgSQL ese nombre es también una variable, por lo que
-- `on conflict (user_id)` era ambiguo en tiempo de ejecución:
--   column reference "user_id" is ambiguous
--
-- La revisión del resto de RPCs de clubes/eventos/talleres confirmó que ya
-- califican sus columnas (`gm.user_id`, `bp.user_id`, `r.buyer_id`,
-- `wp.user_id`). No hay tablas `group_messages`, `group_events` ni
-- `group_event_rsvps` en este proyecto.
--
-- Se mantiene el nombre de columna de salida `user_id` porque la app lo
-- consume, y se elimina la ambigüedad usando el nombre de la restricción
-- única real de `workshop_profiles`: `workshop_profiles_user_id_key`.
--
-- NO modifica tablas, RLS ni ninguna función distinta de `app_save_workshop`.
-- =============================================================================

create or replace function public.app_save_workshop(
  p_workshop_name text,
  p_nit_or_id text,
  p_address text,
  p_phone text,
  p_specialties text[] default '{}'
)
returns table (
  id uuid,
  user_id uuid,
  workshop_name text,
  nit_or_id text,
  address text,
  phone text,
  specialties text[],
  is_verified boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_workshop_name, ''));
  v_nit text := btrim(coalesce(p_nit_or_id, ''));
  v_address text := btrim(coalesce(p_address, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_specialties text[] := coalesce(p_specialties, '{}'::text[]);
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'El nombre del taller debe tener entre 2 y 120 caracteres.';
  end if;
  if v_nit = '' or char_length(v_nit) > 40 then
    raise exception 'El NIT o cédula es obligatorio (máximo 40 caracteres).';
  end if;
  if v_address = '' or char_length(v_address) > 200 then
    raise exception 'La dirección es obligatoria (máximo 200 caracteres).';
  end if;
  if v_phone = '' or char_length(v_phone) > 30 then
    raise exception 'El teléfono es obligatorio (máximo 30 caracteres).';
  end if;

  -- Un usuario solo tiene un taller: registrar equivale a actualizarlo.
  -- `on conflict on constraint` evita la colisión entre la variable de salida
  -- `user_id` y la columna `workshop_profiles.user_id`.
  insert into public.workshop_profiles
    (user_id, workshop_name, nit_or_id, address, phone, specialties)
  values
    (v_uid, v_name, v_nit, v_address, v_phone, v_specialties)
  on conflict on constraint workshop_profiles_user_id_key do update
    set workshop_name = excluded.workshop_name,
        nit_or_id = excluded.nit_or_id,
        address = excluded.address,
        phone = excluded.phone,
        specialties = excluded.specialties;

  return query select * from public.app_my_workshop();
end;
$$;

revoke all on function public.app_save_workshop(text, text, text, text, text[]) from public;
grant execute on function public.app_save_workshop(text, text, text, text, text[]) to authenticated;
