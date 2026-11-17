-- =============================================================================
-- Alternativas de marca por producto en una oferta
-- =============================================================================
-- El bloque global de marcas se sustituye por opciones asociadas a cada ítem.
-- El comprador elige una marca por producto; la elección se guarda en la oferta
-- y se replica en el hilo de chat como acuerdo inicial desglosado.
-- =============================================================================

alter table public.purchase_offers
  add column if not exists selected_item_options jsonb not null default '{}'::jsonb;

alter table public.chat_threads
  add column if not exists selected_offer_items jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'purchase_offers_selected_item_options_shape'
  ) then
    alter table public.purchase_offers
      add constraint purchase_offers_selected_item_options_shape
      check (jsonb_typeof(selected_item_options) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chat_threads_selected_offer_items_shape'
  ) then
    alter table public.chat_threads
      add constraint chat_threads_selected_offer_items_shape
      check (jsonb_typeof(selected_offer_items) = 'array');
  end if;
end $$;

-- RLS solo permite UPDATE de ofertas al comercio dueño. Este RPC valida que
-- quien elige es el comprador titular de la solicitud y que cada opción existe
-- dentro del producto al que pertenece.
create or replace function public.app_select_offer_item_brands(
  p_offer_id uuid,
  p_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.purchase_offers%rowtype;
  v_entry record;
  v_item jsonb;
  v_option jsonb;
  v_item_key text;
  v_option_id text;
  v_selection jsonb := '{}'::jsonb;
  v_agreement jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa para guardar tu elección.';
  end if;

  if p_offer_id is null or p_selections is null
     or jsonb_typeof(p_selections) <> 'object' or p_selections = '{}'::jsonb then
    raise exception 'Faltan datos para guardar las marcas elegidas.';
  end if;

  select * into v_offer
  from public.purchase_offers
  where id = p_offer_id;

  if not found then
    raise exception 'No se encontró la oferta.';
  end if;

  if v_offer.status <> 'active' then
    raise exception 'Esta oferta ya no está disponible.';
  end if;

  if not public.app_is_buyer_of_request(v_offer.request_id) then
    raise exception 'No puedes elegir marcas en esta oferta.';
  end if;

  for v_entry in select key, value from jsonb_each(p_selections) loop
    v_item_key := v_entry.key;
    v_option_id := btrim(coalesce(v_entry.value #>> '{}', ''));

    if v_item_key is null or v_option_id = '' then
      raise exception 'Faltan datos para guardar las marcas elegidas.';
    end if;

    select entry.value into v_item
    from jsonb_array_elements(
      case when jsonb_typeof(v_offer.items) = 'array'
        then v_offer.items
        else '[]'::jsonb
      end
    ) as entry(value)
    where coalesce(entry.value ->> 'key', entry.value ->> 'id', '') = v_item_key
    limit 1;

    if v_item is null then
      raise exception 'Uno de los productos elegidos no existe en esta oferta.';
    end if;

    select option.value into v_option
    from jsonb_array_elements(
      case when jsonb_typeof(v_item -> 'brand_options') = 'array'
        then v_item -> 'brand_options'
        else '[]'::jsonb
      end
    ) as option(value)
    where coalesce(option.value ->> 'id', '') = v_option_id
      and coalesce((option.value ->> 'available')::boolean, true) = true
    limit 1;

    if v_option is null then
      raise exception 'La marca elegida para uno de los productos no está disponible.';
    end if;

    v_selection := v_selection || jsonb_build_object(v_item_key, v_option);
    v_agreement := v_agreement || jsonb_build_array(
      jsonb_build_object(
        'item_key', v_item_key,
        'item_name', coalesce(v_item ->> 'name', ''),
        'quantity', coalesce((v_item ->> 'quantity')::numeric, 1),
        'id', v_option ->> 'id',
        'brand', v_option ->> 'brand',
        'price', (v_option ->> 'price')::numeric,
        'available', true,
        'is_recommended', coalesce((v_option ->> 'is_recommended')::boolean, false),
        'note', coalesce(v_option ->> 'note', '')
      )
    );
  end loop;

  update public.purchase_offers
  set selected_item_options = v_selection,
      selected_at = now(),
      updated_at = now()
  where id = p_offer_id;

  update public.chat_threads
  set selected_offer_items = v_agreement,
      updated_at = now()
  where offer_id = p_offer_id
    and public.app_is_buyer(buyer_id);

  return jsonb_build_object(
    'ok', true,
    'offer_id', p_offer_id,
    'selected_item_options', v_selection,
    'selected_at', now()
  );
end;
$$;

revoke all on function public.app_select_offer_item_brands(uuid, jsonb) from public;
grant execute on function public.app_select_offer_item_brands(uuid, jsonb) to authenticated;
