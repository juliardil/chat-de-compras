-- Cierre y archivado de chats cuya entrega fue confirmada como conforme.
--
-- La confirmación puede llegar por dos vías ya existentes: el ciclo de la
-- oferta (`ENTREGA_CONFIRMADA`) o el pedido (`purchase_orders.status =
-- 'delivered'/'completed'`). Ambas convergen en `chat_threads.sales_stage =
-- 'delivered'`; el trigger de ese hilo es el punto único donde archive el chat.
-- El historial no se toca: los mensajes siguen en `chat_messages` y el pedido
-- completo sigue en `purchase_orders`, ambos legibles por comprador, comercio,
-- vendedor afiliado activo y admin según las políticas RLS ya vigentes.

-- -----------------------------------------------------------------------------
-- Regla de cierre (idempotente: CREATE OR REPLACE + trigger existente)
-- -----------------------------------------------------------------------------
create or replace function public.app_sync_chat_sales_stage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stage text;
begin
  v_stage := public.app_compute_chat_sales_stage(NEW);
  NEW.sales_stage := v_stage;

  -- Un chat marcado por moderación conserva su estado; el resto sale de la
  -- bandeja activa en cuanto la entrega queda confirmada.
  if v_stage = 'delivered'
     and coalesce(NEW.status, 'active') not in ('archived', 'flagged') then
    NEW.status := 'archived';
  end if;

  return NEW;
end;
$$;

drop trigger if exists app_chat_sales_stage_sync on public.chat_threads;
create trigger app_chat_sales_stage_sync
  before insert or update on public.chat_threads
  for each row execute function public.app_sync_chat_sales_stage();

-- -----------------------------------------------------------------------------
-- Backfill: chats ya confirmados que todavía seguían activos
-- -----------------------------------------------------------------------------
update public.chat_threads ct
   set status = 'archived'
 where ct.sales_stage = 'delivered'
   and coalesce(ct.status, 'active') not in ('archived', 'flagged');

-- -----------------------------------------------------------------------------
-- Contadores de la bandeja: solo conversaciones activas/en curso
-- -----------------------------------------------------------------------------
create or replace function public.app_chat_stage_board()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_commerce_id uuid := public.app_lifecycle_current_commerce_id();
  v_counts jsonb;
  v_stages jsonb;
begin
  if v_commerce_id is null then
    return jsonb_build_object(
      'counts', jsonb_build_object('negotiating', 0, 'pending', 0, 'delivered', 0),
      'stages', '{}'::jsonb
    );
  end if;

  select jsonb_build_object(
    'negotiating', count(*) filter (where ct.sales_stage = 'negotiating'),
    'pending', count(*) filter (where ct.sales_stage = 'pending'),
    -- Los entregados ya viven en el historial, no en la bandeja activa.
    'delivered', 0
  )
  into v_counts
  from public.chat_threads ct
  where ct.commerce_id = v_commerce_id
    and coalesce(ct.status, 'active') <> 'archived'
    and ct.sales_stage <> 'delivered';

  select coalesce(jsonb_object_agg(ct.id::text, ct.sales_stage), '{}'::jsonb)
  into v_stages
  from public.chat_threads ct
  where ct.commerce_id = v_commerce_id
    and coalesce(ct.status, 'active') <> 'archived'
    and ct.sales_stage <> 'delivered';

  return jsonb_build_object('counts', v_counts, 'stages', v_stages);
end;
$$;

revoke all on function public.app_chat_stage_board() from public;
grant execute on function public.app_chat_stage_board() to authenticated;
