-- Corrige RPC del panel administrativo:
-- 1. admin_list_commerces fallaba con "aggregate function calls cannot be nested"
--    al calcular el resumen de documentos dentro de jsonb_agg.
-- 2. admin_analytics_report (y su exportación) referenciaba entry.total, que no
--    existía en la subconsulta; el total viene del CROSS JOIN totals.

CREATE OR REPLACE FUNCTION public.admin_list_commerces(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
          'total', coalesce(docs.total, 0),
          'pending', coalesce(docs.pending, 0),
          'verified', coalesce(docs.verified, 0),
          'rejected', coalesce(docs.rejected, 0)
        )
      )
      order by coalesce(c.submitted_at, c.created_at) desc
    )
    from public.commerce_profiles c
    left join public.commerce_categories category on category.id = c.category_id
    left join public.admin_members reviewer on reviewer.user_id = c.reviewed_by
    left join (
      select document.commerce_id,
             count(*) as total,
             count(*) filter (where document.status = 'pending') as pending,
             count(*) filter (where document.status = 'verified') as verified,
             count(*) filter (where document.status = 'rejected') as rejected
      from public.commerce_documents document
      group by document.commerce_id
    ) docs on docs.commerce_id = c.id
    where (p_status is null or c.status = p_status)
      and (
        v_term = ''
        or lower(coalesce(c.trade_name, '')) like '%' || v_term || '%'
        or lower(coalesce(c.legal_name, '')) like '%' || v_term || '%'
        or lower(coalesce(c.tax_id, '')) like '%' || v_term || '%'
        or lower(coalesce(c.contact_name, '')) like '%' || v_term || '%'
        or lower(coalesce(c.email, '')) like '%' || v_term || '%'
        or lower(coalesce(c.city, '')) like '%' || v_term || '%'
        or lower(coalesce(category.name, '')) like '%' || v_term || '%'
      )
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_analytics_report(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    'share', case when totals.total > 0
      then round((entry.amount / totals.total) * 100, 2) else 0 end
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
$function$
