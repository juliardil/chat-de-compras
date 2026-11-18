// =============================================================================
// Capa de datos del autoservicio de logos (negocios y marcas).
//
// Todas las escrituras pasan por RPC SECURITY DEFINER que comprueban la
// propiedad en servidor (migración 20261117190000). La subida del archivo
// reutiliza uploadLogo: mismo bucket `avatars` y mismas validaciones que la
// foto de perfil. Contrato `{ items, error, notice }` / `{ ok, data, error }`.
// =============================================================================

import { runQuery, runWrite, uploadLogo } from './appData';

export const LOGO_NOTICES = {
  load: 'No se pudieron cargar los logos de tu negocio.',
  save: 'No se pudo guardar el logo. Verifica tu sesión e inténtalo de nuevo.',
  upload: 'No se pudo subir el logo.',
  brands: 'No se pudieron cargar las marcas patrocinadoras vinculadas.',
};

export const fetchMyBusinessLogos = () =>
  runQuery((db) => db.rpc('app_my_business_logos'), LOGO_NOTICES.load);

export const saveWorkshopLogo = (logoUrl) =>
  runWrite(
    (db) => db.rpc('app_set_workshop_logo', { p_logo_url: logoUrl || null }),
    LOGO_NOTICES.save
  );

export const saveCommerceLogo = (logoUrl) =>
  runWrite(
    (db) => db.rpc('app_set_commerce_logo', { p_logo_url: logoUrl || null }),
    LOGO_NOTICES.save
  );

export const saveClubSponsorLogo = (sponsorId, logoUrl) =>
  runWrite(
    (db) =>
      db.rpc('app_set_club_sponsor_logo', {
        p_sponsor_id: sponsorId,
        p_logo_url: logoUrl || null,
      }),
    LOGO_NOTICES.save
  );

export const fetchBusinessBrandLogos = ({ workshopId = null, commerceId = null } = {}) => {
  if (!workshopId && !commerceId) {
    return Promise.resolve({ items: [], error: null, notice: null });
  }
  return runQuery(
    (db) =>
      db.rpc('app_business_brand_logos', {
        p_workshop_id: workshopId || null,
        p_commerce_id: commerceId || null,
      }),
    LOGO_NOTICES.brands
  );
};

export { uploadLogo };
