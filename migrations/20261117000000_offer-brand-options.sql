-- =============================================================================
-- Cotizaciones multi-marca y elección del comprador
-- =============================================================================
-- Cada oferta puede traer varias opciones de marca (Mobil, Lubrax, etc.) con
-- precio, disponibilidad, recomendación y nota. El comprador elige una; la
-- elección queda guardada en la oferta y se replica en el hilo de chat para que
-- el acuerdo inicial sea el mismo para ambas partes.
-- =============================================================================

-- Opciones de marca ofrecidas por el comercio --------------------------------
alter table public.purchase_offers
  add column if not exists brand_options jsonb not null default '[]'::jsonb;

-- Opción elegida por el comprador (instantánea de brand_options) --------------
alter table public.purchase_offers
  add column if not exists selected_option jsonb;

alter table public.purchase_offers
  add column if not exists selected_at timestamptz;

-- El acuerdo elegido viaja con la conversación --------------------------------
alter table public.chat_threads
  add column if not exists selected_offer_option jsonb;

-- Retrocompatibilidad: las ofertas anteriores tenían un único precio en
-- total_amount y ninguna opción. Se convierten en una opción por defecto para
-- que el selector del comprador nunca aparezca vacío.
update public.purchase_offers
set brand_options = jsonb_build_array(
  jsonb_build_object(
    'id', 'legacy-default',
    'brand', 'Opción estándar',
    'price', total_amount,
    'available', true,
    'is_recommended', true,
    'note', null
  )
)
where coalesce(jsonb_array_length(
  case when jsonb_typeof(brand_options) = 'array' then brand_options else '[]'::jsonb end
), 0) = 0
  and total_amount > 0;

-- Validaciones ligeras de forma (los valores se validan también en la app) ----
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'purchase_offers_brand_options_shape'
  ) then
    alter table public.purchase_offers
      add constraint purchase_offers_brand_options_shape
      check (jsonb_typeof(brand_options) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'purchase_offers_selected_option_shape'
  ) then
    alter table public.purchase_offers
      add constraint purchase_offers_selected_option_shape
      check (selected_option is null or jsonb_typeof(selected_option) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chat_threads_selected_option_shape'
  ) then
    alter table public.chat_threads
      add constraint chat_threads_selected_option_shape
      check (selected_offer_option is null or jsonb_typeof(selected_offer_option) = 'object');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Selección de opción por el comprador.
-- RLS solo permite UPDATE de ofertas al comercio dueño, así que la elección se
-- escribe mediante esta función SECURITY DEFINER que valida que quien llama es
-- el comprador titular de la solicitud y que la opción existe y está activa.
-- -----------------------------------------------------------------------------
create or replace function public.app_select_offer_option(
  p_offer_id uuid,
  p_option_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.purchase_offers%rowtype;
  v_option jsonb;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa para guardar tu elección.';
  end if;

  if p_offer_id is null or nullif(trim(coalesce(p_option_id, '')), '') is null then
    raise exception 'Faltan datos para guardar la opción elegida.';
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
    raise exception 'No puedes elegir una opción en esta oferta.';
  end if;

  select entry.value into v_option
  from jsonb_array_elements(
    case when jsonb_typeof(v_offer.brand_options) = 'array'
      then v_offer.brand_options
      else '[]'::jsonb
    end
  ) as entry(value)
  where coalesce(entry.value ->> 'id', '') = p_option_id
  limit 1;

  if v_option is null then
    raise exception 'La opción elegida no existe en esta oferta.';
  end if;

  if coalesce((v_option ->> 'available')::boolean, true) = false then
    raise exception 'La opción elegida no está disponible.';
  end if;

  update public.purchase_offers
  set selected_option = v_option,
      selected_at = now(),
      updated_at = now()
  where id = p_offer_id;

  -- Fija la misma opción como acuerdo inicial en la conversación vinculada.
  update public.chat_threads
  set selected_offer_option = v_option,
      updated_at = now()
  where offer_id = p_offer_id
    and public.app_is_buyer(buyer_id);

  return jsonb_build_object(
    'ok', true,
    'offer_id', p_offer_id,
    'selected_option', v_option,
    'selected_at', now()
  );
end;
$$;

revoke all on function public.app_select_offer_option(uuid, text) from public;
grant execute on function public.app_select_offer_option(uuid, text) to authenticated;
