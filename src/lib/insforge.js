import { createClient } from '@insforge/sdk';

// Configuración pública del cliente. El anonKey es visible por diseño.
// Los secretos (service role, SMTP, etc.) NUNCA deben exponerse en VITE_*.
const baseUrl = (import.meta.env.VITE_INSFORGE_URL || '').trim();
const anonKey = (import.meta.env.VITE_INSFORGE_ANON_KEY || '').trim();
const rawDocumentsBucket = (import.meta.env.VITE_INSFORGE_DOCUMENTS_BUCKET || '').trim();
const rawEvidenceBucket = (import.meta.env.VITE_INSFORGE_EVIDENCE_BUCKET || '').trim();
const rawAvatarsBucket = (import.meta.env.VITE_INSFORGE_AVATARS_BUCKET || '').trim();
const rawAdBannersBucket = (import.meta.env.VITE_INSFORGE_AD_BANNERS_BUCKET || '').trim();

export const isInsforgeConfigured = Boolean(baseUrl && anonKey);

// Buckets privados previstos. No se crean desde la aplicación: deben existir en
// el proyecto y configurarse con acceso privado.
export const documentsBucket = rawDocumentsBucket || 'commerce-documents';
export const deliveryEvidenceBucket = rawEvidenceBucket || 'delivery-evidence';

// Fotos de perfil: bucket público de solo lectura. La escritura la controla
// storage.objects (solo el dueño que sube el archivo).
export const avatarsBucket = rawAvatarsBucket || 'avatars';

// Banners de publicidad: bucket público de solo lectura para la app. Las
// campañas se administran desde el panel con RPC SECURITY DEFINER.
export const adBannersBucket = rawAdBannersBucket || 'ad-banners';

export const insforgeConfig = {
  baseUrl,
  hasAnonKey: Boolean(anonKey),
  documentsBucket,
  deliveryEvidenceBucket,
  avatarsBucket,
  adBannersBucket,
};

export const insforge = isInsforgeConfigured
  ? createClient({ baseUrl, anonKey })
  : null;
