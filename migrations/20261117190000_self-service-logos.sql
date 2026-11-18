-- =============================================================================
-- Chat de Compras · Autoservicio de logotipos (negocios y marcas)
--
-- Módulo ADITIVO. Reutiliza el bucket público `avatars` y el mismo contrato de
-- validación que la foto de perfil (JPG/PNG/WEBP/GIF, máx. 5 MB, validado en la
-- app). No crea un storage paralelo ni cambia los flujos existentes.
--
-- Qué hace:
--   1. Agrega `logo_url` a workshop_profiles y commerce_profiles (si falta).
--   2. Verifica que club_sponsors.logo_url exista (ya viene de migración previa).
--   3. Expone RPC SECURITY DEFINER para que cada dueño actualice SOLO el logo
--      de su taller/comercio, y para que admin o creador gestionen logos de
--      marcas. Ninguna escritura depende de un id enviado por el cliente sin
--      comprobación de propiedad en servidor.
--   4. Amplía `app_sponsor_impact()` con logo/beneficio/descuento para que el
--      patrocinio aprobado se pinte automáticamente en el perfil del negocio.
--   5. Expone logos de marcas aprobadas vinculadas a un taller/comercio para
--      mostrarlos en ofertas y productos.
--   6. Refuerza RLS de lectura de patrocinios para el negocio vinculado.
--
-- Aplicar con:
--   npx -y @insforge/cli db migrations up --all
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Verificación de tablas base (falla en voz alta si falta alguna)
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.workshop_profiles') is null then
    raise exception 'Falta la tabla public.workshop_profiles.';
  end if;
  if to_regclass('public.commerce_profiles') is null then
    raise exception 'Falta la tabla public.commerce_profiles.';
  end if;
  if to_regclass('public.club_sponsors') is null then
    raise exception 'Falta la tabla public.club_sponsors.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'club_sponsors'
      and column_name = 'logo_url'
  ) then
    raise exception 'Falta club_sponsors.logo_url; ejecuta primero la migración de patrocinios.';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Columnas aditivas
-- -----------------------------------------------------------------------------
alter table public.workshop_profiles
  add column if not exists logo_url text;

alter table public.commerce_profiles
  add column if not exists logo_url text;

-- -----------------------------------------------------------------------------
-- 3. Lectura del logo propio (taller y/o comercio de la sesión)
-- -----------------------------------------------------------------------------
create or replace function public.app_my_business_logos()
returns table (
  workshop_id uuid,
  workshop_logo_url text,
  commerce_id uuid,
  commerce_logo_url text
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select wp.id, wp.logo_url, cp.id, cp.logo_url
  from (select 1 as seed) s
  left join public.workshop_profiles wp on wp.user_id = auth.uid()
  left join public.commerce_profiles cp on cp.owner_user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- 4. Escritura: cada dueño solo puede cambiar el logo de SU negocio
-- -----------------------------------------------------------------------------
create or replace function public.app_set_workshop_logo(p_logo_url text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_url text := nullif(btrim(coalesce(p_logo_url, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa para actualizar el logo.';
  end if;

  if v_url is not null and (char_length(v_url) > 2048 or v_url !~* '^https?://') then
    raise exception 'La URL del logo no es válida.';
  end if;

  update public.workshop_profiles
  set logo_url = v_url
  where user_id = v_uid
  returning id into v_id;

  if v_id is null then
    raise exception 'Aún no tienes un taller registrado.';
  end if;

  return jsonb_build_object('workshop_id', v_id, 'logo_url', v_url);
end;
$$;

create or replace function public.app_set_commerce_logo(p_logo_url text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_url text := nullif(btrim(coalesce(p_logo_url, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa para actualizar el logo.';
  end if;

  if v_url is not null and (char_length(v_url) > 2048 or v_url !~* '^https?://') then
    raise exception 'La URL del logo no es válida.';
  end if;

  update public.commerce_profiles
  set logo_url = v_url
  where owner_user_id = v_uid
  returning id into v_id;

  if v_id is null then
    raise exception 'Aún no tienes un comercio registrado.';
  end if;

  return jsonb_build_object('commerce_id', v_id, 'logo_url', v_url);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Escritura de logos de marcas: admin (sponsorships.manage) o creador de la
--    marca (flujo de registro). Se audit igual que el alta de patrocinios.
-- -----------------------------------------------------------------------------
create or replace function public.app_set_club_sponsor_logo(
  p_sponsor_id uuid,
  p_logo_url text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_url text := nullif(btrim(coalesce(p_logo_url, '')), '');
  v_sponsor public.club_sponsors%rowtype;
  v_allowed boolean;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa para actualizar el logo.';
  end if;

  if v_url is not null and (char_length(v_url) > 2048 or v_url !~* '^https?://') then
    raise exception 'La URL del logo no es válida.';
  end if;

  select * into v_sponsor
  from public.club_sponsors
  where id = p_sponsor_id;

  if not found then
    raise exception 'La marca patrocinadora no existe.';
  end if;

  v_allowed := public.admin_has_permission('sponsorships.manage')
    or v_sponsor.created_by = v_uid;

  if not v_allowed then
    raise exception 'No tienes permiso para actualizar el logo de esta marca.';
  end if;

  update public.club_sponsors
  set logo_url = v_url,
      updated_at = now()
  where id = p_sponsor_id;

  insert into public.admin_audit_logs (
    actor_id, action, module, entity_type, entity_id, before_data, after_data, metadata
  )
  values (
    v_uid,
    'sponsorships.brand.logo.update',
    'Patrocinios',
    'club_sponsor',
    p_sponsor_id::text,
    jsonb_build_object('logo_url', v_sponsor.logo_url),
    jsonb_build_object('logo_url', v_url),
    jsonb_build_object('source', 'logo_self_service')
  );

  return jsonb_build_object('id', p_sponsor_id, 'logo_url', v_url);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Impacto del patrocinio con logo visible en el perfil del negocio.
--    Cambia la firma de retorno: se recrea la función y se re-otorgan permisos.
-- -----------------------------------------------------------------------------
drop function if exists public.app_sponsor_impact();

create or replace function public.app_sponsor_impact()
returns table (
  sponsor_id uuid,
  brand_name text,
  logo_url text,
  benefit text,
  discount_percent numeric,
  group_name text,
  club_buyers integer,
  parts_orders integer,
  service_orders integer,
  total_orders integer,
  purchase_amount numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_commerce_id uuid;
  v_workshop_id uuid;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select cp.id into v_commerce_id
  from public.commerce_profiles cp
  where cp.owner_user_id = v_uid
  limit 1;

  select wp.id into v_workshop_id
  from public.workshop_profiles wp
  where wp.user_id = v_uid
  limit 1;

  return query
    select s.id, s.brand_name, s.logo_url, s.benefit, s.discount_percent, g.name,
           coalesce(m.club_buyers, 0),
           coalesce(m.parts_orders, 0),
           coalesce(m.service_orders, 0),
           coalesce(m.total_orders, 0),
           coalesce(m.purchase_amount, 0)
    from public.club_sponsors s
    left join public.groups g on g.id = s.group_id
    left join lateral public.club_sponsor_order_metrics(s.id) m on true
    where s.moderation_status = 'approved'
      and (
        s.created_by = v_uid
        or (s.commerce_id is not null and s.commerce_id = v_commerce_id)
        or (s.workshop_id is not null and s.workshop_id = v_workshop_id)
      )
    order by s.created_at desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Logos de marcas aprobadas vinculadas a un negocio (ofertas/productos)
-- -----------------------------------------------------------------------------
create or replace function public.app_business_brand_logos(
  p_workshop_id uuid,
  p_commerce_id uuid
)
returns table (
  id uuid,
  brand_name text,
  logo_url text,
  benefit text,
  discount_percent numeric
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select s.id, s.brand_name, s.logo_url, s.benefit, s.discount_percent
  from public.club_sponsors s
  where s.moderation_status = 'approved'
    and (
      (p_workshop_id is not null
        and s.workshop_id = p_workshop_id
        and exists (
          select 1 from public.workshop_profiles wp
          where wp.id = p_workshop_id and wp.is_verified = true
        ))
      or
      (p_commerce_id is not null
        and s.commerce_id = p_commerce_id
        and exists (
          select 1 from public.commerce_profiles cp
          where cp.id = p_commerce_id and cp.status = 'approved'
        ))
    )
    and (s.starts_on is null or s.starts_on <= current_date)
    and (s.ends_on is null or s.ends_on >= current_date)
  order by s.brand_name asc;
$$;

-- -----------------------------------------------------------------------------
-- 8. RLS: el negocio vinculado puede VER sus patrocinios aprobados.
--    Las escrituras siguen pasando por RPC con comprobación de propiedad.
-- -----------------------------------------------------------------------------
drop policy if exists club_sponsors_select_linked_business on public.club_sponsors;
create policy club_sponsors_select_linked_business on public.club_sponsors
  for select to authenticated
  using (
    moderation_status = 'approved'
    and (
      exists (
        select 1 from public.commerce_profiles cp
        where cp.id = club_sponsors.commerce_id
          and cp.owner_user_id = auth.uid()
      )
      or exists (
        select 1 from public.workshop_profiles wp
        where wp.id = club_sponsors.workshop_id
          and wp.user_id = auth.uid()
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 9. Permisos ( patrón SECURITY DEFINER + search_path del resto del proyecto )
-- -----------------------------------------------------------------------------
revoke all on function public.app_my_business_logos() from public;
revoke all on function public.app_set_workshop_logo(text) from public;
revoke all on function public.app_set_commerce_logo(text) from public;
revoke all on function public.app_set_club_sponsor_logo(uuid, text) from public;
revoke all on function public.app_sponsor_impact() from public;
revoke all on function public.app_business_brand_logos(uuid, uuid) from public;

grant execute on function public.app_my_business_logos() to authenticated;
grant execute on function public.app_set_workshop_logo(text) to authenticated;
grant execute on function public.app_set_commerce_logo(text) to authenticated;
grant execute on function public.app_set_club_sponsor_logo(uuid, text) to authenticated;
grant execute on function public.app_sponsor_impact() to authenticated;
grant execute on function public.app_business_brand_logos(uuid, uuid) to authenticated;
