-- Catálogo por tipo de vehículo: alias canónicos para las líneas exclusivas
-- de moto. app_commerce_matches_request compara app_category_key tanto en la
-- solicitud como en commerce_profiles, por lo que la combinación vehículo +
-- línea sigue siendo exacta. Idempotente: se reemplaza la función auxiliar y
-- se conservan los permisos originales (sin EXECUTE público).

create or replace function public.app_category_key(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
  select case public.app_normalize_text(p_value)
    when 'motor' then 'motor'
    when 'motores' then 'motor'
    when 'motor y transmision' then 'motor'
    when 'transmision' then 'motor'
    when 'frenos' then 'frenos'
    when 'freno' then 'frenos'
    when 'sistema de frenos' then 'frenos'
    when 'suspension' then 'suspension'
    when 'suspensiones' then 'suspension'
    when 'amortiguadores' then 'suspension'
    when 'electrico' then 'electrico'
    when 'electrica' then 'electrico'
    when 'electricos' then 'electrico'
    when 'electricidad' then 'electrico'
    when 'sistema electrico' then 'electrico'
    when 'llantas' then 'llantas'
    when 'llanta' then 'llantas'
    when 'neumaticos' then 'llantas'
    when 'neumatico' then 'llantas'
    when 'llantas y neumaticos' then 'llantas'
    when 'interior exterior' then 'interior exterior'
    when 'interior y exterior' then 'interior exterior'
    when 'interior' then 'interior exterior'
    when 'exterior' then 'interior exterior'
    when 'carroceria' then 'interior exterior'
    when 'lubricantes' then 'lubricantes'
    when 'lubricante' then 'lubricantes'
    when 'lubricantes y fluidos' then 'lubricantes'
    when 'fluidos' then 'lubricantes'
    when 'aceites' then 'lubricantes'
    when 'taller' then 'taller'
    when 'taller mecanico' then 'taller'
    when 'servicios' then 'taller'
    when 'servicio mecanico' then 'taller'
    when 'accesorios' then 'accesorios'
    when 'accesorios vehiculares' then 'accesorios'
    when 'accesorios para vehiculos' then 'accesorios'
    when 'audio' then 'audio'
    when 'audio y sonido' then 'audio'
    when 'sonido' then 'audio'
    when 'estereo' then 'audio'
    when 'seguridad' then 'seguridad'
    when 'seguridad vehicular' then 'seguridad'
    -- Líneas exclusivas de moto del catálogo compartido.
    when 'kit arrastre' then 'kit arrastre'
    when 'kit de arrastre' then 'kit arrastre'
    when 'kit arrastre transmision' then 'kit arrastre'
    when 'kit de arrastre transmision' then 'kit arrastre'
    when 'accesorios lujos' then 'accesorios lujos'
    when 'accesorios y lujos' then 'accesorios lujos'
    when 'cascos' then 'cascos indumentaria seguridad'
    when 'cascos indumentaria seguridad' then 'cascos indumentaria seguridad'
    when 'cascos e indumentaria seguridad' then 'cascos indumentaria seguridad'
    else public.app_normalize_text(p_value)
  end;
$$;

revoke all on function public.app_category_key(text) from public;
