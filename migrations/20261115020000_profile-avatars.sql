-- =============================================================================
-- Fotos de perfil de compradores y comercios.
--
-- Hasta ahora la app solo generaba una URL temporal (URL.createObjectURL) al
-- elegir una foto: nunca se subía ni se guardaba. Esta migración:
--   * agrega avatar_url a los dos perfiles;
--   * documenta el bucket público «avatars» (lectura por URL, escritura del
--     dueño), que se crea con la CLI porque storage.buckets no acepta INSERT
--     desde migraciones;
--   * expone una función para guardar la URL del usuario autenticado sin tocar
--     campos sensibles como status;
--   * permite que un comercio lea SOLO el nombre y el avatar de los
--     compradores con los que tiene relación (chat, oferta, pedido o una
--     solicitud abierta que puede atender).
-- =============================================================================

alter table public.buyer_profiles
  add column if not exists avatar_url text;

alter table public.commerce_profiles
  add column if not exists avatar_url text;

-- Bucket público: las fotos se muestran por URL a la contraparte. La escritura
-- sigue protegida por las políticas de storage.objects (uploaded_by = sub).
--
-- El bucket se crea con la CLI de InsForge porque la tabla storage.buckets no
-- permite INSERT desde migraciones (RLS). Ya está creado en el proyecto:
--   npx -y @insforge/cli storage create-bucket avatars --public
-- En un proyecto nuevo hay que ejecutar ese comando una vez.

-- Lectura pública del bucket para listar/metadata. Las descargas directas de un
-- bucket público ya se sirven sin RLS (ver documentación de InsForge).
drop policy if exists storage_objects_avatar_public_read on storage.objects;
create policy storage_objects_avatar_public_read on storage.objects
  for select
  to authenticated, anon
  using (bucket = 'avatars');

grant usage on schema storage to anon;
grant select on storage.objects to anon;

-- Permite saber si el usuario autenticado puede ver el avatar de un comprador.
-- Se usa dentro de app_buyer_avatars(), que devuelve solo id, nombre y avatar
-- (nunca email, teléfono ni otros datos del perfil).
create or replace function public.app_can_read_buyer_profile(p_buyer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.buyer_profiles bp
    where bp.id = p_buyer_id
      and bp.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.chat_threads ct
    where ct.buyer_id = p_buyer_id
      and public.app_is_commerce(ct.commerce_id)
  )
  or exists (
    select 1
    from public.purchase_offers po
    join public.purchase_requests pr on pr.id = po.request_id
    where pr.buyer_id = p_buyer_id
      and public.app_is_commerce(po.commerce_id)
  )
  or exists (
    select 1
    from public.purchase_orders po
    where po.buyer_id = p_buyer_id
      and public.app_is_commerce(po.commerce_id)
  )
  -- El tablero del comercio muestra solicitudes abiertas afines a su nicho.
  -- Para pintar la foto del comprador en esa tarjeta se permite leer su
  -- avatar cuando el comercio puede atender la solicitud.
  or exists (
    select 1
    from public.purchase_requests pr
    where pr.buyer_id = p_buyer_id
      and pr.status = 'open'
      and public.app_approved_commerce_matches_request(pr.id)
  );
$$;

-- Devuelve únicamente los campos públicos del comprador que el comercio puede
-- ver. Evita exponer la fila completa de buyer_profiles (email, teléfono…).
create or replace function public.app_buyer_avatars(p_ids uuid[])
returns table (id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select bp.id, bp.display_name, bp.avatar_url
  from public.buyer_profiles bp
  where bp.id = any(coalesce(p_ids, '{}'::uuid[]))
    and public.app_can_read_buyer_profile(bp.id);
$$;

-- Guarda la foto del usuario autenticado en su perfil real. La app sube el
-- archivo al bucket y luego llama esta función con la URL pública.
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
    else 'user'
  end;

  if v_role = 'commerce' then
    update public.commerce_profiles
    set avatar_url = v_url,
        updated_at = now()
    where owner_user_id = v_uid
    returning id into v_commerce_id;
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
    'commerce_id', v_commerce_id
  );
end;
$$;

revoke all on function public.app_can_read_buyer_profile(uuid) from public;
revoke all on function public.app_buyer_avatars(uuid[]) from public;
revoke all on function public.app_set_avatar_url(text) from public;

grant execute on function public.app_buyer_avatars(uuid[]) to authenticated;
grant execute on function public.app_set_avatar_url(text) to authenticated;
