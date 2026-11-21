-- =============================================================================
-- Go.go · Imágenes y flyers en el club (aditivo)
--
-- * Agrega `image_url` a `group_events` y `group_messages` sin tocar filas
--   anteriores: los registros existentes quedan en NULL y siguen renderizando.
-- * Las RPC del club siguen siendo SECURITY DEFINER y validan pertenencia con
--   `public.group_is_member` antes de leer, publicar o confirmar asistencia.
-- * Al crear una actividad se publica automáticamente una tarjeta en el chat
--   del club con el mismo flyer, fecha, hora y punto de encuentro.
-- * El bucket público `avatars` ya existe; se agrega una política RESTRICTIVE
--   solo para las rutas `clubs/{groupId}/...`, sin afectar avatares, logos ni
--   documentos de otras características.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columnas nuevas (compatibles con eventos y mensajes anteriores)
-- -----------------------------------------------------------------------------
alter table public.group_events
  add column if not exists image_url text;

alter table public.group_messages
  add column if not exists image_url text;

-- -----------------------------------------------------------------------------
-- Helper usado por la app antes de subir un archivo a `clubs/{groupId}/...`.
-- La decisión final de lectura/escritura en BD sigue siendo de las RPC.
-- -----------------------------------------------------------------------------
create or replace function public.app_group_can_upload_image(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p_group_id is not null and public.group_is_member(p_group_id);
$$;

revoke all on function public.app_group_can_upload_image(uuid) from public;
grant execute on function public.app_group_can_upload_image(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Chat del club: imágenes opcionales + fecha y hora siempre presentes
-- -----------------------------------------------------------------------------
drop function if exists public.app_group_messages(integer);

create or replace function public.app_group_messages(p_limit integer default 40)
returns table (
  id uuid,
  body text,
  author_name text,
  is_mine boolean,
  created_at timestamptz,
  image_url text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 100);
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null or not public.group_is_member(v_group_id) then
    return;
  end if;

  return query
    select m.id, m.body,
           coalesce(bp.display_name, u.email, 'Miembro'),
           (m.user_id = v_uid),
           m.created_at,
           m.image_url
    from public.group_messages m
    left join public.buyer_profiles bp on bp.user_id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.group_id = v_group_id
    order by m.created_at desc
    limit v_limit;
end;
$$;

create or replace function public.app_group_send_message(
  p_body text,
  p_image_url text default null
)
returns table (
  id uuid,
  body text,
  author_name text,
  is_mine boolean,
  created_at timestamptz,
  image_url text
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_image_url text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_stored_body text;
  v_message_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  if v_image_url is not null and char_length(v_image_url) > 2048 then
    raise exception 'La URL de la imagen no es válida.';
  end if;

  if char_length(v_body) < 1 and v_image_url is null then
    raise exception 'Escribe un mensaje o adjunta una imagen.';
  end if;

  if char_length(v_body) > 1000 then
    raise exception 'El mensaje debe tener entre 1 y 1000 caracteres.';
  end if;

  -- `group_messages.body` exige texto: una imagen sola usa un cuerpo neutro
  -- que la interfaz puede ocultar cuando existe `image_url`.
  v_stored_body := case when v_body = '' then 'Imagen compartida' else v_body end;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null or not public.group_is_member(v_group_id) then
    raise exception 'Solo los miembros del club pueden escribir en este canal.';
  end if;

  insert into public.group_messages as gm (group_id, user_id, body, image_url)
  values (v_group_id, v_uid, v_stored_body, v_image_url)
  returning gm.id into v_message_id;

  return query
    select m.id, m.body,
           coalesce(bp.display_name, u.email, 'Miembro'),
           true,
           m.created_at,
           m.image_url
    from public.group_messages m
    left join public.buyer_profiles bp on bp.user_id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.id = v_message_id;
end;
$$;

-- Conserva el contrato anterior de una sola cadena para llamadores antiguos.
create or replace function public.app_group_send_message(p_body text)
returns table (
  id uuid,
  body text,
  author_name text,
  is_mine boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  return query
    select m.id, m.body, m.author_name, m.is_mine, m.created_at
    from public.app_group_send_message(p_body, null::text) as m;
end;
$$;

-- -----------------------------------------------------------------------------
-- Actividades: flyer, confirmados y estado del usuario
-- -----------------------------------------------------------------------------
drop function if exists public.app_group_events();

create or replace function public.app_group_events()
returns table (
  id uuid,
  title text,
  description text,
  location text,
  starts_at timestamptz,
  going_count integer,
  my_status text,
  image_url text,
  confirmed_members jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null or not public.group_is_member(v_group_id) then
    return;
  end if;

  return query
    select e.id, e.title, e.description, e.location, e.starts_at,
           (select count(*)::integer from public.group_event_rsvps r
             where r.event_id = e.id and r.status = 'going'),
           coalesce((
             select r.status from public.group_event_rsvps r
             where r.event_id = e.id and r.user_id = v_uid
             limit 1
           ), 'none'),
           e.image_url,
           coalesce((
             select jsonb_agg(
               jsonb_build_object(
                 'user_id', r.user_id,
                 'display_name', coalesce(
                   nullif(btrim(coalesce(bp.display_name, '')), ''),
                   nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
                   'Miembro'
                 ),
                 'avatar_url', nullif(btrim(coalesce(bp.avatar_url, '')), '')
               )
               order by r.updated_at
             )
             from public.group_event_rsvps r
             left join public.buyer_profiles bp on bp.user_id = r.user_id
             left join auth.users u on u.id = r.user_id
             where r.event_id = e.id and r.status = 'going'
           ), '[]'::jsonb)
    from public.group_events e
    where e.group_id = v_group_id
      and e.starts_at >= now() - interval '1 day'
    order by e.starts_at asc;
end;
$$;

create or replace function public.app_group_create_event(
  p_title text,
  p_description text,
  p_location text,
  p_starts_at timestamptz,
  p_image_url text default null
)
returns table (
  id uuid,
  title text,
  starts_at timestamptz,
  image_url text
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_location text := nullif(btrim(coalesce(p_location, '')), '');
  v_image_url text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_notice text;
  v_event_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  if char_length(v_title) < 2 or char_length(v_title) > 120 then
    raise exception 'El título debe tener entre 2 y 120 caracteres.';
  end if;

  if p_starts_at is null then
    raise exception 'Selecciona la fecha y hora de la actividad.';
  end if;

  if v_image_url is not null and char_length(v_image_url) > 2048 then
    raise exception 'La URL de la imagen no es válida.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null
     or not public.group_is_member(v_group_id)
     or not public.group_is_owner(v_group_id) then
    raise exception 'Solo el responsable del club puede crear eventos.';
  end if;

  insert into public.group_events as ge (
    group_id, title, description, location, starts_at, created_by, image_url
  )
  values (
    v_group_id,
    v_title,
    v_description,
    v_location,
    p_starts_at,
    v_uid,
    v_image_url
  )
  returning ge.id into v_event_id;

  -- Aviso automático en el chat: tarjeta con flyer, fecha, hora y punto de
  -- encuentro. Se escribe con SECURITY DEFINER, pero solo después de validar
  -- que el autor es miembro activo y responsable del club.
  v_notice := '📅 Nueva actividad: ' || v_title
    || E'\nFecha y hora: ' || to_char(p_starts_at, 'DD/MM/YYYY HH24:MI')
    || case when v_location is not null then E'\nPunto de encuentro: ' || v_location else '' end
    || case when v_description is not null then E'\n' || v_description else '' end;

  insert into public.group_messages as gm (group_id, user_id, body, image_url)
  values (v_group_id, v_uid, left(v_notice, 1000), v_image_url);

  return query
    select e.id, e.title, e.starts_at, e.image_url
    from public.group_events e
    where e.id = v_event_id;
end;
$$;

-- Conserva la firma anterior sin imagen.
create or replace function public.app_group_create_event(
  p_title text,
  p_description text,
  p_location text,
  p_starts_at timestamptz
)
returns table (
  id uuid,
  title text,
  starts_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  return query
    select e.id, e.title, e.starts_at
    from public.app_group_create_event(
      p_title, p_description, p_location, p_starts_at, null::text
    ) as e;
end;
$$;

-- La confirmación sigue siendo solo para miembros del evento del club.
create or replace function public.app_group_rsvp(p_event_id uuid, p_status text)
returns table (
  event_id uuid,
  status text,
  going_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_status text := btrim(coalesce(p_status, ''));
  v_event_group_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  if v_status not in ('going', 'not_going') then
    raise exception 'Estado de asistencia no válido.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  select e.group_id into v_event_group_id
  from public.group_events e
  where e.id = p_event_id;

  if v_event_group_id is null
     or v_event_group_id is distinct from v_group_id
     or not public.group_is_member(v_event_group_id) then
    raise exception 'Esa actividad no pertenece a tu club.';
  end if;

  insert into public.group_event_rsvps (event_id, user_id, status, updated_at)
  values (p_event_id, v_uid, v_status, now())
  on conflict on constraint group_event_rsvps_event_id_user_id_key
  do update set status = excluded.status, updated_at = now();

  return query
    select p_event_id, v_status,
           (select count(*)::integer from public.group_event_rsvps r
            where r.event_id = p_event_id and r.status = 'going');
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage: solo miembros pueden subir a `clubs/{groupId}/...`.
-- Es RESTRICTIVE para complementar (no reemplazar) la política de propietario
-- ya existente. El resto de rutas del bucket avatars quedan intactas.
-- -----------------------------------------------------------------------------
drop policy if exists storage_objects_club_images_members on storage.objects;
create policy storage_objects_club_images_members on storage.objects
as restrictive
for insert
to authenticated
with check (
  case
    when bucket <> 'avatars' then true
    when key is null or key not like 'clubs/%' then true
    else public.group_is_member(
      nullif((regexp_match(key, '^clubs/([0-9a-fA-F-]{36})/'))[1], '')::uuid
    )
  end
);

-- -----------------------------------------------------------------------------
-- Permisos: las RPC nuevas y las existentes siguen siendo solo para sesiones
-- autenticadas; `anon` nunca obtiene ejecución.
-- -----------------------------------------------------------------------------
revoke all on function public.app_group_messages(integer) from public;
grant execute on function public.app_group_messages(integer) to authenticated;

revoke all on function public.app_group_send_message(text, text) from public;
grant execute on function public.app_group_send_message(text, text) to authenticated;

revoke all on function public.app_group_send_message(text) from public;
grant execute on function public.app_group_send_message(text) to authenticated;

revoke all on function public.app_group_events() from public;
grant execute on function public.app_group_events() to authenticated;

revoke all on function public.app_group_create_event(text, text, text, timestamptz, text) from public;
grant execute on function public.app_group_create_event(text, text, text, timestamptz, text) to authenticated;

revoke all on function public.app_group_create_event(text, text, text, timestamptz) from public;
grant execute on function public.app_group_create_event(text, text, text, timestamptz) to authenticated;

revoke all on function public.app_group_rsvp(uuid, text) from public;
grant execute on function public.app_group_rsvp(uuid, text) to authenticated;
