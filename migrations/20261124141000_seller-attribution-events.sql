-- Atribución aditiva en los eventos que faltaban: aceptar una solicitud y
-- enviar un mensaje como comercio. El trigger original se reemplaza de forma
-- idempotente para no duplicar la lógica ya aplicada al insertar ofertas,
-- chats y pedidos.

-- Al aceptar una oferta se actualiza lifecycle_state. Si el hilo se creó desde
-- el comprador (sin vendedor asignado), este evento completa la atribución con
-- el miembro activo que acepta.
drop trigger if exists app_chat_seller_attribution on public.chat_threads;
create trigger app_chat_seller_attribution
  before insert or update of offer_id, commerce_id, lifecycle_state
  on public.chat_threads
  for each row execute function public.app_apply_chat_seller_attribution();

create or replace function public.app_apply_chat_message_seller_attribution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_user_id uuid;
  v_name text;
  v_avatar text;
begin
  if NEW.sender_type is distinct from 'commerce' or NEW.chat_id is null then
    return NEW;
  end if;

  -- auth.uid() sigue siendo el usuario de la sesión aunque el insert pase por
  -- una RPC SECURITY DEFINER: solo se atribuye quien realmente respondió.
  select m.user_id, m.full_name, m.avatar_url
  into v_user_id, v_name, v_avatar
  from public.commerce_members m
  join public.chat_threads ct on ct.commerce_id = m.commerce_id
  where ct.id = NEW.chat_id
    and m.user_id = auth.uid()
    and m.is_active
  limit 1;

  if v_user_id is not null then
    update public.chat_threads
    set assigned_seller_id = coalesce(assigned_seller_id, v_user_id),
        assigned_seller_name = coalesce(assigned_seller_name, v_name),
        assigned_seller_avatar = coalesce(assigned_seller_avatar, v_avatar)
    where id = NEW.chat_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists app_chat_message_seller_attribution on public.chat_messages;
create trigger app_chat_message_seller_attribution
  after insert on public.chat_messages
  for each row execute function public.app_apply_chat_message_seller_attribution();

revoke all on function public.app_apply_chat_message_seller_attribution() from public;
