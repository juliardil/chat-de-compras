-- =============================================================================
-- Chat de Compras · Especialidad en solicitudes de servicio
--
-- Migración 100% aditiva. Agrega la especialidad elegida por el comprador a la
-- solicitud y la usa para dirigir el trabajo a los talleres que la prestan.
-- NO toca RLS, ofertas, chat de negociación, inventario ni autocompletado.
-- Las solicitudes de servicio anteriores (specialty is null) siguen visibles
-- para todos los talleres verificados, como hasta ahora.
--
-- Aplicar con:
--   npx -y @insforge/cli db migrations up 20261120165341_service-specialty-matching.sql
-- =============================================================================

alter table public.purchase_requests
  add column if not exists specialty text;

create index if not exists purchase_requests_service_specialty_idx
  on public.purchase_requests (specialty)
  where request_type = 'service' and status = 'open';

-- PostgreSQL no permite cambiar el tipo de retorno con CREATE OR REPLACE.
-- Se recrea solo esta RPC del módulo de talleres y se restauran sus grants.
drop function if exists public.app_available_service_jobs();

create or replace function public.app_available_service_jobs()
returns table (
  id uuid,
  title text,
  description text,
  category text,
  vehicle_type text,
  vehicle_plate text,
  service_zone text,
  specialty text,
  created_at timestamptz,
  client_user_id uuid,
  client_name text,
  client_is_club_member boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_workshop_id uuid := public.app_verified_workshop_id();
begin
  if v_workshop_id is null then
    raise exception 'Solo un Taller Verificado puede consultar los trabajos disponibles.';
  end if;

  return query
    select pr.id,
           pr.title,
           pr.description,
           pr.category,
           pr.vehicle_type,
           pr.vehicle_plate,
           pr.service_zone,
           pr.specialty,
           pr.created_at,
           bp.user_id,
           coalesce(bp.display_name, u.email, 'Comprador'),
           exists (
             select 1
             from public.group_members gm
             where gm.user_id = bp.user_id
             group by gm.user_id
             having count(*) >= (
               select s.min_members from public.group_settings s where s.id = true
             )
           )
    from public.purchase_requests pr
    join public.buyer_profiles bp on bp.id = pr.buyer_id
    left join auth.users u on u.id = bp.user_id
    where pr.request_type = 'service'
      and pr.status = 'open'
      and (
        pr.specialty is null
        or exists (
          select 1
          from public.workshop_profiles wp
          where wp.id = v_workshop_id
            and pr.specialty = any (wp.specialties)
        )
      )
      and not exists (
        select 1 from public.purchase_offers po
        where po.request_id = pr.id and po.workshop_id = v_workshop_id
      )
    order by pr.created_at desc
    limit 100;
end;
$$;

revoke all on function public.app_available_service_jobs() from public;
grant execute on function public.app_available_service_jobs() to authenticated;
