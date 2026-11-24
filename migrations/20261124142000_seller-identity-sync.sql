-- Sincroniza el nombre y la foto del vendedor con la atribución ya guardada.
--
-- La Edge Function comercializa los cambios del dueño, pero el vendedor también
-- puede cambiar su foto desde el panel (app_set_avatar_url). Sin este trigger,
-- las conversaciones abiertas seguirían mostrando la foto anterior al comprador.
-- Es aditivo e idempotente: no reescribe ningún flujo de oferta/entrega.

create or replace function public.app_sync_seller_identity_in_chats()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if NEW.role <> 'seller' then
    return NEW;
  end if;

  if NEW.full_name is distinct from OLD.full_name
     or NEW.avatar_url is distinct from OLD.avatar_url then
    update public.chat_threads
    set assigned_seller_name = NEW.full_name,
        assigned_seller_avatar = NEW.avatar_url
    where assigned_seller_id = NEW.user_id;

    update public.purchase_orders
    set sold_by_name = NEW.full_name
    where sold_by_user_id = NEW.user_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists app_seller_identity_sync on public.commerce_members;
create trigger app_seller_identity_sync
  after update of full_name, avatar_url
  on public.commerce_members
  for each row execute function public.app_sync_seller_identity_in_chats();

revoke all on function public.app_sync_seller_identity_in_chats() from public;
