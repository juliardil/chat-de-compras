-- =============================================================================
-- Chat de Compras · Administrador · Fase 2
-- Personas y catálogo: compradores, comercios, documentos y categorías.
--
-- IMPORTANTE:
--   * Este archivo NO se ha ejecutado. Se aplica después de la Fase 1 con:
--       npx @insforge/cli db migrations up --all
--   * Requiere la migración 20261106000000_admin-foundation.sql aplicada.
--   * No contiene secretos, datos personales ni categorías de negocio.
--   * El acceso directo a las tablas queda revocado: todo pasa por funciones
--     SECURITY DEFINER con comprobación de permisos y auditoría.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table if not exists public.buyer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null,
  email text,
  phone text,
  status text not null default 'active'
    check (status in ('active', 'limited', 'suspended', 'blocked')),
  status_reason text,
  status_changed_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.commerce_categories(id) on delete restrict,
  description text,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  trade_name text not null,
  legal_name text not null,
  tax_id text,
  contact_name text,
  email text,
  phone text,
  address text,
  city text,
  category_id uuid references public.commerce_categories(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'approved', 'rejected', 'suspended')),
  status_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_documents (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_profiles(id) on delete cascade,
  doc_type text not null,
  file_name text not null,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected')),
  review_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists buyer_profiles_status_idx on public.buyer_profiles (status);
create index if not exists buyer_profiles_created_at_idx on public.buyer_profiles (created_at desc);
create index if not exists commerce_categories_parent_idx on public.commerce_categories (parent_id);
create index if not exists commerce_categories_status_idx on public.commerce_categories (status);
create index if not exists commerce_profiles_status_idx on public.commerce_profiles (status);
create index if not exists commerce_profiles_category_idx on public.commerce_profiles (category_id);
create index if not exists commerce_profiles_submitted_idx on public.commerce_profiles (submitted_at desc);
create index if not exists commerce_documents_commerce_idx on public.commerce_documents (commerce_id);
create index if not exists commerce_documents_status_idx on public.commerce_documents (status);

-- -----------------------------------------------------------------------------
-- Helpers de presentación
-- -----------------------------------------------------------------------------
create or replace function public.admin_mask_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or position('@' in p_email) <= 1 then '—'
    else left(p_email, 1) || '***' || substring(p_email from position('@' in p_email))
  end;
$$;

create or replace function public.admin_mask_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when p_phone is null or regexp_replace(p_phone, '\D', '', 'g') = '' then '—'
    else '•••• ' || right(regexp_replace(p_phone, '\D', '', 'g'), 4)
  end;
$$;

create or replace function public.admin_slugify(p_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    translate(
      lower(coalesce(p_value, '')),
      'áàäâãéèëêíìïîóòöôõúùüûñç',
      'aaaaaeeeeiiiiooooouuuunc'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$$;

-- -----------------------------------------------------------------------------
-- Compradores
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_buyers(
  p_search text default null,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_view_pii boolean := public.admin_has_permission('users.view_pii');
  v_term text := lower(trim(coalesce(p_search, '')));
begin
  if not public.admin_has_permission('users.view') then
    raise exception 'No autorizado para ver compradores.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'name', b.display_name,
        'email', case when v_view_pii then b.email else public.admin_mask_email(b.email) end,
        'phone', case when v_view_pii then b.phone else public.admin_mask_phone(b.phone) end,
        'status', b.status,
        'statusReason', b.status_reason,
        'statusChangedAt', b.status_changed_at,
        'createdAt', b.created_at,
        'lastActivityAt', b.last_activity_at,
        'piiMasked', not v_view_pii
      )
      order by b.created_at desc
    )
    from public.buyer_profiles b
    where (p_status is null or b.status = p_status)
      and (
        v_term = ''
        or lower(b.display_name) like '%' || v_term || '%'
        or lower(coalesce(b.email, '')) like '%' || v_term || '%'
        or coalesce(b.phone, '') like '%' || v_term || '%'
      )
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_set_buyer_status(
  p_buyer_id uuid,
  p_status text,
  p_reason text,
  p_reason_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer public.buyer_profiles%rowtype;
  v_previous text;
  v_action text;
  v_permission text;
begin
  select * into v_buyer from public.buyer_profiles where id = p_buyer_id for update;
  if not found then
    raise exception 'El comprador no existe.';
  end if;

  if p_status not in ('active', 'limited', 'suspended', 'blocked') then
    raise exception 'Estado de comprador no válido.';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;

  if not (
    (v_buyer.status = 'active' and p_status in ('suspended', 'blocked'))
    or (v_buyer.status = 'limited' and p_status in ('active', 'suspended', 'blocked'))
    or (v_buyer.status = 'suspended' and p_status in ('active', 'blocked'))
    or (v_buyer.status = 'blocked' and p_status = 'active')
  ) then
    raise exception 'Transición de estado no permitida para este comprador.';
  end if;

  v_permission := case
    when p_status = 'blocked' or (v_buyer.status = 'blocked' and p_status = 'active')
      then 'users.block'
    else 'users.suspend'
  end;

  if not public.admin_has_permission(v_permission) then
    raise exception 'No autorizado para cambiar el estado del comprador.' using errcode = '42501';
  end if;

  v_previous := v_buyer.status;
  v_action := case
    when p_status = 'suspended' then 'buyer.suspend'
    when p_status = 'blocked' then 'buyer.block'
    when p_status = 'active' and v_buyer.status = 'blocked' then 'buyer.unblock'
    when p_status = 'active' then 'buyer.reactivate'
    else 'buyer.limit'
  end;

  update public.buyer_profiles
  set status = p_status,
      status_reason = trim(p_reason),
      status_changed_at = now(),
      updated_at = now()
  where id = p_buyer_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text,
    before_data, after_data, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    v_action, 'Compradores', 'buyer_profile', v_buyer.id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', p_status),
    jsonb_build_object('previousStatus', v_previous, 'newStatus', p_status)
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return jsonb_build_object(
    'id', v_buyer.id,
    'status', p_status,
    'statusReason', trim(p_reason),
    'statusChangedAt', now()
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Comercios
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_commerces(
  p_search text default null,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_term text := lower(trim(coalesce(p_search, '')));
begin
  if not public.admin_has_permission('commerce.view') then
    raise exception 'No autorizado para ver comercios.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'tradeName', c.trade_name,
        'legalName', c.legal_name,
        'taxId', c.tax_id,
        'contactName', c.contact_name,
        'email', c.email,
        'phone', c.phone,
        'address', c.address,
        'city', c.city,
        'categoryId', c.category_id,
        'categoryName', category.name,
        'status', c.status,
        'statusReason', c.status_reason,
        'submittedAt', c.submitted_at,
        'reviewedAt', c.reviewed_at,
        'reviewedByName', reviewer.display_name,
        'createdAt', c.created_at,
        'documentSummary', jsonb_build_object(
          'total', count(document.id),
          'pending', count(document.id) filter (where document.status = 'pending'),
          'verified', count(document.id) filter (where document.status = 'verified'),
          'rejected', count(document.id) filter (where document.status = 'rejected')
        )
      )
      order by coalesce(c.submitted_at, c.created_at) desc
    )
    from public.commerce_profiles c
    left join public.commerce_categories category on category.id = c.category_id
    left join public.admin_members reviewer on reviewer.user_id = c.reviewed_by
    left join public.commerce_documents document on document.commerce_id = c.id
    where (p_status is null or c.status = p_status)
      and (
        v_term = ''
        or lower(c.trade_name) like '%' || v_term || '%'
        or lower(c.legal_name) like '%' || v_term || '%'
        or lower(coalesce(c.tax_id, '')) like '%' || v_term || '%'
        or lower(coalesce(c.contact_name, '')) like '%' || v_term || '%'
        or lower(coalesce(c.email, '')) like '%' || v_term || '%'
        or lower(coalesce(c.city, '')) like '%' || v_term || '%'
        or lower(coalesce(category.name, '')) like '%' || v_term || '%'
      )
    group by c.id, category.name, reviewer.display_name
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_get_commerce(p_commerce_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_commerce jsonb;
  v_documents jsonb;
begin
  if not public.admin_has_permission('commerce.view') then
    raise exception 'No autorizado para ver comercios.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', c.id,
    'tradeName', c.trade_name,
    'legalName', c.legal_name,
    'taxId', c.tax_id,
    'contactName', c.contact_name,
    'email', c.email,
    'phone', c.phone,
    'address', c.address,
    'city', c.city,
    'categoryId', c.category_id,
    'categoryName', category.name,
    'status', c.status,
    'statusReason', c.status_reason,
    'submittedAt', c.submitted_at,
    'reviewedAt', c.reviewed_at,
    'reviewedByName', reviewer.display_name,
    'createdAt', c.created_at,
    'documentSummary', jsonb_build_object(
      'total', (select count(*) from public.commerce_documents d where d.commerce_id = c.id),
      'pending', (select count(*) from public.commerce_documents d where d.commerce_id = c.id and d.status = 'pending'),
      'verified', (select count(*) from public.commerce_documents d where d.commerce_id = c.id and d.status = 'verified'),
      'rejected', (select count(*) from public.commerce_documents d where d.commerce_id = c.id and d.status = 'rejected')
    )
  )
  into v_commerce
  from public.commerce_profiles c
  left join public.commerce_categories category on category.id = c.category_id
  left join public.admin_members reviewer on reviewer.user_id = c.reviewed_by
  where c.id = p_commerce_id;

  if v_commerce is null then
    raise exception 'El comercio no existe.';
  end if;

  if public.admin_has_permission('commerce.documents.view') then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'type', d.doc_type,
        'fileName', d.file_name,
        'mimeType', d.mime_type,
        'sizeBytes', d.size_bytes,
        'status', d.status,
        'reviewReason', d.review_reason,
        'reviewedAt', d.reviewed_at,
        'reviewedByName', reviewer.display_name,
        'uploadedAt', d.uploaded_at,
        'hasFile', d.storage_path is not null
      )
      order by d.uploaded_at desc
    ), '[]'::jsonb)
    into v_documents
    from public.commerce_documents d
    left join public.admin_members reviewer on reviewer.user_id = d.reviewed_by
    where d.commerce_id = p_commerce_id;

    return v_commerce || jsonb_build_object(
      'documents', v_documents,
      'documentsRestricted', false
    );
  end if;

  return v_commerce || jsonb_build_object(
    'documents', '[]'::jsonb,
    'documentsRestricted', true
  );
end;
$$;

create or replace function public.admin_review_commerce_document(
  p_document_id uuid,
  p_status text,
  p_reason text,
  p_reason_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.commerce_documents%rowtype;
  v_action text;
begin
  if not public.admin_has_permission('commerce.approve') then
    raise exception 'No autorizado para revisar documentos de comercios.' using errcode = '42501';
  end if;

  if p_status not in ('verified', 'rejected') then
    raise exception 'Estado de documento no válido.';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;

  select * into v_document
  from public.commerce_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'El documento no existe.';
  end if;

  v_action := case when p_status = 'verified'
    then 'commerce.document.verify'
    else 'commerce.document.reject'
  end;

  update public.commerce_documents
  set status = p_status,
      review_reason = trim(p_reason),
      reviewed_at = now(),
      reviewed_by = public.admin_current_user_id()
  where id = p_document_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text,
    before_data, after_data, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    v_action, 'Comercios', 'commerce_document', v_document.id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object('status', v_document.status),
    jsonb_build_object('status', p_status),
    jsonb_build_object(
      'previousStatus', v_document.status,
      'newStatus', p_status,
      'documentType', v_document.doc_type,
      'commerceId', v_document.commerce_id
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return jsonb_build_object(
    'id', v_document.id,
    'status', p_status,
    'reviewReason', trim(p_reason),
    'reviewedAt', now()
  );
end;
$$;

create or replace function public.admin_set_commerce_status(
  p_commerce_id uuid,
  p_status text,
  p_reason text,
  p_reason_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_commerce public.commerce_profiles%rowtype;
  v_previous text;
  v_action text;
  v_permission text;
begin
  select * into v_commerce
  from public.commerce_profiles
  where id = p_commerce_id
  for update;

  if not found then
    raise exception 'El comercio no existe.';
  end if;

  if p_status not in ('pending', 'in_review', 'approved', 'rejected', 'suspended') then
    raise exception 'Estado de comercio no válido.';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;

  if not (
    (v_commerce.status = 'pending' and p_status in ('in_review', 'rejected'))
    or (v_commerce.status = 'in_review' and p_status in ('approved', 'rejected'))
    or (v_commerce.status = 'approved' and p_status = 'suspended')
    or (v_commerce.status = 'suspended' and p_status = 'approved')
    or (v_commerce.status = 'rejected' and p_status = 'in_review')
  ) then
    raise exception 'Transición de estado no permitida para este comercio.';
  end if;

  v_permission := case
    when p_status = 'rejected' then 'commerce.reject'
    when p_status = 'suspended' then 'commerce.suspend'
    else 'commerce.approve'
  end;

  if not public.admin_has_permission(v_permission) then
    raise exception 'No autorizado para cambiar el estado del comercio.' using errcode = '42501';
  end if;

  v_previous := v_commerce.status;
  v_action := case
    when p_status = 'in_review' then 'commerce.review'
    when p_status = 'approved' and v_commerce.status = 'suspended' then 'commerce.reactivate'
    when p_status = 'approved' then 'commerce.approve'
    when p_status = 'rejected' then 'commerce.reject'
    else 'commerce.suspend'
  end;

  update public.commerce_profiles
  set status = p_status,
      status_reason = trim(p_reason),
      reviewed_at = case when p_status in ('approved', 'rejected') then now() else reviewed_at end,
      reviewed_by = case when p_status in ('approved', 'rejected') then public.admin_current_user_id() else reviewed_by end,
      submitted_at = case when p_status = 'in_review' and submitted_at is null then now() else submitted_at end,
      updated_at = now()
  where id = p_commerce_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text,
    before_data, after_data, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    v_action, 'Comercios', 'commerce_profile', v_commerce.id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', p_status),
    jsonb_build_object('previousStatus', v_previous, 'newStatus', p_status)
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return jsonb_build_object(
    'id', v_commerce.id,
    'status', p_status,
    'statusReason', trim(p_reason),
    'reviewedAt', now()
  );
end;
$$;

create or replace function public.admin_document_storage_path(p_document_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_path text;
begin
  if not public.admin_has_permission('commerce.documents.view') then
    raise exception 'No autorizado para ver documentos de comercios.' using errcode = '42501';
  end if;

  select storage_path into v_path
  from public.commerce_documents
  where id = p_document_id;

  if not found then
    raise exception 'El documento no existe.';
  end if;

  return v_path;
end;
$$;

-- -----------------------------------------------------------------------------
-- Categorías
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_categories(
  p_search text default null,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_term text := lower(trim(coalesce(p_search, '')));
begin
  if not public.admin_has_permission('catalog.view') then
    raise exception 'No autorizado para ver categorías.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'parentId', c.parent_id,
        'parentName', parent.name,
        'description', c.description,
        'sortOrder', c.sort_order,
        'status', c.status,
        'createdAt', c.created_at,
        'updatedAt', c.updated_at,
        'childCount', (
          select count(*) from public.commerce_categories child where child.parent_id = c.id
        ),
        'activeChildCount', (
          select count(*) from public.commerce_categories child
          where child.parent_id = c.id and child.status = 'active'
        ),
        'commerceCount', (
          select count(*) from public.commerce_profiles commerce where commerce.category_id = c.id
        )
      )
      order by c.parent_id nulls first, c.sort_order, c.name
    )
    from public.commerce_categories c
    left join public.commerce_categories parent on parent.id = c.parent_id
    where (p_status is null or c.status = p_status)
      and (
        v_term = ''
        or lower(c.name) like '%' || v_term || '%'
        or lower(c.slug) like '%' || v_term || '%'
        or lower(coalesce(c.description, '')) like '%' || v_term || '%'
        or lower(coalesce(parent.name, '')) like '%' || v_term || '%'
      )
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_create_category(
  p_name text,
  p_parent_id uuid default null,
  p_description text default null,
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_slug text;
  v_category_id uuid;
  v_parent public.commerce_categories%rowtype;
begin
  if not public.admin_has_permission('catalog.create') then
    raise exception 'No autorizado para crear categorías.' using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'El nombre de la categoría es obligatorio.';
  end if;

  v_slug := public.admin_slugify(v_name);
  if v_slug = '' then
    raise exception 'El nombre de la categoría no es válido.';
  end if;

  if exists (select 1 from public.commerce_categories where slug = v_slug) then
    raise exception 'Ya existe una categoría con ese nombre.';
  end if;

  if p_parent_id is not null then
    select * into v_parent from public.commerce_categories where id = p_parent_id;
    if not found then
      raise exception 'La categoría padre no existe.';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'Solo se permiten dos niveles: una subcategoría no puede tener hijas.';
    end if;
  end if;

  insert into public.commerce_categories (name, slug, parent_id, description, sort_order)
  values (v_name, v_slug, p_parent_id, nullif(trim(coalesce(p_description, '')), ''), coalesce(p_sort_order, 0))
  returning id into v_category_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'catalog.create', 'Categorías', 'commerce_category', v_category_id::text,
    'Alta de categoría',
    jsonb_build_object('name', v_name, 'slug', v_slug, 'parentId', p_parent_id)
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return jsonb_build_object(
    'id', v_category_id,
    'name', v_name,
    'slug', v_slug,
    'parentId', p_parent_id,
    'description', nullif(trim(coalesce(p_description, '')), ''),
    'sortOrder', coalesce(p_sort_order, 0),
    'status', 'active'
  );
end;
$$;

create or replace function public.admin_update_category(
  p_category_id uuid,
  p_name text,
  p_parent_id uuid default null,
  p_description text default null,
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category public.commerce_categories%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text;
  v_parent public.commerce_categories%rowtype;
begin
  if not public.admin_has_permission('catalog.update') then
    raise exception 'No autorizado para editar categorías.' using errcode = '42501';
  end if;

  select * into v_category
  from public.commerce_categories
  where id = p_category_id
  for update;

  if not found then
    raise exception 'La categoría no existe.';
  end if;

  if v_name = '' then
    raise exception 'El nombre de la categoría es obligatorio.';
  end if;

  v_slug := public.admin_slugify(v_name);
  if v_slug = '' then
    raise exception 'El nombre de la categoría no es válido.';
  end if;

  if exists (
    select 1 from public.commerce_categories
    where slug = v_slug and id <> p_category_id
  ) then
    raise exception 'Ya existe otra categoría con ese nombre.';
  end if;

  if p_parent_id = p_category_id then
    raise exception 'Una categoría no puede ser su propia categoría padre.';
  end if;

  if p_parent_id is not null then
    select * into v_parent from public.commerce_categories where id = p_parent_id;
    if not found then
      raise exception 'La categoría padre no existe.';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'Solo se permiten dos niveles: una subcategoría no puede tener hijas.';
    end if;
  end if;

  if exists (
    select 1 from public.commerce_categories child where child.parent_id = p_category_id
  ) and (p_parent_id is distinct from v_category.parent_id) then
    raise exception 'No puedes mover una categoría que tiene subcategorías.';
  end if;

  update public.commerce_categories
  set name = v_name,
      slug = v_slug,
      parent_id = p_parent_id,
      description = nullif(trim(coalesce(p_description, '')), ''),
      sort_order = coalesce(p_sort_order, 0),
      updated_at = now()
  where id = p_category_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'catalog.update', 'Categorías', 'commerce_category', p_category_id::text,
    'Edición de categoría',
    jsonb_build_object(
      'previous', jsonb_build_object('name', v_category.name, 'parentId', v_category.parent_id),
      'next', jsonb_build_object('name', v_name, 'parentId', p_parent_id)
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return jsonb_build_object(
    'id', p_category_id,
    'name', v_name,
    'slug', v_slug,
    'parentId', p_parent_id,
    'description', nullif(trim(coalesce(p_description, '')), ''),
    'sortOrder', coalesce(p_sort_order, 0),
    'status', v_category.status
  );
end;
$$;

create or replace function public.admin_set_category_status(
  p_category_id uuid,
  p_status text,
  p_reason text,
  p_reason_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category public.commerce_categories%rowtype;
  v_previous text;
  v_action text;
begin
  if not public.admin_has_permission('catalog.deactivate') then
    raise exception 'No autorizado para activar o desactivar categorías.' using errcode = '42501';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception 'Estado de categoría no válido.';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;

  select * into v_category
  from public.commerce_categories
  where id = p_category_id
  for update;

  if not found then
    raise exception 'La categoría no existe.';
  end if;

  if p_status = 'inactive' and exists (
    select 1 from public.commerce_categories child
    where child.parent_id = p_category_id and child.status = 'active'
  ) then
    raise exception 'Desactiva primero las subcategorías activas.';
  end if;

  v_previous := v_category.status;
  if v_previous = p_status then
    return jsonb_build_object('id', p_category_id, 'status', p_status);
  end if;

  v_action := case when p_status = 'inactive'
    then 'catalog.deactivate'
    else 'catalog.activate'
  end;

  update public.commerce_categories
  set status = p_status, updated_at = now()
  where id = p_category_id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text,
    before_data, after_data, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    v_action, 'Categorías', 'commerce_category', p_category_id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', p_status),
    jsonb_build_object('previousStatus', v_previous, 'newStatus', p_status)
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return jsonb_build_object(
    'id', p_category_id,
    'status', p_status,
    'statusReason', trim(p_reason)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Métricas permission-aware para el panel
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_can_staff boolean := public.admin_has_permission('staff.view');
  v_can_audit boolean := public.admin_has_permission('audit.view');
  v_can_buyers boolean := public.admin_has_permission('users.view');
  v_can_commerce boolean := public.admin_has_permission('commerce.view');
  v_can_documents boolean := public.admin_has_permission('commerce.documents.view');
  v_can_catalog boolean := public.admin_has_permission('catalog.view');
  v_active_members integer := 0;
  v_suspended_members integer := 0;
  v_total_members integer := 0;
  v_pending_invitations integer := 0;
  v_audit_today integer := 0;
  v_active_buyers integer := 0;
  v_suspended_buyers integer := 0;
  v_blocked_buyers integer := 0;
  v_total_buyers integer := 0;
  v_pending_commerces integer := 0;
  v_in_review_commerces integer := 0;
  v_approved_commerces integer := 0;
  v_suspended_commerces integer := 0;
  v_total_commerces integer := 0;
  v_active_categories integer := 0;
  v_inactive_categories integer := 0;
  v_total_categories integer := 0;
  v_pending_documents integer := 0;
  v_verified_documents integer := 0;
  v_rejected_documents integer := 0;
  v_total_documents integer := 0;
  v_attention jsonb := '[]'::jsonb;
  v_recent jsonb := '[]'::jsonb;
begin
  if v_can_staff then
    select count(*) filter (where status = 'active'),
           count(*) filter (where status = 'suspended'),
           count(*)
    into v_active_members, v_suspended_members, v_total_members
    from public.admin_members;

    select count(*) into v_pending_invitations
    from public.admin_invitations where status = 'pending';
  end if;

  if v_can_audit then
    select count(*) into v_audit_today
    from public.admin_audit_logs
    where created_at >= date_trunc('day', now());

    select coalesce(jsonb_agg(to_jsonb(entry)), '[]'::jsonb)
    into v_recent
    from (
      select *
      from public.admin_audit_logs
      order by created_at desc
      limit 6
    ) entry;
  end if;

  if v_can_buyers then
    select count(*) filter (where status = 'active'),
           count(*) filter (where status = 'suspended'),
           count(*) filter (where status = 'blocked'),
           count(*)
    into v_active_buyers, v_suspended_buyers, v_blocked_buyers, v_total_buyers
    from public.buyer_profiles;
  end if;

  if v_can_commerce then
    select count(*) filter (where status = 'pending'),
           count(*) filter (where status = 'in_review'),
           count(*) filter (where status = 'approved'),
           count(*) filter (where status = 'suspended'),
           count(*)
    into v_pending_commerces, v_in_review_commerces, v_approved_commerces,
         v_suspended_commerces, v_total_commerces
    from public.commerce_profiles;
  end if;

  if v_can_catalog then
    select count(*) filter (where status = 'active'),
           count(*) filter (where status = 'inactive'),
           count(*)
    into v_active_categories, v_inactive_categories, v_total_categories
    from public.commerce_categories;
  end if;

  if v_can_documents then
    select count(*) filter (where status = 'pending'),
           count(*) filter (where status = 'verified'),
           count(*) filter (where status = 'rejected'),
           count(*)
    into v_pending_documents, v_verified_documents, v_rejected_documents, v_total_documents
    from public.commerce_documents;
  end if;

  if v_can_staff and v_pending_invitations > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'invitations',
      'label', v_pending_invitations || ' invitación(es) pendiente(s) de aceptación',
      'tone', 'warning',
      'path', '/personal'
    ));
  end if;

  if v_can_staff and v_suspended_members > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'suspended',
      'label', v_suspended_members || ' cuenta(s) administrativa(s) suspendida(s)',
      'tone', 'neutral',
      'path', '/personal'
    ));
  end if;

  if v_can_commerce and v_pending_commerces > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'pendingCommerces',
      'label', v_pending_commerces || ' comercio(s) pendiente(s) de verificación',
      'tone', 'warning',
      'path', '/comercios'
    ));
  end if;

  if v_can_commerce and v_in_review_commerces > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'inReviewCommerces',
      'label', v_in_review_commerces || ' comercio(s) en revisión',
      'tone', 'info',
      'path', '/comercios'
    ));
  end if;

  if v_can_documents and v_rejected_documents > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'rejectedDocuments',
      'label', v_rejected_documents || ' documento(s) rechazado(s) por corregir',
      'tone', 'warning',
      'path', '/comercios'
    ));
  end if;

  if v_can_buyers and v_blocked_buyers > 0 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'id', 'blockedBuyers',
      'label', v_blocked_buyers || ' comprador(es) bloqueado(s)',
      'tone', 'neutral',
      'path', '/compradores'
    ));
  end if;

  return jsonb_build_object(
    'activeMembers', v_active_members,
    'suspendedMembers', v_suspended_members,
    'pendingInvitations', v_pending_invitations,
    'auditToday', v_audit_today,
    'totalMembers', v_total_members,
    'activeBuyers', v_active_buyers,
    'suspendedBuyers', v_suspended_buyers,
    'blockedBuyers', v_blocked_buyers,
    'totalBuyers', v_total_buyers,
    'pendingCommerces', v_pending_commerces,
    'inReviewCommerces', v_in_review_commerces,
    'approvedCommerces', v_approved_commerces,
    'suspendedCommerces', v_suspended_commerces,
    'totalCommerces', v_total_commerces,
    'activeCategories', v_active_categories,
    'inactiveCategories', v_inactive_categories,
    'totalCategories', v_total_categories,
    'pendingDocuments', v_pending_documents,
    'verifiedDocuments', v_verified_documents,
    'rejectedDocuments', v_rejected_documents,
    'totalDocuments', v_total_documents,
    'recentAudit', v_recent,
    'attention', v_attention
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS y privilegios
-- El cliente no lee estas tablas directamente: los datos personales y las rutas
-- de almacenamiento solo salen por funciones con permisos y auditoría.
-- -----------------------------------------------------------------------------
alter table public.buyer_profiles enable row level security;
alter table public.commerce_categories enable row level security;
alter table public.commerce_profiles enable row level security;
alter table public.commerce_documents enable row level security;

revoke all on public.buyer_profiles from anon, authenticated;
revoke all on public.commerce_categories from anon, authenticated;
revoke all on public.commerce_profiles from anon, authenticated;
revoke all on public.commerce_documents from anon, authenticated;

revoke execute on function public.admin_mask_email(text) from public;
revoke execute on function public.admin_mask_phone(text) from public;
revoke execute on function public.admin_slugify(text) from public;

revoke execute on function public.admin_list_buyers(text, text) from public;
revoke execute on function public.admin_set_buyer_status(uuid, text, text, text) from public;
revoke execute on function public.admin_list_commerces(text, text) from public;
revoke execute on function public.admin_get_commerce(uuid) from public;
revoke execute on function public.admin_review_commerce_document(uuid, text, text, text) from public;
revoke execute on function public.admin_set_commerce_status(uuid, text, text, text) from public;
revoke execute on function public.admin_document_storage_path(uuid) from public;
revoke execute on function public.admin_list_categories(text, text) from public;
revoke execute on function public.admin_create_category(text, uuid, text, integer) from public;
revoke execute on function public.admin_update_category(uuid, text, uuid, text, integer) from public;
revoke execute on function public.admin_set_category_status(uuid, text, text, text) from public;
revoke execute on function public.admin_dashboard_metrics() from public;

grant execute on function public.admin_list_buyers(text, text) to authenticated;
grant execute on function public.admin_set_buyer_status(uuid, text, text, text) to authenticated;
grant execute on function public.admin_list_commerces(text, text) to authenticated;
grant execute on function public.admin_get_commerce(uuid) to authenticated;
grant execute on function public.admin_review_commerce_document(uuid, text, text, text) to authenticated;
grant execute on function public.admin_set_commerce_status(uuid, text, text, text) to authenticated;
grant execute on function public.admin_document_storage_path(uuid) to authenticated;
grant execute on function public.admin_list_categories(text, text) to authenticated;
grant execute on function public.admin_create_category(text, uuid, text, integer) to authenticated;
grant execute on function public.admin_update_category(uuid, text, uuid, text, integer) to authenticated;
grant execute on function public.admin_set_category_status(uuid, text, text, text) to authenticated;
grant execute on function public.admin_dashboard_metrics() to authenticated;

-- -----------------------------------------------------------------------------
-- Bucket privado de documentos
-- No se crea desde SQL. La aplicación espera un bucket privado llamado
-- `commerce-documents` (configurable con VITE_INSFORGE_DOCUMENTS_BUCKET).
-- Las URLs firmadas se generan en el cliente solo después de que
-- admin_document_storage_path() autorice el documento.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Nota sobre datos iniciales
-- No se siembran compradores, comercios, documentos ni categorías: son datos
-- de negocio. Se crean desde la aplicación o desde procesos de alta reales.
-- -----------------------------------------------------------------------------
