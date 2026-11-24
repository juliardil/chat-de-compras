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

// Tope de tarjetas propias que se ofrecen en el selector del comercio.
export const MAX_SAVED_RECOMMENDED_OPTIONS = 50;

// Pestaña que muestra toda la biblioteca privada del comercio.
export const ALL_RECOMMENDATION_GROUPS = 'Todas';

const FALLBACK_RECOMMENDATION_GROUP = 'Otros';

// Grupos canónicos para las tarjetas antiguas que aún no traen
// `category_group`. Se infieren del producto de la solicitud original (o, en
// su defecto, del título de la tarjeta) sin inventar un catálogo público.
const RECOMMENDATION_GROUP_RULES = [
  { words: ['bateria', 'baterias', 'acumulador', 'acumuladores'], label: 'Baterías' },
  {
    words: [
      'bombillo', 'bombillos', 'bombilla', 'bombillas', 'foco', 'focos',
      'ampolleta', 'ampoletas', 'ampolla', 'ampollas',
    ],
    label: 'Bombillos',
  },
  { words: ['llanta', 'llantas', 'neumatico', 'neumaticos', 'rueda', 'ruedas'], label: 'Llantas' },
  { words: ['casco', 'cascos'], label: 'Cascos' },
  { words: ['aceite', 'lubricante', 'lubricantes'], label: 'Lubricantes' },
  { words: ['filtro', 'filtros'], label: 'Filtros' },
  { words: ['freno', 'frenos', 'pastilla', 'pastillas'], label: 'Frenos' },
  { words: ['faro', 'faros'], label: 'Faros' },
  { words: ['espejo', 'espejos'], label: 'Espejos' },
  { words: ['bujia', 'bujias'], label: 'Bujías' },
  { words: ['correa', 'correas'], label: 'Correas' },
  { words: ['manguera', 'mangueras'], label: 'Mangueras' },
  { words: ['radiador', 'radiadores'], label: 'Radiadores' },
  { words: ['alternador', 'alternadores'], label: 'Alternadores' },
  { words: ['parlante', 'parlantes', 'bocina', 'bocinas', 'audio'], label: 'Audio' },
  { words: ['silla', 'asiento', 'asientos'], label: 'Asientos' },
];

const CANONICAL_RECOMMENDATION_GROUPS = [
  ...RECOMMENDATION_GROUP_RULES.map(({ label }) => label),
  FALLBACK_RECOMMENDATION_GROUP,
];

const RECOMMENDATION_GROUP_STOP_WORDS = new Set([
  'para', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'con', 'talla', 'modelo', 'original', 'compatible', 'repuesto', 'repuestos',
  'nuevo', 'nueva', 'moto', 'motocicleta', 'carro', 'auto', 'vehiculo',
  'vehicular',
]);

const pluralizeGroupWord = (word) => {
  if (!word) return '';
  if (word.endsWith('s')) return word;
  if (/(z|x|ch|sh)$/.test(word)) return `${word}es`;
  if (/[aeiou]$/.test(word)) return `${word}s`;
  return `${word}es`;
};

// Mantiene la capitalización de los grupos creados por el comercio y recupera
// los acentos canónicos: "baterias" y "BATERÍAS" se muestran como "Baterías".
export const normalizeRecommendationGroup = (value) => {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase('es') + word.slice(1).toLocaleLowerCase('es'))
    .join(' ');

  if (!cleaned) return '';
  return (
    CANONICAL_RECOMMENDATION_GROUPS.find(
      (label) => normalizeMatchingText(label) === normalizeMatchingText(cleaned)
    ) || cleaned
  );
};

export const inferRecommendationGroup = (value) => {
  const normalized = normalizeMatchingText(value);
  if (!normalized) return '';

  const tokens = normalized.split(' ').filter(Boolean);
  const meaningful = tokens.filter((token) => !RECOMMENDATION_GROUP_STOP_WORDS.has(token));
  const candidates = meaningful.length > 0 ? meaningful : tokens;

  for (const token of candidates) {
    const rule = RECOMMENDATION_GROUP_RULES.find(({ words }) => words.includes(token));
    if (rule) return rule.label;
  }

  const root = candidates[0];
  return root ? normalizeRecommendationGroup(pluralizeGroupWord(root)) : '';
};

export const getSavedRecommendationGroup = (card) =>
  normalizeRecommendationGroup(card?.category_group) ||
  inferRecommendationGroup(card?.title) ||
  FALLBACK_RECOMMENDATION_GROUP;

// Conteo usado por las pestañas del selector privado. Las tarjetas sin grupo
// guardado ya vienen clasificadas por la capa de datos.
export const buildRecommendationGroups = (cards = []) => {
  const counts = new Map();
  (Array.isArray(cards) ? cards : []).forEach((card) => {
    const name = getSavedRecommendationGroup(card);
    counts.set(name, (counts.get(name) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));
};

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
  // Opcional: agrupa tarjetas del propio comercio dentro de su biblioteca
  // privada. Las opciones antiguas que no lo traen siguen siendo válidas.
  category_group: '',
});

const cleanText = (value) => String(value ?? '').trim();

// Normaliza el mini-catálogo guardado en purchase_offers.recommended_options.
// La forma canónica trae las seis claves acordadas con la base de datos y,
// cuando el comercio lo capturó, el grupo/carpeta `category_group` (alias
// `group` para opciones escritas a mano).
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
      // `group` se acepta como alias de opciones escritas a mano; la forma
      // guardada canónica es `category_group`.
      const categoryGroup = normalizeRecommendationGroup(option?.category_group ?? option?.group);
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
        category_group: categoryGroup,
        note,
        available: option?.available !== false,
        isRecommended: Boolean(option?.is_recommended ?? option?.isRecommended),
      };
    })
    .filter(Boolean);
};

// Biblioteca privada del comercio: opciones que él mismo envió en ofertas
// anteriores. Solo se reutilizan tarjetas con foto ya alojada en Storage; la
// llave de deduplicación es título + imagen (sin distinguir mayúsculas ni
// acentos en el título). Si una tarjeta aparece varias veces, gana la más
// reciente para mostrar su último precio.
export const normalizeSavedRecommendedOptions = (offers = [], productByRequest = {}) => {
  const rows = Array.isArray(offers) ? offers : [];
  const products = productByRequest && typeof productByRequest === 'object' ? productByRequest : {};
  const newestFirst = [...rows].sort((a, b) =>
    String(b?.created_at || '').localeCompare(String(a?.created_at || ''))
  );
  const seen = new Set();
  const cards = [];

  newestFirst.forEach((row) => {
    const requestProduct = products[row?.request_id] || row?.request_product || row?.title;

    normalizeRecommendedOptions(row?.recommended_options).forEach((option) => {
      if (!option.image_url || cards.length >= MAX_SAVED_RECOMMENDED_OPTIONS) return;
      const key = `${normalizeMatchingText(option.title)}|${option.image_url.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      // El grupo escrito por el comercio manda; si la tarjeta es antigua se
      // clasifica desde el producto de la solicitud original.
      const categoryGroup =
        option.category_group ||
        inferRecommendationGroup(requestProduct) ||
        inferRecommendationGroup(option.title) ||
        FALLBACK_RECOMMENDATION_GROUP;

      cards.push({
        id: `${row?.id || 'offer'}-${option.id}`,
        title: option.title,
        price: option.price,
        image_url: option.image_url,
        gift_promo: option.gift_promo,
        warranty: option.warranty,
        category_group: categoryGroup,
      });
    });
  });

  return cards;
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
    // Solo se escribe cuando el comercio eligió un grupo: las opciones
    // anteriores siguen guardándose con su forma original.
    ...(option.category_group ? { category_group: option.category_group } : {}),
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
  brand = '',
  model = '',
} = {}) => {
  const storedVehicleType = recommendationVehicleToStorage(vehicleType);
  const vehicleBrand = cleanText(brand);
  const vehicleModel = cleanText(model);

  return {
    category: cleanText(category),
    item: cleanText(product),
    vehicleType: storedVehicleType,
    quantity: 1,
    images: [],
    notes: cleanText(preferences),
    is_recommendation: true,
    // Los alias `vehicleBrand`/`vehicleModel` son los que ya lee el panel del
    // comercio; `brand`/`model` viajan explícitamente cuando el comprador los
    // capturó. Nada de esto crea un número de referencia.
    ...(vehicleBrand ? { brand: vehicleBrand, vehicleBrand } : {}),
    ...(vehicleModel ? { model: vehicleModel, vehicleModel } : {}),
  };
};
