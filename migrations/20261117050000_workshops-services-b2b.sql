-- =============================================================================
-- Chat de Compras · Talleres Verificados (Fases 3 y 4)
--
-- Módulo NUEVO y aislado. Amplía purchase_requests / purchase_offers /
-- chat_threads SOLO con columnas aditivas y una relajación retrocompatible de
-- `purchase_offers.commerce_id` (necesaria para que un TALLER pueda cotizar sin
-- ser comercio). NO modifica ninguna política RLS existente, NO toca ofertas
-- actuales y NO cambia los INSERT que hoy hace la app.
--
-- Las propuestas de taller reutilizan purchase_offers y el chat actual: son
-- ofertas con `workshop_id` en lugar de `commerce_id`, creadas por RPC
-- SECURITY DEFINER porque la política de INSERT existente exige un comercio.
--
-- Se aplica con:
--   npx -y @insforge/cli db migrations up 20261117050000_workshops-services-b2b.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columnas aditivas (valores por defecto => retrocompatible)
-- -----------------------------------------------------------------------------
alter table public.purchase_requests
  add column if not exists service_zone text;

alter table public.purchase_offers
  add column if not exists workshop_id uuid null references public.workshop_profiles(id) on delete set null;

alter table public.purchase_offers
  add column if not exists labor_amount numeric;

alter table public.purchase_offers
  add column if not exists estimated_days integer;

alter table public.chat_threads
  add column if not exists workshop_id uuid null references public.workshop_profiles(id) on delete set null;

-- Los comercios siguen insertando exactamente igual. Esta relajación solo
-- permite que la RPC de propuestas de taller inserte una oferta sin comercio.
alter table public.purchase_offers alter column commerce_id drop not null;

create index if not exists purchase_offers_workshop_id_idx
  on public.purchase_offers (workshop_id)
  where workshop_id is not null;

-- Un taller cotiza una vez por solicitud de servicio.
create unique index if not exists purchase_offers_request_workshop_uidx
  on public.purchase_offers (request_id, workshop_id)
  where workshop_id is not null;

create index if not exists chat_threads_workshop_id_idx
  on public.chat_threads (workshop_id)
  where workshop_id is not null;

-- -----------------------------------------------------------------------------
-- Helper: id del taller verificado de la sesión
-- -----------------------------------------------------------------------------
create or replace function public.app_verified_workshop_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select wp.id
  from public.workshop_profiles wp
  where wp.user_id = auth.uid() and wp.is_verified = true
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Fase 3 · Bandeja de trabajos del taller
-- -----------------------------------------------------------------------------
create or replace function public.app_available_service_jobs()
returns table (
  id uuid,
  title text,
  description text,
  category text,
  vehicle_type text,
  vehicle_plate text,
  service_zone text,
  created_at timestamptz,
  client_user_id uuid,
  client_name text,
  client_is_club_member boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_workshop_id uuid := public.app_verified_workshop_id();
begin
  if v_workshop_id is null then
    raise exception 'Solo un Taller Verificado puede consultar los trabajos disponibles.';
  end if;

  return query
    select pr.id,
           pr.title,
           pr.description,
           pr.category,
           pr.vehicle_type,
           pr.vehicle_plate,
           pr.service_zone,
           pr.created_at,
           bp.user_id,
           coalesce(bp.display_name, u.email, 'Comprador'),
           exists (
             select 1
             from public.group_members gm
             where gm.user_id = bp.user_id
             group by gm.user_id
             having count(*) >= (
               select s.min_members from public.group_settings s where s.id = true
             )
           )
    from public.purchase_requests pr
    join public.buyer_profiles bp on bp.id = pr.buyer_id
    left join auth.users u on u.id = bp.user_id
    where pr.request_type = 'service'
      and pr.status = 'open'
      and not exists (
        select 1 from public.purchase_offers po
        where po.request_id = pr.id and po.workshop_id = v_workshop_id
      )
    order by pr.created_at desc
    limit 100;
end;
$$;

-- Propuestas ya enviadas por el taller (para ver su estado en la bandeja).
create or replace function public.app_my_service_proposals()
returns table (
  id uuid,
  request_id uuid,
  request_title text,
  labor_amount numeric,
  estimated_days integer,
  notes text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_workshop_id uuid := public.app_verified_workshop_id();
begin
  if v_workshop_id is null then
    raise exception 'Solo un Taller Verificado puede consultar sus propuestas.';
  end if;

  return query
    select po.id, po.request_id, pr.title, po.labor_amount, po.estimated_days,
           po.conditions, po.status, po.created_at
    from public.purchase_offers po
    join public.purchase_requests pr on pr.id = po.request_id
    where po.workshop_id = v_workshop_id
    order by po.created_at desc
    limit 100;
end;
$$;

-- Cotización del taller: precio de mano de obra, tiempo estimado y notas.
-- Reutiliza purchase_offers, de modo que el comprador la vea con sus ofertas.
create or replace function public.app_create_service_proposal(
  p_request_id uuid,
  p_labor_amount numeric,
  p_estimated_days integer,
  p_notes text default null
)
returns table (
  id uuid,
  request_id uuid,
  labor_amount numeric,
  estimated_days integer,
  notes text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_workshop_id uuid := public.app_verified_workshop_id();
  v_amount numeric := round(coalesce(p_labor_amount, 0)::numeric, 2);
  v_days integer := coalesce(p_estimated_days, 0);
  v_notes text := btrim(coalesce(p_notes, ''));
  v_existing_id uuid;
  v_now timestamptz := now();
begin
  if v_workshop_id is null then
    raise exception 'Solo un Taller Verificado puede enviar propuestas.';
  end if;
  if not exists (
    select 1 from public.purchase_requests pr
    where pr.id = p_request_id and pr.request_type = 'service' and pr.status = 'open'
  ) then
    raise exception 'La solicitud de servicio ya no está disponible.';
  end if;
  if v_amount <= 0 then
    raise exception 'Indica un precio de mano de obra mayor a cero.';
  end if;
  if v_days < 1 or v_days > 365 then
    raise exception 'El tiempo estimado debe estar entre 1 y 365 días.';
  end if;
  if char_length(v_notes) > 1000 then
    raise exception 'Las notas no pueden superar los 1000 caracteres.';
  end if;

  select po.id into v_existing_id
  from public.purchase_offers po
  where po.request_id = p_request_id and po.workshop_id = v_workshop_id
  limit 1;

  if v_existing_id is not null then
    update public.purchase_offers po
    set total_amount = v_amount,
        labor_amount = v_amount,
        delivery_days = v_days,
        estimated_days = v_days,
        conditions = v_notes,
        items = jsonb_build_array(
          jsonb_build_object(
            'name', 'Mano de obra',
            'quantity', 1,
            'unitPrice', v_amount,
            'totalPrice', v_amount,
            'status', 'available'
          )
        ),
        updated_at = v_now
    where po.id = v_existing_id
      and po.status in ('active', 'flagged');
  else
    insert into public.purchase_offers (
      request_id, commerce_id, workshop_id, total_amount, currency,
      delivery_days, labor_amount, estimated_days, items, conditions, status
    )
    values (
      p_request_id, null, v_workshop_id, v_amount, 'MXN',
      v_days, v_amount, v_days,
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Mano de obra',
          'quantity', 1,
          'unitPrice', v_amount,
          'totalPrice', v_amount,
          'status', 'available'
        )
      ),
      v_notes, 'active'
    );
  end if;

  return query
    select po.id, po.request_id, po.labor_amount, po.estimated_days,
           po.conditions, po.status, po.created_at
    from public.purchase_offers po
    where po.request_id = p_request_id and po.workshop_id = v_workshop_id;
end;
$$;

-- Abre (o reutiliza) el chat de una propuesta de taller. Usa el mismo
-- chat_threads / chat_messages que ya consume la pantalla /chat/:id.
create or replace function public.app_open_workshop_offer_chat(p_offer_id uuid)
returns table (id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.purchase_offers%rowtype;
  v_buyer_id uuid;
  v_buyer_profile_id uuid;
  v_thread_id uuid;
  v_subject text;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select * into v_offer
  from public.purchase_offers po
  where po.id = p_offer_id and po.workshop_id is not null;

  if not found then
    raise exception 'La propuesta de taller no existe.';
  end if;

  select pr.buyer_id into v_buyer_id
  from public.purchase_requests pr
  where pr.id = v_offer.request_id;

  select bp.id into v_buyer_profile_id
  from public.buyer_profiles bp
  where bp.id = v_buyer_id;

  -- Solo el comprador de la solicitud o el taller que cotizó pueden abrirlo.
  if not (
    exists (select 1 from public.buyer_profiles bp where bp.id = v_buyer_id and bp.user_id = v_uid)
    or exists (
      select 1 from public.workshop_profiles wp
      where wp.id = v_offer.workshop_id and wp.user_id = v_uid
    )
  ) then
    raise exception 'No tienes acceso a esta conversación.';
  end if;

  select coalesce(wp.workshop_name, 'Taller Verificado') into v_subject
  from public.workshop_profiles wp
  where wp.id = v_offer.workshop_id;

  select ct.id into v_thread_id
  from public.chat_threads ct
  where ct.offer_id = p_offer_id and ct.workshop_id = v_offer.workshop_id
  order by ct.created_at desc
  limit 1;

  if v_thread_id is null then
    insert into public.chat_threads (
      buyer_id, commerce_id, workshop_id, offer_id, subject,
      status, selected_offer_items
    )
    values (
      v_buyer_profile_id, null, v_offer.workshop_id, p_offer_id, v_subject,
      'active', '[]'::jsonb
    )
    returning id into v_thread_id;
  end if;

  return query select v_thread_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fase 4 · Beneficios B2B
-- -----------------------------------------------------------------------------
-- Insignia para el vendedor. Recibe ids de buyer_profiles (tal como vienen en
-- purchase_requests.buyer_id) y nunca expone NIT, dirección ni datos fiscales.
create or replace function public.app_workshop_b2b_badges(p_buyer_ids uuid[])
returns table (buyer_id uuid, workshop_name text, is_verified boolean)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select bp.id, wp.workshop_name, true
  from public.buyer_profiles bp
  join public.workshop_profiles wp on wp.user_id = bp.user_id
  where bp.id = any(coalesce(p_buyer_ids, '{}'::uuid[]))
    and wp.is_verified = true;
$$;

-- Historial por placa del taller autenticado. Incluye todas sus solicitudes
-- (con placa) y un resumen de las cotizaciones recibidas.
create or replace function public.app_workshop_plate_history(p_plate text default null)
returns table (
  id uuid,
  title text,
  request_type text,
  vehicle_plate text,
  status text,
  created_at timestamptz,
  offer_count integer,
  accepted_total numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_workshop_id uuid := public.app_verified_workshop_id();
  v_plate text := upper(btrim(coalesce(p_plate, '')));
begin
  if v_workshop_id is null then
    raise exception 'Solo un Taller Verificado puede consultar su historial.';
  end if;

  return query
    select pr.id, pr.title, pr.request_type, pr.vehicle_plate, pr.status, pr.created_at,
           (select count(*)::integer from public.purchase_offers po where po.request_id = pr.id),
           (select sum(po.total_amount) from public.purchase_offers po
            where po.request_id = pr.id and po.status = 'accepted')
    from public.purchase_requests pr
    join public.buyer_profiles bp on bp.id = pr.buyer_id
    where bp.user_id = auth.uid()
      and pr.vehicle_plate is not null
      and (v_plate = '' or upper(pr.vehicle_plate) like '%' || v_plate || '%')
    order by pr.created_at desc
    limit 200;
end;
$$;

-- -----------------------------------------------------------------------------
-- Panel de administración: talleres verificados
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_workshops(p_search text default null)
returns table (
  id uuid,
  workshop_name text,
  nit_or_id text,
  address text,
  phone text,
  specialties text[],
  is_verified boolean,
  created_at timestamptz,
  owner_name text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_term text := lower(btrim(coalesce(p_search, '')));
begin
  if not public.admin_has_permission('workshops.view') then
    raise exception 'No tienes permiso para ver los talleres verificados.';
  end if;

  return query
    select wp.id, wp.workshop_name, wp.nit_or_id, wp.address, wp.phone,
           wp.specialties, wp.is_verified, wp.created_at,
           coalesce(bp.display_name, u.email, wp.user_id::text)
    from public.workshop_profiles wp
    left join public.buyer_profiles bp on bp.user_id = wp.user_id
    left join auth.users u on u.id = wp.user_id
    where v_term = ''
       or lower(wp.workshop_name) like '%' || v_term || '%'
       or lower(wp.nit_or_id) like '%' || v_term || '%'
       or lower(wp.address) like '%' || v_term || '%'
       or lower(wp.phone) like '%' || v_term || '%'
       or exists (
         select 1 from unnest(wp.specialties) s
         where lower(s) like '%' || v_term || '%'
       )
       or lower(coalesce(bp.display_name, u.email, '')) like '%' || v_term || '%'
    order by wp.created_at desc;
end;
$$;

create or replace function public.admin_set_workshop_verification(
  p_workshop_id uuid,
  p_is_verified boolean
)
returns table (id uuid, workshop_name text, is_verified boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_before boolean;
  v_name text;
begin
  if not public.admin_has_permission('workshops.verify') then
    raise exception 'No tienes permiso para cambiar la verificación de talleres.';
  end if;
  if p_workshop_id is null or p_is_verified is null then
    raise exception 'La solicitud de verificación no es válida.';
  end if;

  select wp.is_verified, wp.workshop_name
  into v_before, v_name
  from public.workshop_profiles wp
  where wp.id = p_workshop_id
  for update;

  if not found then
    raise exception 'El taller no existe.';
  end if;

  update public.workshop_profiles wp
  set is_verified = p_is_verified
  where wp.id = p_workshop_id;

  insert into public.admin_audit_logs (
    actor_id, action, module, entity_type, entity_id, after_data, metadata
  )
  values (
    auth.uid(),
    case when p_is_verified then 'workshops.verify' else 'workshops.revoke' end,
    'Talleres Verificados',
    'workshop_profile',
    p_workshop_id::text,
    jsonb_build_object('is_verified', p_is_verified),
    jsonb_build_object('workshop_name', v_name, 'previous_is_verified', v_before)
  );

  return query
    select wp.id, wp.workshop_name, wp.is_verified
    from public.workshop_profiles wp
    where wp.id = p_workshop_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos del panel admin (tablas propias ya existentes, sin tocar las de app)
-- -----------------------------------------------------------------------------
insert into public.admin_permissions (key, module, action, label, is_sensitive) values
  ('workshops.view', 'Talleres Verificados', 'view', 'Ver talleres verificados', false),
  ('workshops.verify', 'Talleres Verificados', 'verify', 'Activar o revocar verificación de talleres', true)
on conflict (key) do update
  set module = excluded.module,
      action = excluded.action,
      label = excluded.label,
      is_sensitive = excluded.is_sensitive;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p
  on p.key in ('workshops.view', 'workshops.verify')
where r.key in ('superadmin', 'admin', 'commerce_manager')
  and not exists (
    select 1
    from public.admin_role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.key = 'workshops.view'
where r.key in ('moderator', 'support', 'analyst')
  and not exists (
    select 1
    from public.admin_role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

-- -----------------------------------------------------------------------------
-- Grants (mismo patrón del proyecto: execute a authenticated, control en RPC)
-- -----------------------------------------------------------------------------
revoke all on function public.app_verified_workshop_id() from public;
revoke all on function public.app_available_service_jobs() from public;
revoke all on function public.app_my_service_proposals() from public;
revoke all on function public.app_create_service_proposal(uuid, numeric, integer, text) from public;
revoke all on function public.app_open_workshop_offer_chat(uuid) from public;
revoke all on function public.app_workshop_b2b_badges(uuid[]) from public;
revoke all on function public.app_workshop_plate_history(text) from public;
revoke all on function public.admin_list_workshops(text) from public;
revoke all on function public.admin_set_workshop_verification(uuid, boolean) from public;

grant execute on function public.app_verified_workshop_id() to authenticated;
grant execute on function public.app_available_service_jobs() to authenticated;
grant execute on function public.app_my_service_proposals() to authenticated;
grant execute on function public.app_create_service_proposal(uuid, numeric, integer, text) to authenticated;
grant execute on function public.app_open_workshop_offer_chat(uuid) to authenticated;
grant execute on function public.app_workshop_b2b_badges(uuid[]) to authenticated;
grant execute on function public.app_workshop_plate_history(text) to authenticated;
grant execute on function public.admin_list_workshops(text) to authenticated;
grant execute on function public.admin_set_workshop_verification(uuid, boolean) to authenticated;
