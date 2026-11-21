-- =============================================================================
-- Chat de Compras · Flujo "Recomiéndame" y mini-catálogo de opciones
--
-- Migración 100% aditiva y retrocompatible:
--   * Las solicitudes antiguas siguen con is_recommendation = false y sin
--     presupuesto/preferencias.
--   * Las ofertas antiguas siguen sin recommended_options.
--   * No se modifica RLS de tablas de negocio: los grants existentes cubren
--     las columnas nuevas y las políticas actuales siguen decidiendo el acceso.
--   * La política de Storage solo restringe la nueva ruta
--     `offers/recommendations/{userId}/...` dentro del bucket público avatars.
--
-- Aplicar con:
--   npx -y @insforge/cli db migrations up 20261121180044_recommendation-options.sql
-- =============================================================================

alter table public.purchase_requests
  add column if not exists is_recommendation boolean not null default false,
  add column if not exists budget numeric null,
  add column if not exists preferences text null;

alter table public.purchase_offers
  add column if not exists recommended_options jsonb null;

-- Presupuesto opcional: cuando se captura no puede ser negativo.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_requests_recommendation_budget_check'
      and conrelid = 'public.purchase_requests'::regclass
  ) then
    alter table public.purchase_requests
      add constraint purchase_requests_recommendation_budget_check
      check (budget is null or budget >= 0);
  end if;
end $$;

-- El mini-catálogo es opcional; cuando existe, va de 1 a 5 opciones. PostgreSQL
-- no admite subconsultas dentro de un CHECK, así que la forma de cada opción
-- (foto, precio, regalo y garantía) se valida en la capa de aplicación.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_offers_recommended_options_shape'
      and conrelid = 'public.purchase_offers'::regclass
  ) then
    alter table public.purchase_offers
      add constraint purchase_offers_recommended_options_shape
      check (
        recommended_options is null
        or (
          jsonb_typeof(recommended_options) = 'array'
          and jsonb_array_length(recommended_options) between 1 and 5
        )
      );
  end if;
end $$;

grant select, insert, update on public.purchase_requests to authenticated;
grant select, insert, update on public.purchase_offers to authenticated;

-- Las fotos de recomendaciones viven en el bucket público existente. Esta
-- política RESTRICTIVE solo exige que la carpeta sea la del usuario autenticado;
-- el resto de rutas de `avatars` quedan exactamente como estaban.
drop policy if exists storage_objects_recommendation_images_owner on storage.objects;

create policy storage_objects_recommendation_images_owner
on storage.objects
for insert
to authenticated
with check (
  bucket <> 'avatars'
  or key is null
  or key !~~ 'offers/recommendations/%'
  or (
    (regexp_match(key, '^offers/recommendations/([0-9a-fA-F-]{36})/'))[1]
      = auth.uid()::text
  )
);
