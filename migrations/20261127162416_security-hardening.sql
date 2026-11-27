-- Bloque 2: hardening de RPC SECURITY DEFINER y paridad de permisos.
--
-- Todas las sentencias son idempotentes: ALTER FUNCTION ... SET se puede
-- repetir sin acumular configuración, y las inserciones usan ON CONFLICT o
-- NOT EXISTS sobre la clave natural. No se reescribe ningún cuerpo ni se
-- modifican los grants: solo se fija proconfig y se alinea una concesión.

-- -----------------------------------------------------------------------------
-- 1) search_path fijo en TODAS las funciones SECURITY DEFINER de public.
--    Incluye admin_has_permission, admin_list_sellers, admin_get_seller_detail,
--    admin_set_seller_active, admin_export_audit y las demás RPCs relacionadas.
--    Se usa la firma (oid::regprocedure) para no romper sobrecargas.
-- -----------------------------------------------------------------------------
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not coalesce(
        p.proconfig @> array['search_path=pg_catalog, public, pg_temp'],
        false
      )
    order by p.proname
  loop
    execute format('alter function %s set search_path = pg_catalog, public, pg_temp', fn);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- 2) Paridad de auditoría para commerce_manager.
--    Este rol ejecuta sellers.manage (admin_set_seller_active) y sus acciones
--    quedan registradas en admin_audit_logs. La política de lectura de esa tabla
--    exige audit.view, así que el rol debe poder consultar lo que genera.
--    No se otorga audit.export: la exportación sigue reservada a superadmin.
-- -----------------------------------------------------------------------------
insert into public.admin_permissions (key, module, action, label, is_sensitive)
values ('audit.view', 'Auditoría', 'view', 'Consultar auditoría', true)
on conflict (key) do update
  set module = excluded.module,
      action = excluded.action,
      label = excluded.label,
      is_sensitive = excluded.is_sensitive;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.key = 'audit.view'
where r.key = 'commerce_manager'
  and not exists (
    select 1
    from public.admin_role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );
