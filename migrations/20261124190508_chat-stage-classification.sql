-- Clasificación automática por etapas de la bandeja de mensajes del comercio.
--
-- `chat_threads.sales_stage` es una columna derivada y aditiva: no reemplaza
-- `lifecycle_state` ni `status`, y ningún flujo existente se reescribe. Un
-- trigger BEFORE la recalcula en cada INSERT/UPDATE del hilo (impidiendo que un
-- cliente escriba una etapa falsa) y un trigger AFTER en `purchase_orders` la
-- sincroniza cuando cambia el estado o la fecha de entrega del pedido.
--
-- La RPC `app_chat_stage_board()` expone contadores y etapas al dueño y a los
-- vendedores afiliados activos de ese `commerce_id`, sin duplicar hilos ni
-- relajar las políticas RLS existentes.

-- -----------------------------------------------------------------------------
-- Esquema
-- -----------------------------------------------------------------------------
alter table public.chat_threads
  add column if not exists sales_stage text default 'negotiating';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.chat_threads'::regclass
      and conname = 'chat_threads_sales_stage_check'
  ) then
    alter table public.chat_threads add constraint chat_threads_sales_stage_check
      check (sales_stage in ('negotiating', 'pending', 'delivered'));
  end if;
end $$;

alter table public.chat_threads alter column sales_stage set not null;

create index if not exists chat_threads_commerce_sales_stage_idx
  on public.chat_threads (commerce_id, sales_stage);

-- -----------------------------------------------------------------------------
-- Regla de negocio (SECURITY DEFINER: los triggers deben poder leer pedidos
-- aunque el usuario que escribe no tenga acceso directo a todas las filas).
-- -----------------------------------------------------------------------------
create or replace function public.app_compute_chat_sales_stage(p_thread public.chat_threads)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_status text;
begin
  -- La confirmación de entrega puede vivir en el ciclo de la oferta, en el
  -- pedido o en ambos; cualquiera de las tres señales basta para cerrar.
  if coalesce(p_thread.lifecycle_state, '') in ('ENTREGA_CONFIRMADA', 'CALIFICADO')
     or p_thread.delivery_confirmed_at is not null then
    return 'delivered';
  end if;

  if p_thread.order_id is not null then
    select o.status into v_order_status
    from public.purchase_orders o
    where o.id = p_thread.order_id;

    if coalesce(v_order_status, '') in ('delivered', 'completed') then
      return 'delivered';
    end if;

    if coalesce(v_order_status, '') in ('pending', 'confirmed', 'preparing', 'shipped', 'disputed') then
      return 'pending';
    end if;
  end if;

  -- En espera de entrega con acuerdo cerrado, pero todavía sin pedido.
  if coalesce(p_thread.lifecycle_state, '') = 'EN_ENTREGA' then
    return 'pending';
  end if;

  return 'negotiating';
end;
$$;

create or replace function public.app_sync_chat_sales_stage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  NEW.sales_stage := public.app_compute_chat_sales_stage(NEW);
  return NEW;
end;
$$;

drop trigger if exists app_chat_sales_stage_sync on public.chat_threads;
create trigger app_chat_sales_stage_sync
  before insert or update on public.chat_threads
  for each row execute function public.app_sync_chat_sales_stage();

create or replace function public.app_sync_order_sales_stage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.chat_threads ct
     set sales_stage = public.app_compute_chat_sales_stage(ct)
   where ct.order_id = NEW.id
     and ct.sales_stage is distinct from public.app_compute_chat_sales_stage(ct);
  return null;
end;
$$;

drop trigger if exists app_order_sales_stage_sync on public.purchase_orders;
create trigger app_order_sales_stage_sync
  after insert or update of status, delivered_at, completed_at
  on public.purchase_orders
  for each row execute function public.app_sync_order_sales_stage();

-- -----------------------------------------------------------------------------
-- Backfill de hilos existentes
-- -----------------------------------------------------------------------------
update public.chat_threads ct
   set sales_stage = public.app_compute_chat_sales_stage(ct)
 where ct.sales_stage is distinct from public.app_compute_chat_sales_stage(ct);

-- -----------------------------------------------------------------------------
-- RPC de lectura para la bandeja
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
    'delivered', count(*) filter (where ct.sales_stage = 'delivered')
  )
  into v_counts
  from public.chat_threads ct
  where ct.commerce_id = v_commerce_id;

  select coalesce(jsonb_object_agg(ct.id::text, ct.sales_stage), '{}'::jsonb)
  into v_stages
  from public.chat_threads ct
  where ct.commerce_id = v_commerce_id;

  return jsonb_build_object('counts', v_counts, 'stages', v_stages);
end;
$$;

revoke all on function public.app_chat_stage_board() from public;
grant execute on function public.app_chat_stage_board() to authenticated;
