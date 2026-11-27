-- Bloque 1: contador real de entregados y acceso consultable al historial.
--
-- El tablero de la bandeja deja de devolver `delivered = 0`: cuenta los hilos
-- realmente entregados (sales_stage = 'delivered', que ya converge con
-- ENTREGA_CONFIRMADA / recepción conforme / pedido entregado) sin devolverlos
-- a la bandeja activa. La nueva RPC de historial expone entregas, mensajes y
-- reseñas con un alcance explícito por rol: comprador, comercio/vendedor
-- afiliado activo y admin con permiso `chats.access_content`.
--
-- Idempotente: CREATE OR REPLACE / CREATE INDEX IF NOT EXISTS / grants fijos.
-- No se tocan `app_confirm_lifecycle_delivery` ni los triggers de archivado:
-- la confirmación sigue cerrando el chat activo y conservando la trazabilidad.

-- -----------------------------------------------------------------------------
-- Contadores reales de la bandeja + ids de entregas para abrir el historial
-- -----------------------------------------------------------------------------
create or replace function public.app_chat_stage_board()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_commerce_id uuid := public.app_lifecycle_current_commerce_id();
  v_buyer_id uuid := public.app_lifecycle_current_buyer_id();
  v_counts jsonb;
  v_stages jsonb;
  v_delivered_count bigint := 0;
  v_delivered_ids jsonb := '[]'::jsonb;
begin
  if v_commerce_id is null and v_buyer_id is null then
    return jsonb_build_object(
      'counts', jsonb_build_object('negotiating', 0, 'pending', 0, 'delivered', 0),
      'stages', '{}'::jsonb,
      'deliveredIds', '[]'::jsonb
    );
  end if;

  -- Activos: exactamente los mismos filtros de siempre, sin cambios de etapa.
  select jsonb_build_object(
    'negotiating', count(*) filter (where ct.sales_stage = 'negotiating'),
    'pending', count(*) filter (where ct.sales_stage = 'pending'),
    'delivered', 0
  )
  into v_counts
  from public.chat_threads ct
  where coalesce(ct.status, 'active') <> 'archived'
    and ct.sales_stage <> 'delivered'
    and (
      (v_commerce_id is not null and ct.commerce_id = v_commerce_id)
      or (v_commerce_id is null and ct.buyer_id = v_buyer_id)
    );

  select coalesce(jsonb_object_agg(ct.id::text, ct.sales_stage), '{}'::jsonb)
  into v_stages
  from public.chat_threads ct
  where coalesce(ct.status, 'active') <> 'archived'
    and ct.sales_stage <> 'delivered'
    and (
      (v_commerce_id is not null and ct.commerce_id = v_commerce_id)
      or (v_commerce_id is null and ct.buyer_id = v_buyer_id)
    );

  -- Entregados: se cuentan también los hilos archivados, que son el historial.
  select count(*),
         coalesce(
           jsonb_agg(ct.id::text order by coalesce(ct.delivery_confirmed_at, ct.updated_at, ct.created_at) desc),
           '[]'::jsonb
         )
  into v_delivered_count, v_delivered_ids
  from public.chat_threads ct
  where ct.sales_stage = 'delivered'
    and (
      (v_commerce_id is not null and ct.commerce_id = v_commerce_id)
      or (v_commerce_id is null and ct.buyer_id = v_buyer_id)
    );

  v_counts := jsonb_set(v_counts, '{delivered}', to_jsonb(v_delivered_count));

  return jsonb_build_object(
    'counts', v_counts,
    'stages', v_stages,
    'deliveredIds', v_delivered_ids
  );
end;
$$;

revoke all on function public.app_chat_stage_board() from public;
grant execute on function public.app_chat_stage_board() to authenticated;

-- -----------------------------------------------------------------------------
-- Historial consultable de entregas (comprador / comercio-vendedor / admin)
-- -----------------------------------------------------------------------------
create or replace function public.app_delivered_purchase_history(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_commerce_id uuid := public.app_lifecycle_current_commerce_id();
  v_buyer_id uuid := public.app_lifecycle_current_buyer_id();
  v_is_admin boolean := public.admin_has_permission('chats.access_content');
  v_cap integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
begin
  -- Alcance explícito: SECURITY DEFINER omite RLS, así que el filtro por rol
  -- va aquí y no se delega al cliente. Dueño y afiliado comparten comercio.
  select count(*)
  into v_total
  from public.chat_threads ct
  where ct.sales_stage = 'delivered'
    and (
      (v_commerce_id is not null and ct.commerce_id = v_commerce_id)
      or (v_commerce_id is null and v_buyer_id is not null and ct.buyer_id = v_buyer_id)
      or (v_is_admin and v_commerce_id is null and v_buyer_id is null)
    );

  with scoped as (
    select ct.*
    from public.chat_threads ct
    where ct.sales_stage = 'delivered'
      and (
        (v_commerce_id is not null and ct.commerce_id = v_commerce_id)
        or (v_commerce_id is null and v_buyer_id is not null and ct.buyer_id = v_buyer_id)
        or (v_is_admin and v_commerce_id is null and v_buyer_id is null)
      )
    order by coalesce(ct.delivery_confirmed_at, ct.updated_at, ct.created_at) desc
    limit v_cap
  ),
  enriched as (
    select
      s.id,
      s.subject,
      s.order_id,
      s.buyer_id,
      s.commerce_id,
      s.assigned_seller_id,
      s.assigned_seller_name,
      s.sales_stage,
      s.lifecycle_state,
      s.rating,
      s.review_comment,
      s.delivery_confirmed_at,
      s.delivered_on_time,
      s.last_message_at,
      o.order_number,
      o.total_amount,
      o.currency,
      o.status as order_status,
      coalesce(o.delivered_at, o.completed_at, s.delivery_confirmed_at) as delivered_at,
      o.placed_at,
      cp.trade_name as commerce_name,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'sender_type', m.sender_type,
                 'sender_name', m.sender_name,
                 'body', m.body,
                 'created_at', m.created_at
               ) order by m.created_at desc), '[]'::jsonb)
        from (
          select m2.*
          from public.chat_messages m2
          where m2.chat_id = s.id
          order by m2.created_at desc
          limit 6
        ) m
      ) as recent_messages,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', r.id,
                 'rating', r.rating,
                 'comment', r.comment,
                 'status', r.status,
                 'created_at', r.created_at
               ) order by r.created_at desc), '[]'::jsonb)
        from (
          select r2.*
          from public.commerce_reviews r2
          where (s.order_id is not null and r2.order_id = s.order_id)
             or (r2.buyer_id = s.buyer_id and r2.commerce_id = s.commerce_id)
          order by r2.created_at desc
          limit 3
        ) r
      ) as reviews
    from scoped s
    left join public.purchase_orders o on o.id = s.order_id
    left join public.commerce_profiles cp on cp.id = s.commerce_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'chat_id', e.id,
        'subject', e.subject,
        'order_id', e.order_id,
        'order_number', e.order_number,
        'total_amount', e.total_amount,
        'currency', coalesce(e.currency, 'MXN'),
        'order_status', e.order_status,
        'delivered_at', e.delivered_at,
        'delivery_confirmed_at', e.delivery_confirmed_at,
        'delivered_on_time', e.delivered_on_time,
        'placed_at', e.placed_at,
        'last_message_at', e.last_message_at,
        'commerce_id', e.commerce_id,
        'commerce_name', e.commerce_name,
        'buyer_id', e.buyer_id,
        'seller_id', e.assigned_seller_id,
        'seller_name', e.assigned_seller_name,
        'sales_stage', e.sales_stage,
        'lifecycle_state', e.lifecycle_state,
        'rating', e.rating,
        'review_comment', e.review_comment,
        'recent_messages', e.recent_messages,
        'reviews', e.reviews
      )
      order by coalesce(e.delivered_at, e.delivery_confirmed_at, e.last_message_at) desc nulls last
    ),
    '[]'::jsonb
  )
  into v_items
  from enriched e;

  return jsonb_build_object('items', v_items, 'total', v_total);
end;
$$;

revoke all on function public.app_delivered_purchase_history(integer) from public;
grant execute on function public.app_delivered_purchase_history(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Índices de lectura (idempotentes)
-- -----------------------------------------------------------------------------
create index if not exists chat_threads_buyer_sales_stage_idx
  on public.chat_threads (buyer_id, sales_stage);

create index if not exists chat_threads_delivered_history_idx
  on public.chat_threads (commerce_id, delivery_confirmed_at desc)
  where sales_stage = 'delivered';
