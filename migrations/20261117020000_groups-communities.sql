-- =============================================================================
-- Chat de Compras · Comunidades / Clubes de compradores
--
-- Módulo NUEVO y aislado. NO modifica purchase_requests, purchase_offers,
-- commerce_profiles ni ninguna política RLS existente. Solo crea sus propias
-- tablas, funciones y permisos, y coexiste con el resto del backend.
--
-- Se aplica con:
--   npx -y @insforge/cli db migrations up 20261117020000_groups-communities.sql
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tablas nuevas
-- -----------------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists group_members_group_id_idx on public.group_members (group_id);
create index if not exists group_members_user_id_idx on public.group_members (user_id);

-- Configuración global del módulo: un único renglón con el mínimo de
-- participantes para que un club se considere verificado.
create table if not exists public.group_settings (
  id boolean primary key default true check (id),
  min_members integer not null default 5 check (min_members between 1 and 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.group_settings (id, min_members)
values (true, 5)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Helpers RLS (SECURITY DEFINER: evitan recursión entre policies)
-- -----------------------------------------------------------------------------
create or replace function public.group_is_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.group_is_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.role = 'owner'
  );
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security (solo tablas nuevas)
-- -----------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_settings enable row level security;

drop policy if exists groups_select_authenticated on public.groups;
create policy groups_select_authenticated on public.groups
  for select to authenticated
  using (created_by = auth.uid() or public.group_is_member(id));

drop policy if exists groups_insert_own on public.groups;
create policy groups_insert_own on public.groups
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists groups_update_own on public.groups;
create policy groups_update_own on public.groups
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists groups_delete_own on public.groups;
create policy groups_delete_own on public.groups
  for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists group_members_select_related on public.group_members;
create policy group_members_select_related on public.group_members
  for select to authenticated
  using (user_id = auth.uid() or public.group_is_member(group_id));

drop policy if exists group_members_insert_own on public.group_members;
create policy group_members_insert_own on public.group_members
  for insert to authenticated
  with check (user_id = auth.uid() and role = 'member');

drop policy if exists group_members_update_related on public.group_members;
create policy group_members_update_related on public.group_members
  for update to authenticated
  using (user_id = auth.uid() or public.group_is_owner(group_id))
  with check (user_id = auth.uid() or public.group_is_owner(group_id));

drop policy if exists group_members_delete_related on public.group_members;
create policy group_members_delete_related on public.group_members
  for delete to authenticated
  using (user_id = auth.uid() or public.group_is_owner(group_id));

drop policy if exists group_settings_select_authenticated on public.group_settings;
create policy group_settings_select_authenticated on public.group_settings
  for select to authenticated
  using (true);

drop policy if exists group_settings_update_admin on public.group_settings;
create policy group_settings_update_admin on public.group_settings
  for update to authenticated
  using (public.admin_has_permission('communities.configure'))
  with check (public.admin_has_permission('communities.configure'));

-- -----------------------------------------------------------------------------
-- Permisos (tablas propias del administrador, sin tocar las existentes)
-- -----------------------------------------------------------------------------
insert into public.admin_permissions (key, module, action, label, is_sensitive) values
  ('communities.view', 'Comunidades', 'view', 'Ver clubes de compradores', false),
  ('communities.configure', 'Comunidades', 'configure', 'Configurar el mínimo de participantes', true)
on conflict (key) do update
  set module = excluded.module,
      action = excluded.action,
      label = excluded.label,
      is_sensitive = excluded.is_sensitive;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p
  on p.key in ('communities.view', 'communities.configure')
where r.key in ('superadmin', 'admin')
  and not exists (
    select 1
    from public.admin_role_permissions rp
    where rp.role_id = r.id
      and rp.permission_id = p.id
  );

-- -----------------------------------------------------------------------------
-- RPCs de comprador
-- -----------------------------------------------------------------------------
-- Estado del club del usuario autenticado. Devuelve cero filas si no pertenece
-- a ninguno. El código de invitación solo se entrega a sus propios miembros.
create or replace function public.app_my_group()
returns table (
  group_id uuid,
  name text,
  invite_code text,
  role text,
  member_count integer,
  min_members integer,
  is_owner boolean,
  is_verified boolean,
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
  v_count integer;
  v_min integer;
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

  select count(*)::integer into v_count
  from public.group_members gm
  where gm.group_id = v_group_id;

  select s.min_members into v_min
  from public.group_settings s
  where s.id = true;

  return query
    select g.id, g.name, g.invite_code, gm.role, v_count, v_min,
           (g.created_by = v_uid), (v_count >= v_min), gm.joined_at
    from public.groups g
    join public.group_members gm
      on gm.group_id = g.id and gm.user_id = v_uid
    where g.id = v_group_id;
end;
$$;

create or replace function public.app_create_group(
  p_name text,
  p_invite_code text default null
)
returns table (
  group_id uuid,
  name text,
  invite_code text,
  role text,
  member_count integer,
  min_members integer,
  is_owner boolean,
  is_verified boolean,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_code text;
  v_group_id uuid;
  v_attempts integer := 0;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'El nombre del club debe tener entre 2 y 80 caracteres.';
  end if;

  if exists (select 1 from public.group_members gm where gm.user_id = v_uid) then
    raise exception 'Ya perteneces a un club. Sal del actual para crear uno nuevo.';
  end if;

  if p_invite_code is null or btrim(p_invite_code) = '' then
    loop
      v_attempts := v_attempts + 1;
      select string_agg(
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1),
        '' order by gs
      )
      into v_code
      from generate_series(1, 8) as gs;

      exit when not exists (select 1 from public.groups g where g.invite_code = v_code);

      if v_attempts > 20 then
        raise exception 'No se pudo generar un código único. Inténtalo de nuevo.';
      end if;
    end loop;
  else
    v_code := upper(btrim(p_invite_code));
    if v_code !~ '^[A-Z0-9]{4,20}$' then
      raise exception 'El código debe tener entre 4 y 20 caracteres alfanuméricos.';
    end if;
    if exists (select 1 from public.groups g where g.invite_code = v_code) then
      raise exception 'Ese código de invitación ya está en uso.';
    end if;
  end if;

  insert into public.groups (name, invite_code, created_by)
  values (v_name, v_code, v_uid)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'owner');

  return query select * from public.app_my_group();
end;
$$;

create or replace function public.app_join_group(p_invite_code text)
returns table (
  group_id uuid,
  name text,
  invite_code text,
  role text,
  member_count integer,
  min_members integer,
  is_owner boolean,
  is_verified boolean,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_invite_code, '')));
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if v_code = '' then
    raise exception 'Ingresa un código de invitación.';
  end if;

  select g.id into v_group_id
  from public.groups g
  where g.invite_code = v_code;

  if v_group_id is null then
    raise exception 'No existe un club con ese código de invitación.';
  end if;

  -- Reingresar al mismo club es idempotente.
  if exists (
    select 1 from public.group_members gm
    where gm.user_id = v_uid and gm.group_id = v_group_id
  ) then
    return query select * from public.app_my_group();
    return;
  end if;

  if exists (select 1 from public.group_members gm where gm.user_id = v_uid) then
    raise exception 'Ya perteneces a otro club. Sal primero para unirte a este.';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'member');

  return query select * from public.app_my_group();
end;
$$;

create or replace function public.app_leave_group()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_role text;
  v_remaining integer;
  v_new_owner uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select gm.group_id, gm.role into v_group_id, v_role
  from public.group_members gm
  where gm.user_id = v_uid
  order by gm.joined_at asc
  limit 1;

  if v_group_id is null then
    return false;
  end if;

  delete from public.group_members gm
  where gm.user_id = v_uid and gm.group_id = v_group_id;

  -- Si se va el dueño, se transfiere al miembro más antiguo o se elimina el club vacío.
  if v_role = 'owner' then
    select count(*)::integer into v_remaining
    from public.group_members gm
    where gm.group_id = v_group_id;

    if v_remaining = 0 then
      delete from public.groups g where g.id = v_group_id;
    else
      select gm.user_id into v_new_owner
      from public.group_members gm
      where gm.group_id = v_group_id
      order by gm.joined_at asc
      limit 1;

      update public.group_members gm
      set role = 'owner'
      where gm.group_id = v_group_id and gm.user_id = v_new_owner;

      update public.groups g
      set created_by = v_new_owner
      where g.id = v_group_id;
    end if;
  end if;

  return true;
end;
$$;

-- Insignias para el vendedor: SOLO clubes verificados y sin código de invitación.
create or replace function public.app_group_badges(p_user_ids uuid[])
returns table (
  user_id uuid,
  group_name text,
  member_count integer,
  min_members integer,
  is_verified boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with ranked as (
    select distinct on (gm.user_id)
      gm.user_id,
      g.name,
      count(*) over (partition by g.id)::integer as member_count
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.user_id = any(coalesce(p_user_ids, '{}'::uuid[]))
    order by gm.user_id, gm.joined_at asc
  )
  select r.user_id, r.name, r.member_count, s.min_members, true
  from ranked r
  cross join public.group_settings s
  where r.member_count >= s.min_members;
$$;

-- -----------------------------------------------------------------------------
-- RPCs de administración
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_groups(p_search text default null)
returns table (
  id uuid,
  name text,
  invite_code text,
  created_by uuid,
  owner_name text,
  created_at timestamptz,
  member_count integer,
  min_members integer,
  is_verified boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_term text := lower(btrim(coalesce(p_search, '')));
begin
  if not public.admin_has_permission('communities.view') then
    raise exception 'No tienes permiso para ver los clubes.';
  end if;

  return query
    select g.id, g.name, g.invite_code, g.created_by,
           coalesce(bp.display_name, u.email, g.created_by::text),
           g.created_at,
           (select count(*)::integer from public.group_members gm where gm.group_id = g.id),
           s.min_members,
           ((select count(*)::integer from public.group_members gm where gm.group_id = g.id) >= s.min_members)
    from public.groups g
    cross join public.group_settings s
    left join public.buyer_profiles bp on bp.user_id = g.created_by
    left join auth.users u on u.id = g.created_by
    where v_term = ''
       or lower(g.name) like '%' || v_term || '%'
       or lower(g.invite_code) like '%' || v_term || '%'
       or lower(coalesce(bp.display_name, u.email, '')) like '%' || v_term || '%'
    order by g.created_at desc;
end;
$$;

create or replace function public.admin_get_group(p_group_id uuid)
returns table (
  group_id uuid,
  group_name text,
  invite_code text,
  created_at timestamptz,
  member_count integer,
  min_members integer,
  member_user_id uuid,
  member_display_name text,
  member_email text,
  member_role text,
  member_joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.admin_has_permission('communities.view') then
    raise exception 'No tienes permiso para auditar los clubes.';
  end if;

  return query
    select g.id, g.name, g.invite_code, g.created_at,
           (select count(*)::integer from public.group_members gm where gm.group_id = g.id),
           s.min_members,
           gm.user_id,
           coalesce(bp.display_name, u.email, gm.user_id::text),
           coalesce(bp.email, u.email),
           gm.role,
           gm.joined_at
    from public.groups g
    cross join public.group_settings s
    left join public.group_members gm on gm.group_id = g.id
    left join public.buyer_profiles bp on bp.user_id = gm.user_id
    left join auth.users u on u.id = gm.user_id
    where g.id = p_group_id
    order by gm.joined_at asc;
end;
$$;

create or replace function public.admin_set_group_min_members(p_min_members integer)
returns table (min_members integer, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.admin_has_permission('communities.configure') then
    raise exception 'No tienes permiso para configurar los clubes.';
  end if;

  if p_min_members is null or p_min_members < 1 or p_min_members > 1000 then
    raise exception 'El mínimo de participantes debe estar entre 1 y 1000.';
  end if;

  update public.group_settings s
  set min_members = p_min_members,
      updated_at = now(),
      updated_by = auth.uid()
  where s.id = true;

  return query
    select s.min_members, s.updated_at
    from public.group_settings s
    where s.id = true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants (el patron del proyecto: execute a authenticated, control dentro de la RPC)
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.group_members to authenticated;
grant select on public.group_settings to authenticated;

revoke all on function public.group_is_member(uuid) from public;
revoke all on function public.group_is_owner(uuid) from public;
revoke all on function public.app_my_group() from public;
revoke all on function public.app_create_group(text, text) from public;
revoke all on function public.app_join_group(text) from public;
revoke all on function public.app_leave_group() from public;
revoke all on function public.app_group_badges(uuid[]) from public;
revoke all on function public.admin_list_groups(text) from public;
revoke all on function public.admin_get_group(uuid) from public;
revoke all on function public.admin_set_group_min_members(integer) from public;

grant execute on function public.group_is_member(uuid) to authenticated;
grant execute on function public.group_is_owner(uuid) to authenticated;
grant execute on function public.app_my_group() to authenticated;
grant execute on function public.app_create_group(text, text) to authenticated;
grant execute on function public.app_join_group(text) to authenticated;
grant execute on function public.app_leave_group() to authenticated;
grant execute on function public.app_group_badges(uuid[]) to authenticated;
grant execute on function public.admin_list_groups(text) to authenticated;
grant execute on function public.admin_get_group(uuid) to authenticated;
grant execute on function public.admin_set_group_min_members(integer) to authenticated;
