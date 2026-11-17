-- =============================================================================
-- Comunidades · ajuste de la RPC de insignias para el tablero del comercio
--
-- `purchase_requests.buyer_id` referencia `buyer_profiles(id)`, mientras que
-- `group_members.user_id` referencia `auth.users(id)`. Esta migración reemplaza
-- `app_group_badges` para recibir ids de perfil de comprador y resolver el
-- mapeo dentro de la función (SECURITY DEFINER), devolviendo solo datos seguros.
-- No modifica purchase_requests, buyer_profiles ni sus políticas RLS.
-- =============================================================================

-- El tipo de retorno cambia (user_id -> buyer_id), por lo que Postgres exige
-- recrear la función en lugar de reemplazarla.
drop function if exists public.app_group_badges(uuid[]);

create or replace function public.app_group_badges(p_buyer_ids uuid[])
returns table (
  buyer_id uuid,
  group_name text,
  member_count integer,
  min_members integer,
  is_verified boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with ranked as (
    select distinct on (bp.id)
      bp.id as buyer_id,
      g.name,
      count(*) over (partition by g.id)::integer as member_count
    from public.buyer_profiles bp
    join public.group_members gm on gm.user_id = bp.user_id
    join public.groups g on g.id = gm.group_id
    where bp.id = any(coalesce(p_buyer_ids, '{}'::uuid[]))
    order by bp.id, gm.joined_at asc
  )
  select r.buyer_id, r.name, r.member_count, s.min_members, true
  from ranked r
  cross join public.group_settings s
  where r.member_count >= s.min_members;
$$;

revoke all on function public.app_group_badges(uuid[]) from public;
grant execute on function public.app_group_badges(uuid[]) to authenticated;
