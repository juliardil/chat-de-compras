-- =============================================================================
-- Chat de Compras · Acceso dual Taller Verificado <-> Modo Empresa
--
-- Objetivo: un usuario con `workshop_profiles.is_verified = true` puede cotizar
-- trabajos (`request_type = 'service'`) sin convertirse en comercio, y conserva
-- su perfil de comprador para seguir pidiendo repuestos (`request_type = 'part'`)
-- con beneficios B2B.
--
-- DECISIÓN: NO se crea ni se vincula un `commerce_profiles` automáticamente.
-- Eso dejaría al taller sujeto a aprobación, segmentación por categorías y al
-- panel de ofertas de comercios, cambiando las reglas actuales de comercio.
-- En su lugar se habilita el acceso dual en la sesión (frontend) y se refuerza
-- RLS para que las ofertas con `workshop_id` sean insertables, legibles y
-- actualizables por su taller verificadо.
--
-- NO modifica tablas, NO toca `commerce_profiles`, NO cambia las políticas de
-- `purchase_requests` ni la rama existente de las políticas de `purchase_offers`
-- referida a comercios. Solo AGREGA una rama OR para talleres verificados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers recursion-safe para las políticas de purchase_offers
-- -----------------------------------------------------------------------------
create or replace function public.app_is_verified_workshop_owner(p_workshop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p_workshop_id is not null
    and exists (
      select 1
      from public.workshop_profiles wp
      where wp.id = p_workshop_id
        and wp.user_id = auth.uid()
        and wp.is_verified = true
    );
$$;

create or replace function public.app_owns_workshop(p_workshop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p_workshop_id is not null
    and exists (
      select 1
      from public.workshop_profiles wp
      where wp.id = p_workshop_id
        and wp.user_id = auth.uid()
    );
$$;

create or replace function public.app_is_open_service_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.purchase_requests pr
    where pr.id = p_request_id
      and pr.request_type = 'service'
      and pr.status = 'open'
  );
$$;

-- -----------------------------------------------------------------------------
-- Políticas de purchase_offers (aditivas)
--
-- INSERT: se conserva `app_can_offer_on_request(request_id, commerce_id)` tal
-- cual y se añade el caso de una propuesta de taller verificadо a una solicitud
-- de servicio abierta (sin commerce_id).
-- SELECT/UPDATE: se conservan las condiciones de comprador y comercio y se
-- añade el dueño del workshop_id para que vea y gestione sus propias propuestas.
-- -----------------------------------------------------------------------------
drop policy if exists purchase_offers_insert on public.purchase_offers;
create policy purchase_offers_insert on public.purchase_offers
  for insert to authenticated
  with check (
    public.app_can_offer_on_request(request_id, commerce_id)
    or (
      commerce_id is null
      and public.app_is_verified_workshop_owner(workshop_id)
      and public.app_is_open_service_request(request_id)
    )
  );

drop policy if exists purchase_offers_read on public.purchase_offers;
create policy purchase_offers_read on public.purchase_offers
  for select to authenticated
  using (
    public.app_is_buyer_of_request(request_id)
    or public.app_is_commerce(commerce_id)
    or public.app_owns_workshop(workshop_id)
  );

drop policy if exists purchase_offers_update on public.purchase_offers;
create policy purchase_offers_update on public.purchase_offers
  for update to authenticated
  using (
    public.app_is_commerce(commerce_id)
    or public.app_owns_workshop(workshop_id)
  )
  with check (
    public.app_is_commerce(commerce_id)
    or public.app_owns_workshop(workshop_id)
  );

-- -----------------------------------------------------------------------------
-- Permisos de ejecución (mismo patrón del proyecto)
-- -----------------------------------------------------------------------------
revoke all on function public.app_is_verified_workshop_owner(uuid) from public;
revoke all on function public.app_owns_workshop(uuid) from public;
revoke all on function public.app_is_open_service_request(uuid) from public;

grant execute on function public.app_is_verified_workshop_owner(uuid) to authenticated;
grant execute on function public.app_owns_workshop(uuid) to authenticated;
grant execute on function public.app_is_open_service_request(uuid) to authenticated;
