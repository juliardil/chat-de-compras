-- =============================================================================
-- Go.go · Corrección de métricas de impacto de patrocinios
--
-- Migración ADITIVA posterior a 20261117170000. No modifica tablas, RLS ni
-- permisos: solo reemplaza tres funciones de solo lectura para que
-- `total_orders` y `purchase_amount` dejen de devolver cero y para que el
-- resumen administrativo solo atribuya compras realmente vinculadas a la marca.
-- =============================================================================

-- Métrica compartida. Un pedido de repuestos se vincula por
-- purchase_orders.commerce_id; un servicio de taller se vincula por
-- purchase_offers.workshop_id (el pedido sigue apuntando a la oferta).
create or replace function public.club_sponsor_order_metrics(p_sponsor_id uuid)
returns table (
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
  v_sponsor public.club_sponsors%rowtype;
begin
  select * into v_sponsor
  from public.club_sponsors s
  where s.id = p_sponsor_id;

  if not found then
    return;
  end if;

  return query
    with members as (
      select distinct bp.id as buyer_id
      from public.group_members gm
      join public.buyer_profiles bp on bp.user_id = gm.user_id
      where v_sponsor.group_id is null or gm.group_id = v_sponsor.group_id
    ),
    attributed_orders as (
      select
        o.id,
        o.buyer_id,
        o.total_amount,
        case
          when v_sponsor.workshop_id is not null
               and off.workshop_id = v_sponsor.workshop_id then 'service'
          when v_sponsor.commerce_id is not null
               and o.commerce_id = v_sponsor.commerce_id then 'parts'
          else null
        end as order_kind
      from public.purchase_orders o
      left join public.purchase_offers off on off.id = o.offer_id
      where o.status in ('confirmed', 'preparing', 'shipped', 'delivered', 'completed')
        and o.buyer_id in (select buyer_id from members)
        and (
          (v_sponsor.commerce_id is not null and o.commerce_id = v_sponsor.commerce_id)
          or (v_sponsor.workshop_id is not null and off.workshop_id = v_sponsor.workshop_id)
        )
    )
    select
      count(distinct buyer_id)::integer,
      count(*) filter (where order_kind = 'parts')::integer,
      count(*) filter (where order_kind = 'service')::integer,
      count(*)::integer,
      coalesce(sum(total_amount), 0)::numeric
    from attributed_orders;
end;
$$;

-- Reporte que visualiza la marca vinculada al negocio del usuario.
create or replace function public.app_sponsor_impact()
returns table (
  sponsor_id uuid,
  brand_name text,
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
    select s.id, s.brand_name, g.name,
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

-- Visión financiera: el impacto comercial se limita a los pedidos atribuibles
-- a cada patrocinio, no a todas las compras de los miembros del club.
create or replace function public.admin_sponsorship_overview()
returns table (
  pending_brands integer,
  approved_brands integer,
  active_brands integer,
  expiring_brands integer,
  expired_brands integer,
  monthly_revenue numeric,
  one_time_revenue numeric,
  total_revenue numeric,
  groups_reached integer,
  buyers_reached integer,
  orders_attributed integer,
  purchase_amount numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.admin_has_permission('sponsorships.finance') then
    raise exception 'No tienes permiso para consultar la visión financiera de patrocinios.';
  end if;

  return query
    with lifecycle as (
      select s.id, s.group_id, s.amount, s.billing_cycle,
             public.club_sponsor_lifecycle(s.moderation_status, s.starts_on, s.ends_on) as status
      from public.club_sponsors s
    ),
    attributed as (
      select l.id as sponsor_id,
             coalesce(m.club_buyers, 0) as buyers,
             coalesce(m.total_orders, 0) as orders,
             coalesce(m.purchase_amount, 0) as amount
      from lifecycle l
      left join lateral public.club_sponsor_order_metrics(l.id) m on true
    )
    select
      (select count(*)::integer from public.club_sponsors s where s.moderation_status = 'pending'),
      (select count(*)::integer from public.club_sponsors s where s.moderation_status = 'approved'),
      (select count(*)::integer from lifecycle l where l.status = 'active'),
      (select count(*)::integer from lifecycle l where l.status = 'expiring'),
      (select count(*)::integer from lifecycle l where l.status = 'expired'),
      coalesce((select sum(l.amount) from lifecycle l
                where l.status in ('active', 'expiring', 'scheduled')
                  and l.billing_cycle = 'monthly'), 0),
      coalesce((select sum(l.amount) from lifecycle l
                where l.status in ('active', 'expiring', 'scheduled', 'expired')
                  and l.billing_cycle = 'one_time'), 0),
      coalesce((select sum(l.amount) from lifecycle l
                where l.status in ('active', 'expiring', 'scheduled', 'expired')), 0),
      (select count(distinct l.group_id)::integer from lifecycle l
       where l.group_id is not null and l.status in ('active', 'expiring', 'scheduled')),
      coalesce((select sum(a.buyers)::integer from attributed a), 0),
      coalesce((select sum(a.orders)::integer from attributed a), 0),
      coalesce((select sum(a.amount) from attributed a), 0);
end;
$$;

-- Reporte administrativo por marca con las mismas métricas reales.
create or replace function public.admin_sponsor_impact_report()
returns table (
  sponsor_id uuid,
  brand_name text,
  group_name text,
  moderation_status text,
  lifecycle_status text,
  club_buyers integer,
  parts_orders integer,
  service_orders integer,
  total_orders integer,
  purchase_amount numeric,
  amount numeric,
  billing_cycle text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.admin_has_permission('sponsorships.finance') then
    raise exception 'No tienes permiso para consultar el impacto comercial de patrocinios.';
  end if;

  return query
    select s.id, s.brand_name, g.name, s.moderation_status,
           public.club_sponsor_lifecycle(s.moderation_status, s.starts_on, s.ends_on),
           coalesce(m.club_buyers, 0),
           coalesce(m.parts_orders, 0),
           coalesce(m.service_orders, 0),
           coalesce(m.total_orders, 0),
           coalesce(m.purchase_amount, 0),
           s.amount,
           s.billing_cycle
    from public.club_sponsors s
    left join public.groups g on g.id = s.group_id
    left join lateral public.club_sponsor_order_metrics(s.id) m on true
    order by s.created_at desc;
end;
$$;

revoke all on function public.club_sponsor_order_metrics(uuid) from public;
grant execute on function public.club_sponsor_order_metrics(uuid) to authenticated;
