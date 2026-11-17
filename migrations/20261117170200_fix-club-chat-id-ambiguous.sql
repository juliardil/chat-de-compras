-- =============================================================================
-- Go.go · Corrección de ambigüedad de `id` en RPCs del club
--
-- Migración ADITIVA posterior a 20261117170100. No modifica tablas, RLS ni
-- permisos: solo reemplaza las funciones cuyo `RETURNING id` / `ON CONFLICT`
-- colisionaba con la columna de salida `id` declarada en `RETURNS TABLE`.
-- En PL/pgSQL esa columna de salida es también una variable, por lo que el
-- intérprete podía resolver `id` de forma ambigua:
--   column reference "id" is ambiguous
--
-- Se aplica el mismo criterio de la migración 20261117154957: conservar los
-- nombres de salida que consume la app y calificar con alias de tabla o con el
-- nombre real de la restricción única.
--
-- Además se expone `app_group_members()` para alimentar el modal "Ver
-- miembros" con datos reales (nombre, avatar y rol), sin inventarlos en el
-- frontend.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Chat interno del club
-- -----------------------------------------------------------------------------
create or replace function public.app_group_messages(p_limit integer default 40)
returns table (
  id uuid,
  body text,
  author_name text,
  is_mine boolean,
  created_at timestamptz
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

  if v_group_id is null then
    return;
  end if;

  return query
    select m.id, m.body,
           coalesce(bp.display_name, u.email, 'Miembro'),
           (m.user_id = v_uid),
           m.created_at
    from public.group_messages m
    left join public.buyer_profiles bp on bp.user_id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.group_id = v_group_id
    order by m.created_at desc
    limit v_limit;
end;
$$;

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
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_message_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'El mensaje debe tener entre 1 y 1000 caracteres.';
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null or not public.group_is_member(v_group_id) then
    raise exception 'Solo los miembros del club pueden escribir en este canal.';
  end if;

  -- `gm.id` (alias de la tabla insertada) evita la colisión con la columna de
  -- salida `id` declarada en RETURNS TABLE.
  insert into public.group_messages as gm (group_id, user_id, body)
  values (v_group_id, v_uid, v_body)
  returning gm.id into v_message_id;

  return query
    select m.id, m.body,
           coalesce(bp.display_name, u.email, 'Miembro'),
           true,
           m.created_at
    from public.group_messages m
    left join public.buyer_profiles bp on bp.user_id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.id = v_message_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Miembros del club (modal "Ver miembros" del perfil)
-- -----------------------------------------------------------------------------
create or replace function public.app_group_members()
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  role text,
  is_me boolean,
  joined_at timestamptz
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

  if v_group_id is null then
    return;
  end if;

  return query
    select m.user_id,
           coalesce(
             nullif(btrim(coalesce(bp.display_name, '')), ''),
             nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
             'Miembro'
           ),
           bp.avatar_url,
           m.role,
           (m.user_id = v_uid),
           m.joined_at
    from public.group_members m
    left join public.buyer_profiles bp on bp.user_id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.group_id = v_group_id
    order by case when m.role = 'owner' then 0 else 1 end, m.joined_at asc;
end;
$$;

revoke all on function public.app_group_members() from public;
grant execute on function public.app_group_members() to authenticated;

-- -----------------------------------------------------------------------------
-- Actividades y asistencia
-- -----------------------------------------------------------------------------
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
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
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

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null or not public.group_is_owner(v_group_id) then
    raise exception 'Solo el responsable del club puede crear eventos.';
  end if;

  insert into public.group_events as ge (group_id, title, description, location, starts_at, created_by)
  values (
    v_group_id,
    v_title,
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_location, '')), ''),
    p_starts_at,
    v_uid
  )
  returning ge.id into v_event_id;

  return query
    select e.id, e.title, e.starts_at
    from public.group_events e
    where e.id = v_event_id;
end;
$$;

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

  if v_event_group_id is null or v_event_group_id is distinct from v_group_id then
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
-- Administración: tarifas y marcas patrocinadoras
-- -----------------------------------------------------------------------------
create or replace function public.admin_save_sponsorship_rate(
  p_id uuid,
  p_code text,
  p_name text,
  p_amount numeric,
  p_currency text,
  p_billing_cycle text,
  p_description text,
  p_is_active boolean
)
returns table (
  id uuid,
  code text,
  name text,
  amount numeric,
  currency text,
  billing_cycle text,
  description text,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_cycle text := coalesce(p_billing_cycle, 'monthly');
  v_id uuid;
  v_before jsonb := '{}'::jsonb;
begin
  if not public.admin_has_permission('sponsorships.manage') then
    raise exception 'No tienes permiso para administrar las tarifas de patrocinio.';
  end if;

  if v_code !~ '^[a-z0-9_]{3,40}$' then
    raise exception 'El código debe tener entre 3 y 40 caracteres (a-z, 0-9, guion bajo).';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'El nombre debe tener entre 2 y 80 caracteres.';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'El costo debe ser un número mayor o igual a cero.';
  end if;

  if v_cycle not in ('monthly', 'one_time') then
    raise exception 'El ciclo debe ser mensual o único.';
  end if;

  if p_id is not null then
    select to_jsonb(r) into v_before
    from public.club_sponsorship_rates r
    where r.id = p_id;

    if v_before is null then
      raise exception 'La tarifa no existe.';
    end if;
  end if;

  insert into public.club_sponsorship_rates as csr (
    id, code, name, amount, currency, billing_cycle, description, is_active, updated_at, updated_by
  )
  values (
    coalesce(p_id, gen_random_uuid()),
    v_code,
    v_name,
    p_amount,
    coalesce(nullif(btrim(coalesce(p_currency, '')), ''), 'MXN'),
    v_cycle,
    nullif(btrim(coalesce(p_description, '')), ''),
    coalesce(p_is_active, true),
    now(),
    auth.uid()
  )
  on conflict on constraint club_sponsorship_rates_pkey do update
    set code = excluded.code,
        name = excluded.name,
        amount = excluded.amount,
        currency = excluded.currency,
        billing_cycle = excluded.billing_cycle,
        description = excluded.description,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
  returning csr.id into v_id;

  insert into public.admin_audit_logs (
    actor_id, action, module, entity_type, entity_id, before_data, after_data, metadata
  )
  values (
    auth.uid(),
    case when p_id is null then 'sponsorships.rate.create' else 'sponsorships.rate.update' end,
    'Patrocinios',
    'club_sponsorship_rate',
    v_id::text,
    v_before,
    jsonb_build_object('code', v_code, 'name', v_name, 'amount', p_amount,
                       'billing_cycle', v_cycle, 'is_active', coalesce(p_is_active, true)),
    jsonb_build_object('source', 'admin_panel')
  );

  return query
    select r.id, r.code, r.name, r.amount, r.currency, r.billing_cycle,
           r.description, r.is_active, r.updated_at
    from public.club_sponsorship_rates r
    where r.id = v_id;
end;
$$;

create or replace function public.admin_save_club_sponsor(
  p_id uuid,
  p_group_id uuid,
  p_brand_name text,
  p_logo_url text,
  p_benefit text,
  p_discount_percent numeric,
  p_contact_email text,
  p_commerce_id uuid,
  p_workshop_id uuid,
  p_rate_id uuid,
  p_amount numeric,
  p_currency text,
  p_billing_cycle text,
  p_starts_on date,
  p_ends_on date
)
returns table (id uuid, brand_name text, moderation_status text, lifecycle_status text)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_name text := btrim(coalesce(p_brand_name, ''));
  v_cycle text := coalesce(p_billing_cycle, 'monthly');
  v_id uuid;
  v_before jsonb := '{}'::jsonb;
begin
  if not public.admin_has_permission('sponsorships.manage') then
    raise exception 'No tienes permiso para administrar marcas patrocinadoras.';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'El nombre de la marca debe tener entre 2 y 120 caracteres.';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'El costo debe ser un número mayor o igual a cero.';
  end if;

  if v_cycle not in ('monthly', 'one_time') then
    raise exception 'El ciclo debe ser mensual o único.';
  end if;

  if p_ends_on is not null and p_starts_on is not null and p_ends_on < p_starts_on then
    raise exception 'La fecha de fin no puede ser anterior a la de inicio.';
  end if;

  if p_id is not null then
    select to_jsonb(s) into v_before
    from public.club_sponsors s
    where s.id = p_id;

    if v_before is null then
      raise exception 'El patrocinio no existe.';
    end if;
  end if;

  insert into public.club_sponsors as cs (
    id, group_id, brand_name, logo_url, benefit, discount_percent, contact_email,
    commerce_id, workshop_id, rate_id, amount, currency, billing_cycle,
    starts_on, ends_on, created_by, updated_at
  )
  values (
    coalesce(p_id, gen_random_uuid()),
    p_group_id,
    v_name,
    nullif(btrim(coalesce(p_logo_url, '')), ''),
    nullif(btrim(coalesce(p_benefit, '')), ''),
    p_discount_percent,
    nullif(btrim(coalesce(p_contact_email, '')), ''),
    p_commerce_id,
    p_workshop_id,
    p_rate_id,
    p_amount,
    coalesce(nullif(btrim(coalesce(p_currency, '')), ''), 'MXN'),
    v_cycle,
    p_starts_on,
    p_ends_on,
    auth.uid(),
    now()
  )
  on conflict on constraint club_sponsors_pkey do update
    set group_id = excluded.group_id,
        brand_name = excluded.brand_name,
        logo_url = excluded.logo_url,
        benefit = excluded.benefit,
        discount_percent = excluded.discount_percent,
        contact_email = excluded.contact_email,
        commerce_id = excluded.commerce_id,
        workshop_id = excluded.workshop_id,
        rate_id = excluded.rate_id,
        amount = excluded.amount,
        currency = excluded.currency,
        billing_cycle = excluded.billing_cycle,
        starts_on = excluded.starts_on,
        ends_on = excluded.ends_on,
        updated_at = excluded.updated_at
  returning cs.id into v_id;

  insert into public.admin_audit_logs (
    actor_id, action, module, entity_type, entity_id, before_data, after_data, metadata
  )
  values (
    auth.uid(),
    case when p_id is null then 'sponsorships.brand.create' else 'sponsorships.brand.update' end,
    'Patrocinios',
    'club_sponsor',
    v_id::text,
    v_before,
    jsonb_build_object('brand_name', v_name, 'amount', p_amount,
                       'billing_cycle', v_cycle, 'starts_on', p_starts_on, 'ends_on', p_ends_on),
    jsonb_build_object('source', 'admin_panel')
  );

  return query
    select s.id, s.brand_name, s.moderation_status,
           public.club_sponsor_lifecycle(s.moderation_status, s.starts_on, s.ends_on)
    from public.club_sponsors s
    where s.id = v_id;
end;
$$;
