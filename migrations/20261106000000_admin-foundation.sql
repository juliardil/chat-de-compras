-- =============================================================================
-- Chat de Compras · Administrador · Fase 1
-- Fundación: personal, roles, permisos, invitaciones y auditoría.
--
-- IMPORTANTE:
--   * Este archivo NO se ha ejecutado. Se aplica con:
--       npx @insforge/cli db migrations up --all
--   * La app funciona en modo demostración hasta conectar el proyecto.
--   * No contiene secretos ni claves de servicio.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Roles y permisos
-- -----------------------------------------------------------------------------
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  module text not null,
  action text not null,
  label text not null,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_role_permissions (
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  permission_id uuid not null references public.admin_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- -----------------------------------------------------------------------------
-- Personal administrativo
-- -----------------------------------------------------------------------------
create table if not exists public.admin_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role_id uuid not null references public.admin_roles(id),
  status text not null default 'active' check (status in ('active', 'suspended')),
  mfa_required boolean not null default true,
  last_login_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_member_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.admin_members(id) on delete cascade,
  permission_id uuid not null references public.admin_permissions(id) on delete cascade,
  effect text not null check (effect in ('allow', 'deny')),
  reason text,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (member_id, permission_id)
);

create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text,
  role_id uuid not null references public.admin_roles(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_invitations_email_idx on public.admin_invitations (lower(email));
create index if not exists admin_invitations_status_idx on public.admin_invitations (status);

-- -----------------------------------------------------------------------------
-- Auditoría append-only
-- -----------------------------------------------------------------------------
create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_name text,
  actor_email text,
  actor_role text,
  action text not null,
  module text not null,
  entity_type text,
  entity_id text,
  reason_code text,
  reason_text text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  request_id text
);

create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_module_idx on public.admin_audit_logs (module);
create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs (actor_id);

-- -----------------------------------------------------------------------------
-- Helpers de identidad y permisos
-- Leen el JWT de PostgREST. Si InsForge expone auth.uid(), se puede sustituir
-- el cuerpo por auth.uid() sin cambiar las firmas.
-- -----------------------------------------------------------------------------
create or replace function public.admin_current_user_id()
returns uuid
language plpgsql
stable
as $$
declare
  claims jsonb;
begin
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    claims := null;
  end;

  if claims is not null then
    if nullif(claims ->> 'sub', '') is not null then
      return (claims ->> 'sub')::uuid;
    end if;
    if nullif(claims ->> 'user_id', '') is not null then
      return (claims ->> 'user_id')::uuid;
    end if;
    if nullif(claims ->> 'id', '') is not null then
      return (claims ->> 'id')::uuid;
    end if;
  end if;

  begin
    return nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.admin_is_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_members m
    where m.user_id = public.admin_current_user_id()
      and m.status = 'active'
  );
$$;

create or replace function public.admin_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_members m
    join public.admin_roles r on r.id = m.role_id
    where m.user_id = public.admin_current_user_id()
      and m.status = 'active'
      and r.key = 'superadmin'
  );
$$;

create or replace function public.admin_has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (
    select m.id, m.role_id
    from public.admin_members m
    where m.user_id = public.admin_current_user_id()
      and m.status = 'active'
  )
  select exists (
    select 1
    from me
    where
      -- Concesión explícita individual
      exists (
        select 1
        from public.admin_member_permission_overrides o
        join public.admin_permissions p on p.id = o.permission_id
        where o.member_id = me.id
          and p.key = p_permission_key
          and o.effect = 'allow'
      )
      or (
        -- Permiso del rol, salvo denegación explícita
        exists (
          select 1
          from public.admin_role_permissions rp
          join public.admin_permissions p on p.id = rp.permission_id
          where rp.role_id = me.role_id
            and p.key = p_permission_key
        )
        and not exists (
          select 1
          from public.admin_member_permission_overrides o
          join public.admin_permissions p on p.id = o.permission_id
          where o.member_id = me.id
            and p.key = p_permission_key
            and o.effect = 'deny'
        )
      )
  );
$$;

-- Sesión que consume el panel: miembro + rol + permisos efectivos.
create or replace function public.admin_me()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'memberId', m.id,
    'userId', m.user_id,
    'email', m.email,
    'name', m.display_name,
    'roleKey', r.key,
    'roleName', r.name,
    'status', m.status,
    'permissions', coalesce((
      select jsonb_agg(permission_key)
      from (
        select p.key as permission_key
        from public.admin_role_permissions rp
        join public.admin_permissions p on p.id = rp.permission_id
        where rp.role_id = m.role_id
          and not exists (
            select 1
            from public.admin_member_permission_overrides o
            where o.member_id = m.id
              and o.permission_id = p.id
              and o.effect = 'deny'
          )
        union
        select p.key as permission_key
        from public.admin_member_permission_overrides o
        join public.admin_permissions p on p.id = o.permission_id
        where o.member_id = m.id
          and o.effect = 'allow'
      ) effective
    ), '[]'::jsonb)
  )
  from public.admin_members m
  join public.admin_roles r on r.id = m.role_id
  where m.user_id = public.admin_current_user_id()
    and m.status = 'active';
$$;

-- -----------------------------------------------------------------------------
-- Auditoría desde servidor
-- -----------------------------------------------------------------------------
create or replace function public.admin_record_login()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, metadata
  )
  select
    m.user_id, m.display_name, m.email, r.key,
    'auth.login', 'Autenticación', 'admin_member', m.id::text,
    jsonb_build_object('result', 'success')
  from public.admin_members m
  join public.admin_roles r on r.id = m.role_id
  where m.user_id = public.admin_current_user_id()
    and m.status = 'active';

  update public.admin_members
  set last_login_at = now(), updated_at = now()
  where user_id = public.admin_current_user_id()
    and status = 'active';
end;
$$;

create or replace function public.admin_record_logout()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, metadata
  )
  select
    m.user_id, m.display_name, m.email, r.key,
    'auth.logout', 'Autenticación', 'admin_member', m.id::text,
    jsonb_build_object('result', 'success')
  from public.admin_members m
  join public.admin_roles r on r.id = m.role_id
  where m.user_id = public.admin_current_user_id()
    and m.status = 'active';
end;
$$;

-- -----------------------------------------------------------------------------
-- Invitaciones y estado del personal
-- -----------------------------------------------------------------------------
create or replace function public.admin_invite_member(
  p_email text,
  p_display_name text,
  p_role_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_id uuid;
  v_invitation_id uuid;
  v_email text := lower(trim(p_email));
begin
  if not public.admin_has_permission('staff.invite') then
    raise exception 'No autorizado para invitar personal.' using errcode = '42501';
  end if;

  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'Correo inválido.';
  end if;

  if p_role_key = 'superadmin' and not public.admin_is_superadmin() then
    raise exception 'Solo un superadministrador puede asignar ese rol.' using errcode = '42501';
  end if;

  select id into v_role_id from public.admin_roles where key = p_role_key;
  if v_role_id is null then
    raise exception 'Rol inexistente.';
  end if;

  if exists (
    select 1 from public.admin_members m where lower(m.email) = v_email
  ) then
    raise exception 'Ya existe un miembro administrativo con ese correo.';
  end if;

  if exists (
    select 1 from public.admin_invitations i
    where lower(i.email) = v_email and i.status = 'pending'
  ) then
    raise exception 'Ya existe una invitación pendiente para ese correo.';
  end if;

  insert into public.admin_invitations (email, display_name, role_id, invited_by, token_hash)
  values (
    v_email,
    coalesce(nullif(trim(p_display_name), ''), v_email),
    v_role_id,
    public.admin_current_user_id(),
    encode(gen_random_bytes(32), 'hex')
  )
  returning id into v_invitation_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_text, metadata, after_data
  )
  select
    m.user_id, m.display_name, m.email, r.key,
    'staff.invite', 'Personal', 'admin_invitation', v_invitation_id::text,
    'Invitación de personal administrativo',
    jsonb_build_object('email', v_email, 'roleKey', p_role_key),
    jsonb_build_object('status', 'pending', 'email', v_email, 'roleKey', p_role_key)
  from public.admin_members m
  join public.admin_roles r on r.id = m.role_id
  where m.user_id = public.admin_current_user_id();

  return v_invitation_id;
end;
$$;

create or replace function public.admin_set_member_status(
  p_member_id uuid,
  p_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members%rowtype;
  v_previous text;
  v_active_superadmins integer;
begin
  if not public.admin_has_permission('staff.update') then
    raise exception 'No autorizado para cambiar el estado del personal.' using errcode = '42501';
  end if;

  if p_status not in ('active', 'suspended') then
    raise exception 'Estado no válido.';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;

  select * into v_member from public.admin_members where id = p_member_id for update;
  if not found then
    raise exception 'El miembro no existe.';
  end if;

  if v_member.user_id = public.admin_current_user_id() then
    raise exception 'No puedes cambiar el estado de tu propia cuenta.' using errcode = '42501';
  end if;

  v_previous := v_member.status;
  if v_previous = p_status then
    return;
  end if;

  if p_status = 'suspended' and exists (
    select 1
    from public.admin_members m
    join public.admin_roles r on r.id = m.role_id
    where m.id = p_member_id and r.key = 'superadmin'
  ) then
    select count(*) into v_active_superadmins
    from public.admin_members m
    join public.admin_roles r on r.id = m.role_id
    where r.key = 'superadmin' and m.status = 'active';

    if v_active_superadmins <= 1 then
      raise exception 'No se puede suspender al último superadministrador activo.';
    end if;
  end if;

  update public.admin_members
  set status = p_status, updated_at = now()
  where id = p_member_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_text,
    before_data, after_data, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    case when p_status = 'suspended' then 'staff.suspend' else 'staff.reactivate' end,
    'Personal', 'admin_member', v_member.id::text, trim(p_reason),
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', p_status),
    jsonb_build_object('email', v_member.email)
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_members enable row level security;
alter table public.admin_member_permission_overrides enable row level security;
alter table public.admin_invitations enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Las migraciones por SQL no conceden privilegios automáticamente. Sin estos
-- GRANT, RLS nunca llega a evaluarse y la API devuelve "permission denied".
-- Solo se concede lectura: las escrituras pasan por funciones SECURITY DEFINER.
grant usage on schema public to authenticated;
grant select on public.admin_roles to authenticated;
grant select on public.admin_permissions to authenticated;
grant select on public.admin_role_permissions to authenticated;
grant select on public.admin_members to authenticated;
grant select on public.admin_member_permission_overrides to authenticated;
grant select on public.admin_invitations to authenticated;
grant select on public.admin_audit_logs to authenticated;

drop policy if exists admin_roles_read on public.admin_roles;
create policy admin_roles_read on public.admin_roles
  for select to authenticated
  using (public.admin_is_active());

drop policy if exists admin_permissions_read on public.admin_permissions;
create policy admin_permissions_read on public.admin_permissions
  for select to authenticated
  using (public.admin_is_active());

drop policy if exists admin_role_permissions_read on public.admin_role_permissions;
create policy admin_role_permissions_read on public.admin_role_permissions
  for select to authenticated
  using (public.admin_is_active());

drop policy if exists admin_members_read on public.admin_members;
create policy admin_members_read on public.admin_members
  for select to authenticated
  using (
    public.admin_is_active()
    and (
      user_id = public.admin_current_user_id()
      or public.admin_has_permission('staff.view')
    )
  );

drop policy if exists admin_overrides_read on public.admin_member_permission_overrides;
create policy admin_overrides_read on public.admin_member_permission_overrides
  for select to authenticated
  using (public.admin_has_permission('staff.view'));

drop policy if exists admin_invitations_read on public.admin_invitations;
create policy admin_invitations_read on public.admin_invitations
  for select to authenticated
  using (public.admin_has_permission('staff.view'));

drop policy if exists admin_audit_logs_read on public.admin_audit_logs;
create policy admin_audit_logs_read on public.admin_audit_logs
  for select to authenticated
  using (public.admin_has_permission('audit.view'));

-- La auditoría es append-only desde el cliente: no hay políticas de escritura.
revoke insert, update, delete on public.admin_audit_logs from anon, authenticated;
revoke insert, update, delete on public.admin_members from anon, authenticated;
revoke insert, update, delete on public.admin_invitations from anon, authenticated;
revoke insert, update, delete on public.admin_roles from anon, authenticated;
revoke insert, update, delete on public.admin_permissions from anon, authenticated;
revoke insert, update, delete on public.admin_role_permissions from anon, authenticated;
revoke insert, update, delete on public.admin_member_permission_overrides from anon, authenticated;

revoke execute on function public.admin_me() from public;
revoke execute on function public.admin_record_login() from public;
revoke execute on function public.admin_record_logout() from public;
revoke execute on function public.admin_invite_member(text, text, text) from public;
revoke execute on function public.admin_set_member_status(uuid, text, text) from public;

grant execute on function public.admin_me() to authenticated;
grant execute on function public.admin_record_login() to authenticated;
grant execute on function public.admin_record_logout() to authenticated;
grant execute on function public.admin_invite_member(text, text, text) to authenticated;
grant execute on function public.admin_set_member_status(uuid, text, text) to authenticated;

-- Las funciones auxiliares también se usan dentro de las políticas RLS, así
-- que `authenticated` necesita EXECUTE. Son SECURITY DEFINER y solo revelan
-- información sobre el propio solicitante.
revoke execute on function public.admin_has_permission(text) from public;
revoke execute on function public.admin_is_active() from public;
revoke execute on function public.admin_is_superadmin() from public;
revoke execute on function public.admin_current_user_id() from public;

grant execute on function public.admin_has_permission(text) to authenticated;
grant execute on function public.admin_is_active() to authenticated;
grant execute on function public.admin_is_superadmin() to authenticated;
grant execute on function public.admin_current_user_id() to authenticated;

-- -----------------------------------------------------------------------------
-- Seed de roles
-- -----------------------------------------------------------------------------
insert into public.admin_roles (key, name, description) values
  ('superadmin', 'Superadministrador', 'Control total, personal, permisos y configuración sensible.'),
  ('admin', 'Administrador general', 'Operación diaria y decisiones de negocio.'),
  ('commerce_manager', 'Gestor de comercios', 'Altas, verificación, categorías y seguimiento de comercios.'),
  ('moderator', 'Moderador', 'Reportes, contenido, reseñas y medidas de confianza.'),
  ('support', 'Atención al cliente', 'Tickets, pedidos y consultas de usuarios.'),
  ('analyst', 'Analista', 'Lectura de métricas, reportes y auditoría.'),
  ('finance', 'Finanzas', 'Pagos, reembolsos y conciliación (se activa con la pasarela).')
on conflict (key) do update
  set name = excluded.name, description = excluded.description;

-- -----------------------------------------------------------------------------
-- Seed de permisos (debe coincidir con src/admin/auth/permissions.js)
-- -----------------------------------------------------------------------------
insert into public.admin_permissions (key, module, action, label, is_sensitive) values
  ('dashboard.view', 'Panel', 'view', 'Ver el panel', false),
  ('users.view', 'Compradores', 'view', 'Ver compradores', false),
  ('users.view_pii', 'Compradores', 'view_pii', 'Ver datos personales completos', true),
  ('users.suspend', 'Compradores', 'suspend', 'Suspender compradores', true),
  ('users.block', 'Compradores', 'block', 'Bloquear compradores', true),
  ('users.delete', 'Compradores', 'delete', 'Anonimizar o eliminar compradores', true),
  ('commerce.view', 'Comercios', 'view', 'Ver comercios', false),
  ('commerce.approve', 'Comercios', 'approve', 'Aprobar comercios', true),
  ('commerce.reject', 'Comercios', 'reject', 'Rechazar comercios', true),
  ('commerce.suspend', 'Comercios', 'suspend', 'Suspender comercios', true),
  ('commerce.documents.view', 'Comercios', 'documents.view', 'Ver documentos del comercio', true),
  ('requests.view', 'Solicitudes', 'view', 'Ver solicitudes', false),
  ('requests.moderate', 'Solicitudes', 'moderate', 'Moderar solicitudes', true),
  ('requests.close', 'Solicitudes', 'close', 'Cerrar o cancelar solicitudes', true),
  ('offers.view', 'Ofertas', 'view', 'Ver ofertas', false),
  ('offers.flag', 'Ofertas', 'flag', 'Marcar ofertas irregulares', true),
  ('offers.withdraw_admin', 'Ofertas', 'withdraw_admin', 'Retirar ofertas por decisión administrativa', true),
  ('catalog.view', 'Categorías', 'view', 'Ver categorías', false),
  ('catalog.create', 'Categorías', 'create', 'Crear categorías', false),
  ('catalog.update', 'Categorías', 'update', 'Editar categorías', false),
  ('catalog.deactivate', 'Categorías', 'deactivate', 'Activar o desactivar categorías', true),
  ('orders.view', 'Pedidos', 'view', 'Ver pedidos', false),
  ('orders.cancel', 'Pedidos', 'cancel', 'Cancelar pedidos', true),
  ('orders.transition', 'Pedidos', 'transition', 'Avanzar estados de pedido', true),
  ('orders.resolve_dispute', 'Pedidos', 'resolve_dispute', 'Resolver disputas', true),
  ('deliveries.view', 'Entregas', 'view', 'Ver entregas', false),
  ('deliveries.update', 'Entregas', 'update', 'Actualizar seguimiento', false),
  ('deliveries.confirm', 'Entregas', 'confirm', 'Confirmar recepción', true),
  ('payments.view', 'Pagos', 'view', 'Ver transacciones', true),
  ('payments.refund', 'Pagos', 'refund', 'Emitir reembolsos', true),
  ('payments.reconcile', 'Pagos', 'reconcile', 'Conciliar pagos', true),
  ('payments.configure', 'Pagos', 'configure', 'Configurar pagos', true),
  ('chats.view_metadata', 'Chats', 'view_metadata', 'Ver metadatos de conversaciones', false),
  ('chats.request_access', 'Chats', 'request_access', 'Solicitar acceso a un chat', true),
  ('chats.grant_access', 'Chats', 'grant_access', 'Autorizar acceso a un chat', true),
  ('chats.access_content', 'Chats', 'access_content', 'Leer contenido de un chat autorizado', true),
  ('moderation.view', 'Moderación', 'view', 'Ver reportes', false),
  ('moderation.assign', 'Moderación', 'assign', 'Asignar reportes', false),
  ('moderation.resolve', 'Moderación', 'resolve', 'Resolver reportes', true),
  ('reviews.view', 'Reseñas', 'view', 'Ver reseñas', false),
  ('reviews.moderate', 'Reseñas', 'moderate', 'Moderar reseñas', true),
  ('support.view', 'Soporte', 'view', 'Ver tickets', false),
  ('support.assign', 'Soporte', 'assign', 'Asignar tickets', false),
  ('support.reply', 'Soporte', 'reply', 'Responder tickets', false),
  ('support.close', 'Soporte', 'close', 'Cerrar tickets', true),
  ('communications.view', 'Comunicaciones', 'view', 'Ver comunicaciones', false),
  ('communications.template', 'Comunicaciones', 'template', 'Gestionar plantillas', false),
  ('communications.send', 'Comunicaciones', 'send', 'Enviar comunicaciones', true),
  ('communications.broadcast', 'Comunicaciones', 'broadcast', 'Enviar comunicados masivos', true),
  ('analytics.view', 'Analítica', 'view', 'Ver métricas', false),
  ('analytics.export', 'Analítica', 'export', 'Exportar informes', true),
  ('analytics.pii', 'Analítica', 'pii', 'Incluir datos personales en informes', true),
  ('staff.view', 'Personal', 'view', 'Ver personal administrativo', true),
  ('staff.invite', 'Personal', 'invite', 'Invitar personal', true),
  ('staff.update', 'Personal', 'update', 'Suspender o reactivar personal', true),
  ('staff.roles.manage', 'Personal', 'roles.manage', 'Administrar roles y permisos', true),
  ('audit.view', 'Auditoría', 'view', 'Consultar auditoría', true),
  ('audit.export', 'Auditoría', 'export', 'Exportar auditoría', true),
  ('settings.view', 'Configuración', 'view', 'Ver configuración', false),
  ('settings.update', 'Configuración', 'update', 'Editar configuración', true),
  ('settings.sensitive', 'Configuración', 'sensitive', 'Cambiar configuración sensible', true)
on conflict (key) do update
  set module = excluded.module,
      action = excluded.action,
      label = excluded.label,
      is_sensitive = excluded.is_sensitive;

-- -----------------------------------------------------------------------------
-- Seed de permisos por rol
-- -----------------------------------------------------------------------------
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.key = any (
  case r.key
    when 'superadmin' then (select array_agg(key) from public.admin_permissions)

    when 'admin' then array[
      'dashboard.view',
      'users.view','users.view_pii','users.suspend','users.block','users.delete',
      'commerce.view','commerce.approve','commerce.reject','commerce.suspend','commerce.documents.view',
      'requests.view','requests.moderate','requests.close',
      'offers.view','offers.flag','offers.withdraw_admin',
      'catalog.view','catalog.create','catalog.update','catalog.deactivate',
      'orders.view','orders.cancel','orders.transition','orders.resolve_dispute',
      'deliveries.view','deliveries.update','deliveries.confirm',
      'payments.view',
      'chats.view_metadata','chats.request_access','chats.grant_access','chats.access_content',
      'moderation.view','moderation.assign','moderation.resolve',
      'reviews.view','reviews.moderate',
      'support.view','support.assign','support.reply','support.close',
      'communications.view','communications.template','communications.send','communications.broadcast',
      'analytics.view',
      'audit.view',
      'settings.view'
    ]

    when 'commerce_manager' then array[
      'dashboard.view','users.view',
      'commerce.view','commerce.approve','commerce.reject','commerce.suspend','commerce.documents.view',
      'catalog.view','catalog.create','catalog.update','catalog.deactivate',
      'requests.view','offers.view','orders.view','deliveries.view','reviews.view','analytics.view'
    ]

    when 'moderator' then array[
      'dashboard.view','users.view','users.suspend','commerce.view',
      'requests.view','requests.moderate','requests.close',
      'offers.view','offers.flag',
      'chats.view_metadata','chats.request_access','chats.access_content',
      'moderation.view','moderation.assign','moderation.resolve',
      'reviews.view','reviews.moderate','orders.view','support.view'
    ]

    when 'support' then array[
      'dashboard.view','users.view','commerce.view','requests.view','offers.view',
      'orders.view','deliveries.view','reviews.view',
      'support.view','support.assign','support.reply','support.close'
    ]

    when 'analyst' then array[
      'dashboard.view','users.view','commerce.view','requests.view','offers.view',
      'orders.view','deliveries.view','payments.view','reviews.view',
      'analytics.view','analytics.export','audit.view'
    ]

    when 'finance' then array[
      'dashboard.view','orders.view','payments.view','payments.refund','payments.reconcile',
      'analytics.view','audit.view'
    ]

    else array[]::text[]
  end
)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Bootstrap del primer superadministrador
-- 1. Crea el usuario en InsForge Auth (dashboard o flujo de registro).
-- 2. Ejecuta este bloque una sola vez, cambiando el correo:
--
-- insert into public.admin_members (user_id, email, display_name, role_id, status)
-- select u.id, u.email, coalesce(u.profile ->> 'name', u.email), r.id, 'active'
-- from auth.users u
-- cross join public.admin_roles r
-- where lower(u.email) = 'tu-correo@dominio.com'
--   and r.key = 'superadmin'
-- on conflict (user_id) do nothing;
-- -----------------------------------------------------------------------------
