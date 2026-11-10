-- =============================================================================
-- Chat de Compras · Administrador · Fase 5
-- Analítica y pagos: informes agregados, libro interno de movimientos,
-- liquidaciones, exportaciones auditadas y búsqueda global de metadatos.
--
-- IMPORTANTE:
--   * Este archivo NO se ha ejecutado. Se aplica después de las Fases 1 a 4:
--       npx @insforge/cli db migrations up --all
--   * Requiere 20261106000000_admin-foundation.sql,
--     20261106010000_people-catalog.sql,
--     20261106020000_operations.sql y
--     20261106030000_trust-care.sql aplicadas.
--   * No contiene datos de negocio ni secretos: solo esquema, funciones, RLS y
--     privilegios. No hay semillas de negocio en esta migración.
--   * NO existe pasarela de pagos conectada. Esta fase no cobra, no reembolsa
--     y no transfiere dinero: define el libro interno de movimientos y su
--     única mutación operativa, la conciliación manual auditada. Las tablas se
--     llenarán desde una integración futura con una pasarela real.
--   * La analítica solo expone agregados sin datos personales. Cada
--     exportación de analítica o de auditoría queda registrada en la
--     auditoría.
--   * La búsqueda global devuelve únicamente metadatos permitidos por los
--     permisos del actor; nunca indexa el cuerpo de los mensajes de chat.
--   * Las máquinas de estados son POLÍTICA DE IMPLEMENTACIÓN de esta fase y
--     deben confirmarse con el negocio. El servidor y la demo aplican las
--     mismas reglas.
--   * El acceso directo a las tablas queda revocado: todo pasa por funciones
--     SECURITY DEFINER con comprobación de permisos y auditoría.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.purchase_orders(id) on delete set null,
  buyer_id uuid references public.buyer_profiles(id) on delete set null,
  commerce_id uuid references public.commerce_profiles(id) on delete set null,
  provider text not null default 'none'
    check (provider in ('none', 'stripe', 'mercado_pago')),
  provider_reference text,
  method text not null default 'none'
    check (method in ('card', 'transfer', 'cash', 'wallet', 'none')),
  status text not null default 'pending'
    check (status in (
      'pending', 'authorized', 'paid',
      'partially_refunded', 'refunded', 'failed', 'cancelled'
    )),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  currency text not null default 'USD',
  commission_amount numeric(12, 2) not null default 0 check (commission_amount >= 0),
  net_amount numeric(12, 2) not null default 0 check (net_amount >= 0),
  refunded_amount numeric(12, 2) not null default 0 check (refunded_amount >= 0),
  failure_reason text,
  reconciled boolean not null default false,
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users(id) on delete set null,
  reconciled_by_name text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (refunded_amount <= amount)
);

create table if not exists public.payment_payouts (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid references public.commerce_profiles(id) on delete set null,
  period_start timestamptz not null default now(),
  period_end timestamptz not null default now(),
  gross_amount numeric(12, 2) not null default 0 check (gross_amount >= 0),
  commission_amount numeric(12, 2) not null default 0 check (commission_amount >= 0),
  net_amount numeric(12, 2) not null default 0 check (net_amount >= 0),
  currency text not null default 'USD',
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'paid', 'failed')),
  provider text not null default 'none'
    check (provider in ('none', 'stripe', 'mercado_pago')),
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_transactions_status_idx on public.payment_transactions (status);
create index if not exists payment_transactions_order_idx on public.payment_transactions (order_id);
create index if not exists payment_transactions_commerce_idx on public.payment_transactions (commerce_id);
create index if not exists payment_transactions_reconciliation_idx on public.payment_transactions (reconciled) where reconciled = false;
create index if not exists payment_transactions_created_idx on public.payment_transactions (created_at desc);
create index if not exists payment_payouts_status_idx on public.payment_payouts (status);
create index if not exists payment_payouts_commerce_idx on public.payment_payouts (commerce_id);

-- -----------------------------------------------------------------------------
-- Helpers de política (misma política que la demo; pendiente de confirmar)
-- -----------------------------------------------------------------------------
create or replace function public.admin_payment_is_reconcilable(p_status text)
returns boolean
language sql
immutable
as $$
  select p_status in ('paid', 'partially_refunded', 'refunded');
$$;

create or replace function public.admin_payment_counts_as_collected(p_status text)
returns boolean
language sql
immutable
as $$
  select p_status in ('paid', 'partially_refunded', 'refunded');
$$;

create or replace function public.admin_payment_status_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'pending' then 'Pendiente'
    when 'authorized' then 'Autorizado'
    when 'paid' then 'Cobrado'
    when 'partially_refunded' then 'Reembolso parcial'
    when 'refunded' then 'Reembolsado'
    when 'failed' then 'Fallido'
    when 'cancelled' then 'Cancelado'
    else p_status
  end;
$$;

create or replace function public.admin_payment_method_label(p_method text)
returns text
language sql
immutable
as $$
  select case p_method
    when 'card' then 'Tarjeta'
    when 'transfer' then 'Transferencia'
    when 'cash' then 'Efectivo'
    when 'wallet' then 'Billetera'
    else 'Sin definir'
  end;
$$;

create or replace function public.admin_payment_provider_label(p_provider text)
returns text
language sql
immutable
as $$
  select case p_provider
    when 'stripe' then 'Stripe'
    when 'mercado_pago' then 'Mercado Pago'
    else 'Sin pasarela'
  end;
$$;

create or replace function public.admin_payout_status_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'pending' then 'Pendiente'
    when 'scheduled' then 'Programada'
    when 'paid' then 'Liquidada'
    when 'failed' then 'Fallida'
    else p_status
  end;
$$;

-- Enmascarado de correo para la búsqueda global de actores sin users.view_pii.
create or replace function public.admin_mask_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or length(trim(p_email)) = 0 then '—'
    when position('@' in p_email) <= 1 then '••••'
    else left(p_email, 1) || '***' || substr(p_email, position('@' in p_email))
  end;
$$;

-- Codificación mínima para rutas de la búsqueda global: conserva letras,
-- números y guiones; los espacios se convierten en «+» y el resto se descarta.
create or replace function public.admin_url_encode(p_text text)
returns text
language sql
immutable
as $$
  select coalesce(
    regexp_replace(
      regexp_replace(coalesce(p_text, ''), '[^a-zA-Z0-9\-_.~ ]', '', 'g'),
      ' ',
      '+',
      'g'
    ),
    ''
  );
$$;

-- Presentación normalizada de un movimiento del libro interno.
create or replace function public.admin_payment_summary(p_payment public.payment_transactions)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p_payment.id,
    'orderId', p_payment.order_id,
    'orderNumber', o.order_number,
    'orderStatus', o.status,
    'buyerId', p_payment.buyer_id,
    'buyerName', buyer.display_name,
    'commerceId', p_payment.commerce_id,
    'commerceName', commerce.trade_name,
    'provider', p_payment.provider,
    'providerLabel', public.admin_payment_provider_label(p_payment.provider),
    'providerReference', p_payment.provider_reference,
    'method', p_payment.method,
    'methodLabel', public.admin_payment_method_label(p_payment.method),
    'status', p_payment.status,
    'statusLabel', public.admin_payment_status_label(p_payment.status),
    'amount', p_payment.amount,
    'currency', p_payment.currency,
    'commissionAmount', p_payment.commission_amount,
    'netAmount', p_payment.net_amount,
    'refundedAmount', p_payment.refunded_amount,
    'failureReason', p_payment.failure_reason,
    'reconciled', p_payment.reconciled,
    'reconciledAt', p_payment.reconciled_at,
    'reconciledByName', p_payment.reconciled_by_name,
    'paidAt', p_payment.paid_at,
    'metadata', p_payment.metadata,
    'simulated', false,
    'countsAsCollected', public.admin_payment_counts_as_collected(p_payment.status),
    'reconcilable', public.admin_payment_is_reconcilable(p_payment.status),
    'gatewayConnected', false,
    'createdAt', p_payment.created_at,
    'updatedAt', p_payment.updated_at
  )
  from public.payment_transactions pt
  left join public.purchase_orders o on o.id = p_payment.order_id
  left join public.buyer_profiles buyer on buyer.id = p_payment.buyer_id
  left join public.commerce_profiles commerce on commerce.id = p_payment.commerce_id
  where pt.id = p_payment.id;
$$;

create or replace function public.admin_payout_summary(p_payout public.payment_payouts)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p_payout.id,
    'commerceId', p_payout.commerce_id,
    'commerceName', commerce.trade_name,
    'periodStart', p_payout.period_start,
    'periodEnd', p_payout.period_end,
    'grossAmount', p_payout.gross_amount,
    'commissionAmount', p_payout.commission_amount,
    'netAmount', p_payout.net_amount,
    'currency', p_payout.currency,
    'status', p_payout.status,
    'statusLabel', public.admin_payout_status_label(p_payout.status),
    'provider', p_payout.provider,
    'providerReference', p_payout.provider_reference,
    'paidAt', p_payout.paid_at,
    'simulated', false,
    'gatewayConnected', false,
    'createdAt', p_payout.created_at,
    'updatedAt', p_payout.updated_at
  )
  from public.payment_payouts pp
  left join public.commerce_profiles commerce on commerce.id = p_payout.commerce_id
  where pp.id = p_payout.id;
$$;

-- -----------------------------------------------------------------------------
-- Analítica agregada (sin datos personales)
-- -----------------------------------------------------------------------------
create or replace function public.admin_analytics_report(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_start timestamptz := date_trunc('day', now()) - make_interval(days => v_days - 1);
  v_end timestamptz := now();
  v_collected jsonb;
  v_summary jsonb;
  v_series jsonb;
  v_method_mix jsonb;
  v_top_commerces jsonb;
begin
  if not public.admin_has_permission('analytics.view') then
    raise exception 'No autorizado para ver la analítica.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'gmv', coalesce(sum(p.amount), 0),
    'commissionRevenue', coalesce(sum(p.commission_amount), 0),
    'netToCommerces', coalesce(sum(p.net_amount), 0),
    'refundedAmount', coalesce(sum(p.refunded_amount), 0),
    'payments', (
      select count(*) from public.payment_transactions p2
      where coalesce(p2.paid_at, p2.created_at) >= v_start
    ),
    'collectedPayments', count(*),
    'unreconciledPayments', (
      select count(*) from public.payment_transactions p3
      where public.admin_payment_is_reconcilable(p3.status) and not p3.reconciled
    ),
    'orders', (select count(*) from public.purchase_orders o where o.placed_at >= v_start),
    'completedOrders', (
      select count(*) from public.purchase_orders o
      where o.placed_at >= v_start and o.status = 'completed'
    ),
    'disputedOrders', (
      select count(*) from public.purchase_orders o
      where o.placed_at >= v_start and o.status = 'disputed'
    ),
    'cancelledOrders', (
      select count(*) from public.purchase_orders o
      where o.placed_at >= v_start and o.status = 'cancelled'
    ),
    'orderVolume', (
      select coalesce(sum(o.total_amount), 0) from public.purchase_orders o
      where o.placed_at >= v_start
    )
  )
  into v_summary
  from public.payment_transactions p
  where public.admin_payment_counts_as_collected(p.status)
    and coalesce(p.paid_at, p.created_at) >= v_start;

  v_summary := v_summary || jsonb_build_object(
    'averageOrderValue', case
      when (v_summary->>'orders')::numeric > 0
        then round((v_summary->>'orderVolume')::numeric / (v_summary->>'orders')::numeric, 2)
      else 0
    end
  );

  with days as (
    select generate_series(
      (date_trunc('day', now()) - make_interval(days => v_days - 1))::date,
      date_trunc('day', now())::date,
      '1 day'::interval
    )::date as day
  ),
  payments_per_day as (
    select coalesce(p.paid_at, p.created_at)::date as day,
           sum(p.amount) as gmv,
           count(*) as payments
    from public.payment_transactions p
    where public.admin_payment_counts_as_collected(p.status)
      and coalesce(p.paid_at, p.created_at) >= v_start
    group by 1
  ),
  orders_per_day as (
    select o.placed_at::date as day, count(*) as orders
    from public.purchase_orders o
    where o.placed_at >= v_start
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', to_char(d.day, 'YYYY-MM-DD'),
    'gmv', coalesce(pay.gmv, 0),
    'orders', coalesce(ord.orders, 0),
    'payments', coalesce(pay.payments, 0)
  ) order by d.day), '[]'::jsonb)
  into v_series
  from days d
  left join payments_per_day pay on pay.day = d.day
  left join orders_per_day ord on ord.day = d.day;

  select coalesce(jsonb_agg(jsonb_build_object(
    'method', entry.method,
    'label', public.admin_payment_method_label(entry.method),
    'amount', entry.amount,
    'share', case when entry.total > 0
      then round((entry.amount / entry.total) * 100, 2) else 0 end
  ) order by entry.amount desc), '[]'::jsonb)
  into v_method_mix
  from (
    select p.method, sum(p.amount) as amount
    from public.payment_transactions p
    where public.admin_payment_counts_as_collected(p.status)
      and coalesce(p.paid_at, p.created_at) >= v_start
    group by p.method
  ) entry
  cross join (
    select coalesce(sum(p.amount), 0) as total
    from public.payment_transactions p
    where public.admin_payment_counts_as_collected(p.status)
      and coalesce(p.paid_at, p.created_at) >= v_start
  ) totals;

  select coalesce(jsonb_agg(jsonb_build_object(
    'commerceId', entry.commerce_id,
    'commerceName', coalesce(commerce.trade_name, 'Comercio no disponible'),
    'gmv', entry.gmv,
    'commission', entry.commission,
    'payments', entry.payments,
    'share', case when entry.total_gmv > 0
      then round((entry.gmv / entry.total_gmv) * 100, 2) else 0 end
  ) order by entry.gmv desc), '[]'::jsonb)
  into v_top_commerces
  from (
    select p.commerce_id,
           sum(p.amount) as gmv,
           sum(p.commission_amount) as commission,
           count(*) as payments,
           (select coalesce(sum(p2.amount), 0)
            from public.payment_transactions p2
            where public.admin_payment_counts_as_collected(p2.status)
              and coalesce(p2.paid_at, p2.created_at) >= v_start) as total_gmv
    from public.payment_transactions p
    where public.admin_payment_counts_as_collected(p.status)
      and coalesce(p.paid_at, p.created_at) >= v_start
    group by p.commerce_id
  ) entry
  left join public.commerce_profiles commerce on commerce.id = entry.commerce_id;

  return jsonb_build_object(
    'periodStart', v_start,
    'periodEnd', v_end,
    'rangeDays', v_days,
    'piiIncluded', false,
    'gatewayConnected', false,
    'summary', v_summary,
    'series', v_series,
    'methodMix', v_method_mix,
    'topCommerces', v_top_commerces
  );
end;
$$;

create or replace function public.admin_export_analytics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.admin_current_user_id();
  v_report jsonb;
begin
  if not public.admin_has_permission('analytics.view') then
    raise exception 'No autorizado para ver la analítica.' using errcode = '42501';
  end if;
  if not public.admin_has_permission('analytics.export') then
    raise exception 'No autorizado para exportar analítica.' using errcode = '42501';
  end if;

  v_report := public.admin_analytics_report(p_days);

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'analytics.export', 'Analítica', 'analytics_report', gen_random_uuid()::text,
    'Exportación de analítica agregada',
    jsonb_build_object(
      'rangeDays', (v_report->>'rangeDays')::integer,
      'piiIncluded', false,
      'gatewayConnected', false
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return v_report;
end;
$$;

-- -----------------------------------------------------------------------------
-- Libro interno de pagos (solo lectura + conciliación manual)
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_payments(
  p_search text default null,
  p_status text default null,
  p_reconciliation text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb := '[]'::jsonb;
begin
  if not public.admin_has_permission('payments.view') then
    raise exception 'No autorizado para ver pagos.' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in (
    'pending', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed', 'cancelled'
  ) then
    raise exception 'Estado de pago no válido.';
  end if;
  if p_reconciliation is not null and p_reconciliation not in ('all', 'reconciled', 'unreconciled') then
    raise exception 'Filtro de conciliación no válido.';
  end if;

  select coalesce(jsonb_agg(public.admin_payment_summary(p) order by p.created_at desc), '[]'::jsonb)
  into v_result
  from public.payment_transactions p
  left join public.purchase_orders o on o.id = p.order_id
  left join public.buyer_profiles buyer on buyer.id = p.buyer_id
  left join public.commerce_profiles commerce on commerce.id = p.commerce_id
  where (p_status is null or p_status = 'all' or p.status = p_status)
    and (
      p_reconciliation is null
      or p_reconciliation = 'all'
      or (p_reconciliation = 'unreconciled'
        and public.admin_payment_is_reconcilable(p.status) and not p.reconciled)
      or (p_reconciliation = 'reconciled' and p.reconciled)
    )
    and (
      p_search is null
      or coalesce(o.order_number, '') ilike '%' || p_search || '%'
      or coalesce(buyer.display_name, '') ilike '%' || p_search || '%'
      or coalesce(commerce.trade_name, '') ilike '%' || p_search || '%'
      or coalesce(p.provider_reference, '') ilike '%' || p_search || '%'
      or public.admin_payment_status_label(p.status) ilike '%' || p_search || '%'
      or public.admin_payment_method_label(p.method) ilike '%' || p_search || '%'
    );

  return v_result;
end;
$$;

create or replace function public.admin_get_payment(p_payment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payment_transactions%rowtype;
  v_order jsonb;
  v_payouts jsonb := '[]'::jsonb;
begin
  if not public.admin_has_permission('payments.view') then
    raise exception 'No autorizado para ver pagos.' using errcode = '42501';
  end if;

  select * into v_payment from public.payment_transactions where id = p_payment_id;
  if not found then
    raise exception 'El movimiento de pago no existe.';
  end if;

  select jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'status', o.status,
    'totalAmount', o.total_amount,
    'currency', o.currency,
    'placedAt', o.placed_at
  )
  into v_order
  from public.purchase_orders o
  where o.id = v_payment.order_id;

  select coalesce(jsonb_agg(public.admin_payout_summary(pay) order by pay.created_at desc), '[]'::jsonb)
  into v_payouts
  from public.payment_payouts pay
  where pay.commerce_id = v_payment.commerce_id;

  return public.admin_payment_summary(v_payment) || jsonb_build_object(
    'order', v_order,
    'payouts', v_payouts
  );
end;
$$;

create or replace function public.admin_payment_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_metrics jsonb;
begin
  if not public.admin_has_permission('payments.view') then
    raise exception 'No autorizado para ver pagos.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totalPayments', count(*),
    'pendingPayments', count(*) filter (where p.status = 'pending'),
    'authorizedPayments', count(*) filter (where p.status = 'authorized'),
    'failedPayments', count(*) filter (where p.status = 'failed'),
    'refundedPayments', count(*) filter (
      where p.status in ('refunded', 'partially_refunded')
    ),
    'unreconciledPayments', count(*) filter (
      where public.admin_payment_is_reconcilable(p.status) and not p.reconciled
    ),
    'grossCollected', coalesce(sum(p.amount) filter (
      where public.admin_payment_counts_as_collected(p.status)
    ), 0),
    'commissionRevenue', coalesce(sum(p.commission_amount) filter (
      where public.admin_payment_counts_as_collected(p.status)
    ), 0),
    'netToCommerces', coalesce(sum(p.net_amount) filter (
      where public.admin_payment_counts_as_collected(p.status)
    ), 0),
    'refundedAmount', coalesce(sum(p.refunded_amount) filter (
      where public.admin_payment_counts_as_collected(p.status)
    ), 0)
  )
  into v_metrics
  from public.payment_transactions p;

  v_metrics := v_metrics || jsonb_build_object(
    'pendingPayouts', (
      select count(*) from public.payment_payouts pay
      where pay.status in ('pending', 'scheduled')
    ),
    'pendingPayoutNet', (
      select coalesce(sum(pay.net_amount), 0) from public.payment_payouts pay
      where pay.status in ('pending', 'scheduled')
    ),
    'paidPayouts', (
      select count(*) from public.payment_payouts pay where pay.status = 'paid'
    ),
    'totalPayouts', (select count(*) from public.payment_payouts pay),
    'gatewayConnected', false
  );

  return v_metrics;
end;
$$;

create or replace function public.admin_list_payment_payouts(p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb := '[]'::jsonb;
begin
  if not public.admin_has_permission('payments.view') then
    raise exception 'No autorizado para ver pagos.' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('pending', 'scheduled', 'paid', 'failed') then
    raise exception 'Estado de liquidación no válido.';
  end if;

  select coalesce(jsonb_agg(public.admin_payout_summary(pay) order by pay.created_at desc), '[]'::jsonb)
  into v_result
  from public.payment_payouts pay
  where p_status is null or p_status = 'all' or pay.status = p_status;

  return v_result;
end;
$$;

create or replace function public.admin_reconcile_payment(
  p_payment_id uuid,
  p_reconciled boolean default true,
  p_reason text default null,
  p_reason_code text default 'other'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.admin_current_user_id();
  v_member public.admin_members%rowtype;
  v_payment public.payment_transactions%rowtype;
  v_previous boolean;
begin
  if not public.admin_has_permission('payments.reconcile') then
    raise exception 'No autorizado para conciliar pagos.' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.';
  end if;

  select * into v_payment
  from public.payment_transactions
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'El movimiento de pago no existe.';
  end if;
  if not public.admin_payment_is_reconcilable(v_payment.status) then
    raise exception 'Solo se pueden conciliar movimientos cobrados, reembolsados o con reembolso parcial.';
  end if;

  select * into v_member from public.admin_members where user_id = v_actor;
  v_previous := v_payment.reconciled;

  update public.payment_transactions
  set reconciled = coalesce(p_reconciled, true),
      reconciled_at = case when coalesce(p_reconciled, true) then now() else null end,
      reconciled_by = case when coalesce(p_reconciled, true) then v_actor else null end,
      reconciled_by_name = case
        when coalesce(p_reconciled, true) then v_member.display_name else null end,
      updated_at = now()
  where id = p_payment_id
  returning * into v_payment;

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_code, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'payment.reconcile', 'Pagos', 'payment_transaction', v_payment.id::text,
    p_reason_code, trim(p_reason),
    jsonb_build_object(
      'reconciled', v_payment.reconciled,
      'previousReconciled', v_previous,
      'reasonCode', p_reason_code,
      'gatewayConnected', false
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return public.admin_payment_summary(v_payment);
end;
$$;

-- -----------------------------------------------------------------------------
-- Exportación de auditoría (auditada)
-- -----------------------------------------------------------------------------
create or replace function public.admin_export_audit(
  p_search text default null,
  p_module text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.admin_current_user_id();
  v_entries jsonb;
begin
  if not public.admin_has_permission('audit.view') then
    raise exception 'No autorizado para ver la auditoría.' using errcode = '42501';
  end if;
  if not public.admin_has_permission('audit.export') then
    raise exception 'No autorizado para exportar auditoría.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'createdAt', a.created_at,
    'actorId', a.actor_id,
    'actorName', coalesce(a.actor_name, 'Sistema'),
    'actorRole', a.actor_role,
    'action', a.action,
    'module', a.module,
    'entityType', a.entity_type,
    'entityId', a.entity_id,
    'reasonCode', a.reason_code,
    'reason', a.reason_text,
    'metadata', a.metadata
  ) order by a.created_at desc), '[]'::jsonb)
  into v_entries
  from public.admin_audit_logs a
  where (p_module is null or p_module = 'all' or a.module = p_module)
    and (
      p_search is null
      or a.action ilike '%' || p_search || '%'
      or coalesce(a.actor_name, '') ilike '%' || p_search || '%'
      or coalesce(a.actor_email, '') ilike '%' || p_search || '%'
      or coalesce(a.entity_id, '') ilike '%' || p_search || '%'
      or coalesce(a.reason_text, '') ilike '%' || p_search || '%'
      or a.module ilike '%' || p_search || '%'
      or a.metadata::text ilike '%' || p_search || '%'
    );

  insert into public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, module, entity_type, entity_id, reason_text, metadata
  )
  select
    actor.user_id, actor.display_name, actor.email, actor_role.key,
    'audit.export', 'Auditoría', 'admin_audit_log', gen_random_uuid()::text,
    'Exportación de auditoría',
    jsonb_build_object(
      'count', jsonb_array_length(coalesce(v_entries, '[]'::jsonb)),
      'moduleFilter', p_module,
      'search', p_search
    )
  from public.admin_members actor
  join public.admin_roles actor_role on actor_role.id = actor.role_id
  where actor.user_id = v_actor;

  return coalesce(v_entries, '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- Búsqueda global (solo metadatos, respeta permisos, nunca mensajes de chat)
-- -----------------------------------------------------------------------------
create or replace function public.admin_global_search(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_term text := lower(trim(coalesce(p_query, '')));
  v_results jsonb := '[]'::jsonb;
  v_total integer := 0;
begin
  if length(v_term) < 2 then
    return jsonb_build_object(
      'query', coalesce(p_query, ''),
      'results', '[]'::jsonb,
      'total', 0,
      'truncated', false,
      'minLength', 2
    );
  end if;

  if public.admin_has_permission('users.view') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'type', 'buyer',
      'typeLabel', 'Comprador',
      'id', b.id,
      'title', b.display_name,
      'subtitle', concat_ws(' · ',
        case when public.admin_has_permission('users.view_pii')
          then b.email else public.admin_mask_email(b.email) end,
        b.status
      ),
      'status', b.status,
      'path', '/compradores?q=' || public.admin_url_encode(b.display_name)
    ) order by b.display_name), '[]'::jsonb)
    into v_results
    from public.buyer_profiles b
    where (
        lower(b.display_name) like '%' || v_term || '%'
        or lower(coalesce(b.email, '')) like '%' || v_term || '%'
      );
  end if;

  if public.admin_has_permission('commerce.view') then
    select coalesce(v_results || coalesce(jsonb_agg(jsonb_build_object(
      'type', 'commerce',
      'typeLabel', 'Comercio',
      'id', c.id,
      'title', c.trade_name,
      'subtitle', coalesce(c.legal_name, c.status),
      'status', c.status,
      'path', '/comercios?q=' || public.admin_url_encode(c.trade_name)
    ) order by c.trade_name), '[]'::jsonb), '[]'::jsonb)
    into v_results
    from public.commerce_profiles c
    where lower(c.trade_name) like '%' || v_term || '%'
      or lower(coalesce(c.legal_name, '')) like '%' || v_term || '%';
  end if;

  if public.admin_has_permission('requests.view') then
    select coalesce(v_results || coalesce(jsonb_agg(jsonb_build_object(
      'type', 'request',
      'typeLabel', 'Solicitud',
      'id', r.id,
      'title', r.title,
      'subtitle', concat_ws(' · ', buyer.display_name, r.status),
      'status', r.status,
      'path', '/solicitudes?q=' || public.admin_url_encode(r.title)
    ) order by r.created_at desc), '[]'::jsonb), '[]'::jsonb)
    into v_results
    from public.purchase_requests r
    left join public.buyer_profiles buyer on buyer.id = r.buyer_id
    where lower(r.title) like '%' || v_term || '%'
      or lower(coalesce(buyer.display_name, '')) like '%' || v_term || '%';
  end if;

  if public.admin_has_permission('offers.view') then
    select coalesce(v_results || coalesce(jsonb_agg(jsonb_build_object(
      'type', 'offer',
      'typeLabel', 'Oferta',
      'id', of.id,
      'title', coalesce(r.title, 'Oferta'),
      'subtitle', concat_ws(' · ', commerce.trade_name, of.status),
      'status', of.status,
      'path', '/ofertas?q=' || public.admin_url_encode(coalesce(commerce.trade_name, ''))
    ) order by of.created_at desc), '[]'::jsonb), '[]'::jsonb)
    into v_results
    from public.purchase_offers of
    left join public.purchase_requests r on r.id = of.request_id
    left join public.commerce_profiles commerce on commerce.id = of.commerce_id
    where lower(coalesce(r.title, '')) like '%' || v_term || '%'
      or lower(coalesce(commerce.trade_name, '')) like '%' || v_term || '%';
  end if;

  if public.admin_has_permission('orders.view') then
    select coalesce(v_results || coalesce(jsonb_agg(jsonb_build_object(
      'type', 'order',
      'typeLabel', 'Pedido',
      'id', o.id,
      'title', o.order_number,
      'subtitle', concat_ws(' · ', buyer.display_name, commerce.trade_name),
      'status', o.status,
      'path', '/pedidos?q=' || public.admin_url_encode(o.order_number)
    ) order by o.placed_at desc), '[]'::jsonb), '[]'::jsonb)
    into v_results
    from public.purchase_orders o
    left join public.buyer_profiles buyer on buyer.id = o.buyer_id
    left join public.commerce_profiles commerce on commerce.id = o.commerce_id
    where lower(o.order_number) like '%' || v_term || '%'
      or lower(coalesce(buyer.display_name, '')) like '%' || v_term || '%'
      or lower(coalesce(commerce.trade_name, '')) like '%' || v_term || '%';
  end if;

  if public.admin_has_permission('deliveries.view') then
    select coalesce(v_results || coalesce(jsonb_agg(jsonb_build_object(
      'type', 'delivery',
      'typeLabel', 'Entrega',
      'id', d.id,
      'title', coalesce(o.order_number, 'Entrega'),
      'subtitle', concat_ws(' · ', d.carrier, d.tracking_code, d.status),
      'status', d.status,
      'path', '/entregas?q=' || public.admin_url_encode(coalesce(o.order_number, coalesce(d.tracking_code, '')))
    ) order by d.created_at desc), '[]'::jsonb), '[]'::jsonb)
    into v_results
    from public.order_deliveries d
    left join public.purchase_orders o on o.id = d.order_id
    where lower(coalesce(o.order_number, '')) like '%' || v_term || '%'
      or lower(coalesce(d.tracking_code, '')) like '%' || v_term || '%'
      or lower(coalesce(d.carrier, '')) like '%' || v_term || '%';
  end if;

  if public.admin_has_permission('chats.view_metadata') then
    -- Solo metadatos: nunca se indexa el cuerpo de los mensajes.
    select coalesce(v_results || coalesce(jsonb_agg(jsonb_build_object(
      'type', 'chat',
      'typeLabel', 'Chat',
      'id', c.id,
      'title', c.subject,
      'subtitle', concat_ws(' · ', buyer.display_name, commerce.trade_name, c.status),
      'status', c.status,
      'path', '/chats?q=' || public.admin_url_encode(c.subject)
    ) order by c.last_message_at desc), '[]'::jsonb), '[]'::jsonb)
    into v_results
    from public.chat_threads c
    left join public.buyer_profiles buyer on buyer.id = c.buyer_id
    left join public.commerce_profiles commerce on commerce.id = c.commerce_id
    where lower(c.subject) like '%' || v_term || '%'
      or lower(coalesce(buyer.display_name, '')) like '%' || v_term || '%'
      or lower(coalesce(commerce.trade_name, '')) like '%' || v_term || '%';
  end if;

  if public.admin_has_permission('support.view') then
    select coalesce(v_results || coalesce(jsonb_agg(jsonb_build_object(
      'type', 'ticket',
      'typeLabel', 'Ticket de soporte',
      'id', t.id,
      'title', t.ticket_number || ' · ' || t.subject,
      'subtitle', concat_ws(' · ', t.requester_name, t.status),
      'status', t.status,
      'path', '/soporte?q=' || public.admin_url_encode(t.ticket_number)
    ) order by t.updated_at desc), '[]'::jsonb), '[]'::jsonb)
    into v_results
    from public.support_tickets t
    where lower(t.ticket_number) like '%' || v_term || '%'
      or lower(t.subject) like '%' || v_term || '%'
      or lower(coalesce(t.requester_name, '')) like '%' || v_term || '%';
  end if;

  select jsonb_array_length(v_results) into v_total;

  return jsonb_build_object(
    'query', coalesce(p_query, ''),
    'results', case when v_total > 20 then (
      select jsonb_agg(entry) from (
        select entry from jsonb_array_elements(v_results) entry limit 20
      ) limited
    ) else v_results end,
    'total', v_total,
    'truncated', v_total > 20,
    'minLength', 2
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Métricas de pagos y analítica para el panel (se combinan con
-- admin_dashboard_metrics y admin_trust_metrics)
-- -----------------------------------------------------------------------------
create or replace function public.admin_phase5_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_can_payments boolean := public.admin_has_permission('payments.view');
  v_can_analytics boolean := public.admin_has_permission('analytics.view');
  v_metrics jsonb := '{}'::jsonb;
  v_attention jsonb := '[]'::jsonb;
begin
  if v_can_payments then
    v_metrics := public.admin_payment_metrics();

    if (v_metrics->>'unreconciledPayments')::integer > 0 then
      v_attention := v_attention || jsonb_build_array(jsonb_build_object(
        'id', 'unreconciledPayments',
        'label', (v_metrics->>'unreconciledPayments') || ' pago(s) sin conciliar',
        'tone', 'warning',
        'path', '/pagos'
      ));
    end if;

    if (v_metrics->>'pendingPayouts')::integer > 0 then
      v_attention := v_attention || jsonb_build_array(jsonb_build_object(
        'id', 'pendingPayouts',
        'label', (v_metrics->>'pendingPayouts') || ' liquidación(es) pendiente(s) sin pasarela',
        'tone', 'neutral',
        'path', '/pagos'
      ));
    end if;
  else
    v_metrics := jsonb_build_object(
      'totalPayments', 0,
      'pendingPayments', 0,
      'unreconciledPayments', 0,
      'grossCollected', 0,
      'commissionRevenue', 0,
      'refundedAmount', 0,
      'pendingPayouts', 0,
      'totalPayouts', 0,
      'paymentGatewayConnected', false
    );
  end if;

  if not v_can_analytics then
    v_metrics := v_metrics || jsonb_build_object('analyticsAvailable', false);
  end if;

  return v_metrics || jsonb_build_object(
    'paymentGatewayConnected', false,
    'attention', v_attention
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS y privilegios
-- El cliente no lee estas tablas directamente: todo pasa por funciones con
-- permisos y auditoría. El libro interno no expone ninguna mutación de dinero.
-- -----------------------------------------------------------------------------
alter table public.payment_transactions enable row level security;
alter table public.payment_payouts enable row level security;

revoke all on public.payment_transactions from anon, authenticated;
revoke all on public.payment_payouts from anon, authenticated;

revoke execute on function public.admin_payment_is_reconcilable(text) from public;
revoke execute on function public.admin_payment_counts_as_collected(text) from public;
revoke execute on function public.admin_payment_status_label(text) from public;
revoke execute on function public.admin_payment_method_label(text) from public;
revoke execute on function public.admin_payment_provider_label(text) from public;
revoke execute on function public.admin_payout_status_label(text) from public;
revoke execute on function public.admin_mask_email(text) from public;
revoke execute on function public.admin_url_encode(text) from public;
revoke execute on function public.admin_payment_summary(public.payment_transactions) from public;
revoke execute on function public.admin_payout_summary(public.payment_payouts) from public;
revoke execute on function public.admin_analytics_report(integer) from public;
revoke execute on function public.admin_export_analytics(integer) from public;
revoke execute on function public.admin_list_payments(text, text, text) from public;
revoke execute on function public.admin_get_payment(uuid) from public;
revoke execute on function public.admin_payment_metrics() from public;
revoke execute on function public.admin_list_payment_payouts(text) from public;
revoke execute on function public.admin_reconcile_payment(uuid, boolean, text, text) from public;
revoke execute on function public.admin_export_audit(text, text) from public;
revoke execute on function public.admin_global_search(text) from public;
revoke execute on function public.admin_phase5_metrics() from public;

grant execute on function public.admin_analytics_report(integer) to authenticated;
grant execute on function public.admin_export_analytics(integer) to authenticated;
grant execute on function public.admin_list_payments(text, text, text) to authenticated;
grant execute on function public.admin_get_payment(uuid) to authenticated;
grant execute on function public.admin_payment_metrics() to authenticated;
grant execute on function public.admin_list_payment_payouts(text) to authenticated;
grant execute on function public.admin_reconcile_payment(uuid, boolean, text, text) to authenticated;
grant execute on function public.admin_export_audit(text, text) to authenticated;
grant execute on function public.admin_global_search(text) to authenticated;
grant execute on function public.admin_phase5_metrics() to authenticated;
