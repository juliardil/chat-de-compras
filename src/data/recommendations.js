// =============================================================================
// Flujo «Recomiéndame»: reglas puras compartidas por /request, el panel del
// comercio y /offers.
//
// Es un módulo sin React ni InsForge para poder probarlo de forma aislada y
// usarlo tanto en la capa de datos como en los componentes. Todos los cambios
// son aditivos: las solicitudes y ofertas tradicionales no pasan por aquí.
// =============================================================================

import { normalizeMatchingText } from '../utils/matching';

export const RECOMMENDATION_VEHICLE_TYPES = ['Carro', 'Moto'];

export const RECOMMENDATION_CATEGORIES = [
  'Accesorios Vehiculares',
  'Eléctrico',
  'Llantas y Neumáticos',
  'Audio y Sonido',
  'Seguridad Vehicular',
  'Lubricantes y Fluidos',
  'Interior / Exterior',
];

export const MAX_RECOMMENDED_OPTIONS = 5;

// La interfaz dice «Carro», pero el matching actual reconoce «Auto». Guardamos
// «Auto» para que el cruce vehículo ↔ comercio siga siendo el de siempre.
export const recommendationVehicleToStorage = (value) => {
  const key = normalizeMatchingText(value);
  if (['moto', 'motocicleta', 'scooter'].includes(key)) return 'Moto';
  return 'Auto';
};

export const normalizeRecommendationBudget = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
};

export const createRecommendedOptionId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `option-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const emptyRecommendedOption = () => ({
  key: createRecommendedOptionId(),
  title: '',
  price: '',
  image_url: '',
  gift_promo: '',
  warranty: '',
});

const cleanText = (value) => String(value ?? '').trim();

// Normaliza el mini-catálogo guardado en purchase_offers.recommended_options.
// La forma canónica siempre trae las seis claves acordadas con la base de datos.
export const normalizeRecommendedOptions = (value) => {
  const raw = Array.isArray(value) ? value : [];
  const usedIds = new Set();

  return raw
    .slice(0, MAX_RECOMMENDED_OPTIONS)
    .map((option, index) => {
      const title = cleanText(option?.title ?? option?.brand);
      const price = Number(option?.price);
      if (!title || !Number.isFinite(price) || price <= 0) return null;

      let id = cleanText(option?.id) || `option-${index + 1}`;
      if (usedIds.has(id)) id = `${id}-${index + 1}`;
      usedIds.add(id);

      const imageUrl = cleanText(option?.image_url ?? option?.photo ?? option?.photo_url);
      const giftPromo = cleanText(option?.gift_promo ?? option?.giftPromo);
      const warranty = cleanText(option?.warranty);
      const note = [giftPromo, warranty].filter(Boolean).join(' · ');

      return {
        id,
        title,
        // Alias para reutilizar el selector y el acuerdo de chat existentes.
        brand: title,
        price,
        image_url: imageUrl,
        photo: imageUrl,
        gift_promo: giftPromo,
        warranty,
        note,
        available: option?.available !== false,
        isRecommended: Boolean(option?.is_recommended ?? option?.isRecommended),
      };
    })
    .filter(Boolean);
};

// Validación en la app: el CHECK de PostgreSQL solo puede verificar el tamaño
// del arreglo, no la forma de cada elemento (no admite subconsultas).
export const validateRecommendedOptions = (options) => {
  if (!Array.isArray(options) || options.length === 0) {
    return 'Agrega al menos una opción recomendada.';
  }
  if (options.length > MAX_RECOMMENDED_OPTIONS) {
    return `Puedes agregar máximo ${MAX_RECOMMENDED_OPTIONS} opciones recomendadas.`;
  }

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index] || {};
    if (!cleanText(option.title)) {
      return `Escribe el nombre del producto de la opción ${index + 1}.`;
    }
    const price = Number(option.price);
    if (!Number.isFinite(price) || price <= 0) {
      return `Escribe el precio de la opción ${index + 1}.`;
    }
  }
  return null;
};

// Convierte las opciones del constructor en la forma canónica que se guarda en
// `recommended_options` (sin alias de UI).
export const serializeRecommendedOptions = (options = []) =>
  normalizeRecommendedOptions(options).map((option) => ({
    id: option.id,
    title: option.title,
    price: option.price,
    image_url: option.image_url,
    gift_promo: option.gift_promo,
    warranty: option.warranty,
  }));

// Las opciones recomendadas también viajan como `brand_options` de la oferta para
// que la selección (app_select_offer_option) y el chat actuales sigan
// funcionando sin una RPC nueva.
export const recommendationBrandOptions = (options = []) =>
  normalizeRecommendedOptions(options).map((option) => ({
    id: option.id,
    brand: option.title,
    price: option.price,
    available: option.available !== false,
    is_recommended: option.isRecommended,
    note: option.note,
    ...(option.image_url ? { photo: option.image_url } : {}),
  }));

// Una solicitud «Recomiéndame» no tiene referencia exacta: el ítem conserva
// solo el producto deseado y las preferencias para que el comercio cotice.
export const buildRecommendationItem = ({
  vehicleType = '',
  category = '',
  product = '',
  preferences = '',
} = {}) => {
  const storedVehicleType = recommendationVehicleToStorage(vehicleType);
  return {
    category: cleanText(category),
    item: cleanText(product),
    vehicleType: storedVehicleType,
    quantity: 1,
    images: [],
    notes: cleanText(preferences),
    is_recommendation: true,
  };
};
