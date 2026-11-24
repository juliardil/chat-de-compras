-- Administración global de vendedores afiliados.
--
-- Las lecturas y escrituras pasan por RPC SECURITY DEFINER con validación de
-- permisos en servidor: la RLS de commerce_members solo autoriza al dueño del
-- comercio o al propio miembro, así que el panel administrativo no la relaja.
-- Las métricas son aditivas: solo consultan columnas de atribución ya creadas
-- por las migraciones de cuentas de vendedores; no reescriben ningún flujo.

-- -----------------------------------------------------------------------------
-- Permisos del módulo
-- -----------------------------------------------------------------------------
insert into public.admin_permissions (key, module, action, label, is_sensitive) values
  ('sellers.view', 'Vendedores', 'view', 'Ver vendedores afiliados y sus ventas', false),
  ('sellers.manage', 'Vendedores', 'manage', 'Activar o desactivar vendedores afiliados', true)
on conflict (key) do update
  set module = excluded.module,
      action = excluded.action,
      label = excluded.label,
      is_sensitive = excluded.is_sensitive;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p
  on p.key in ('sellers.view', 'sellers.manage')
where r.key in ('superadmin', 'admin', 'commerce_manager')
  and not exists (
    select 1
    from public.admin_role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p
  on p.key = 'sellers.view'
where r.key in ('moderator', 'analyst')
  and not exists (
    select 1
    from public.admin_role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

-- -----------------------------------------------------------------------------
-- Listado global con métricas disponibles
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_sellers(p_search text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_term text := lower(btrim(coalesce(p_search, '')));
begin
  if not public.admin_has_permission('sellers.view') then
    raise exception 'No autorizado para ver los vendedores afiliados.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'membership_id', m.id,
        'user_id', m.user_id,
        'full_name', m.full_name,
        'email', m.email,
        'commerce_id', m.commerce_id,
        'commerce_name', coalesce(cp.trade_name, 'Comercio sin nombre'),
        'avatar_url', m.avatar_url,
        'role', m.role,
        'is_active', m.is_active,
        'joined_at', m.created_at,
        'offers_sent', (
          select count(*)::integer
          from public.purchase_offers po
          where po.commerce_id = m.commerce_id and po.created_by_user_id = m.user_id
        ),
        'sales_closed', (
          select count(*)::integer
          from public.purchase_orders o
          where o.commerce_id = m.commerce_id and o.sold_by_user_id = m.user_id
        ),
        'sales_amount', coalesce((
          select sum(o.total_amount)
          from public.purchase_orders o
          where o.commerce_id = m.commerce_id and o.sold_by_user_id = m.user_id
        ), 0),
        'rating', (
          select avg(ct.rating::numeric)
          from public.chat_threads ct
          where ct.commerce_id = m.commerce_id
            and ct.assigned_seller_id = m.user_id
            and ct.rating is not null
        ),
        'chat_count', (
          select count(*)::integer
          from public.chat_threads ct
          where ct.commerce_id = m.commerce_id and ct.assigned_seller_id = m.user_id
        ),
        'message_count', (
          select count(*)::integer
          from public.chat_messages cm
          join public.chat_threads ct on ct.id = cm.chat_id
          where ct.commerce_id = m.commerce_id and ct.assigned_seller_id = m.user_id
        )
      )
      order by case when m.role = 'owner' then 0 else 1 end, m.created_at desc
    )
    from public.commerce_members m
    left join public.commerce_profiles cp on cp.id = m.commerce_id
    where v_term = ''
       or lower(m.full_name) like '%' || v_term || '%'
       or lower(m.email) like '%' || v_term || '%'
       or lower(coalesce(cp.trade_name, '')) like '%' || v_term || '%'
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- Detalle: ventas, chats y (solo con permiso de contenido) últimos mensajes
-- -----------------------------------------------------------------------------
create or replace function public.admin_get_seller_detail(p_membership_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_member public.commerce_members%rowtype;
  v_commerce_name text;
  v_can_read_content boolean := public.admin_has_permission('chats.access_content');
  v_seller jsonb;
  v_sales jsonb;
  v_chats jsonb;
begin
  if not public.admin_has_permission('sellers.view') then
    raise exception 'No autorizado para ver el detalle de los vendedores.' using errcode = '42501';
  end if;

  select * into v_member
  from public.commerce_members
  where id = p_membership_id;

  if not found then
    raise exception 'El vendedor afiliado no existe.';
  end if;

  select cp.trade_name into v_commerce_name
  from public.commerce_profiles cp
  where cp.id = v_member.commerce_id;

  v_seller := jsonb_build_object(
    'membership_id', v_member.id,
    'user_id', v_member.user_id,
    'full_name', v_member.full_name,
    'email', v_member.email,
    'commerce_id', v_member.commerce_id,
    'commerce_name', coalesce(v_commerce_name, 'Comercio sin nombre'),
    'avatar_url', v_member.avatar_url,
    'role', v_member.role,
    'is_active', v_member.is_active,
    'joined_at', v_member.created_at,
    'offers_sent', (
      select count(*)::integer
      from public.purchase_offers po
      where po.commerce_id = v_member.commerce_id and po.created_by_user_id = v_member.user_id
    ),
    'sales_closed', (
      select count(*)::integer
      from public.purchase_orders o
      where o.commerce_id = v_member.commerce_id and o.sold_by_user_id = v_member.user_id
    ),
    'sales_amount', coalesce((
      select sum(o.total_amount)
      from public.purchase_orders o
      where o.commerce_id = v_member.commerce_id and o.sold_by_user_id = v_member.user_id
    ), 0),
    'rating', (
      select avg(ct.rating::numeric)
      from public.chat_threads ct
      where ct.commerce_id = v_member.commerce_id
        and ct.assigned_seller_id = v_member.user_id
        and ct.rating is not null
    )
  );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'order_id', o.id,
      'order_number', o.order_number,
      'status', o.status,
      'total_amount', o.total_amount,
      'currency', o.currency,
      'buyer_name', coalesce(bp.display_name, 'Comprador'),
      'placed_at', o.placed_at,
      'completed_at', o.completed_at
    )
    order by o.created_at desc
  ), '[]'::jsonb)
  into v_sales
  from public.purchase_orders o
  left join public.buyer_profiles bp on bp.id = o.buyer_id
  where o.commerce_id = v_member.commerce_id
    and o.sold_by_user_id = v_member.user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'chat_id', ct.id,
      'subject', ct.subject,
      'status', ct.status,
      'buyer_name', coalesce(bp.display_name, 'Comprador'),
      'rating', ct.rating,
      'created_at', ct.created_at,
      'last_message_at', ct.last_message_at,
      'message_count', (
        select count(*)::integer
        from public.chat_messages cm
        where cm.chat_id = ct.id
      ),
      'messages', case
        when v_can_read_content then coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', latest.id,
              'sender_type', latest.sender_type,
              'sender_name', latest.sender_name,
              'body', latest.body,
              'created_at', latest.created_at
            )
            order by latest.created_at desc
          )
          from (
            select cm.id, cm.sender_type, cm.sender_name, cm.body, cm.created_at
            from public.chat_messages cm
            where cm.chat_id = ct.id
            order by cm.created_at desc
            limit 3
          ) latest
        ), '[]'::jsonb)
        else '[]'::jsonb
      end
    )
    order by ct.created_at desc
  ), '[]'::jsonb)
  into v_chats
  from public.chat_threads ct
  left join public.buyer_profiles bp on bp.id = ct.buyer_id
  where ct.commerce_id = v_member.commerce_id
    and ct.assigned_seller_id = v_member.user_id;

  return jsonb_build_object(
    'seller', v_seller,
    'sales', v_sales,
    'chats', v_chats,
    'contentUnlocked', v_can_read_content
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Cambio de estado auditado (solo vendedores; los dueños no se desactivan aquí)
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_seller_active(
  p_membership_id uuid,
  p_is_active boolean,
  p_reason text default null,
  p_reason_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_member public.commerce_members%rowtype;
  v_commerce_name text;
begin
  if not public.admin_has_permission('sellers.manage') then
    raise exception 'No autorizado para cambiar el estado de los vendedores.' using errcode = '42501';
  end if;

  if p_is_active is null then
    raise exception 'El estado del vendedor es obligatorio.';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo es obligatorio.';
  end if;

  select * into v_member
  from public.commerce_members
  where id = p_membership_id
  for update;

  if not found then
    raise exception 'El vendedor afiliado no existe.';
  end if;

  if v_member.role <> 'seller' then
    raise exception 'Solo se puede cambiar el estado de vendedores afiliados.' using errcode = '42501';
  end if;

  select cp.trade_name into v_commerce_name
  from public.commerce_profiles cp
  where cp.id = v_member.commerce_id;

  if v_member.is_active = p_is_active then
    return jsonb_build_object(
      'id', v_member.id,
      'is_active', v_member.is_active,
      'full_name', v_member.full_name
    );
  end if;

  update public.commerce_members
  set is_active = p_is_active
  where id = v_member.id;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text,
    before_data, after_data, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    case when p_is_active then 'sellers.activate' else 'sellers.deactivate' end,
    'Vendedores', 'commerce_member', v_member.id::text,
    p_reason_code, btrim(p_reason),
    jsonb_build_object('is_active', v_member.is_active),
    jsonb_build_object('is_active', p_is_active),
    jsonb_build_object(
      'email', v_member.email,
      'commerceName', coalesce(v_commerce_name, ''),
      'previousIsActive', v_member.is_active,
      'newIsActive', p_is_active
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = public.admin_current_user_id();

  return jsonb_build_object(
    'id', v_member.id,
    'is_active', p_is_active,
    'full_name', v_member.full_name
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Superficie ejecutable: solo sesiones autenticadas y con permiso validado
-- -----------------------------------------------------------------------------
revoke all on function public.admin_list_sellers(text) from public;
revoke all on function public.admin_get_seller_detail(uuid) from public;
revoke all on function public.admin_set_seller_active(uuid, boolean, text, text) from public;

grant execute on function public.admin_list_sellers(text) to authenticated;
grant execute on function public.admin_get_seller_detail(uuid) to authenticated;
grant execute on function public.admin_set_seller_active(uuid, boolean, text, text) to authenticated;
