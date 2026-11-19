// =============================================================================
// Cruce aditivo entre solicitudes y el inventario del negocio.
//
// Es lógica pura (sin red): el dashboard la usa para clasificar tarjetas y
// autocompletar la cotización. Nunca sustituye la decisión del comercio: solo
// propone precio, notas, foto, bono y alternativas compatibles.
// =============================================================================

export const READINESS_LABELS = {
  ready: 'Listo para enviar',
  partial: 'Coincidencia parcial',
  manual: 'Cotización manual',
};

export const FRESHNESS_LABELS = {
  current: 'Vigente',
  expiring: 'Vence pronto',
  expired: 'Fuera de vigencia',
  unknown: 'Sin vigencia registrada',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokens = (value) => normalizeText(value).split(' ').filter((word) => word.length >= 3);

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Vigencia: usa `valid_until` cuando existe y, si no, la fecha de actualización.
export function getFreshness(item, now = new Date()) {
  const validUntil = toDate(item?.valid_until || item?.validUntil);
  const updatedAt = toDate(item?.updated_at || item?.updatedAt);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (validUntil) {
    const limit = new Date(validUntil.getFullYear(), validUntil.getMonth(), validUntil.getDate());
    const days = Math.round((limit - today) / DAY_MS);
    if (days < 0) return { status: 'expired', label: FRESHNESS_LABELS.expired, days };
    if (days <= 7) return { status: 'expiring', label: FRESHNESS_LABELS.expiring, days };
    return { status: 'current', label: FRESHNESS_LABELS.current, days };
  }

  if (updatedAt) {
    const days = Math.round((today - new Date(updatedAt.getFullYear(), updatedAt.getMonth(), updatedAt.getDate())) / DAY_MS);
    if (days > 90) return { status: 'expiring', label: 'Inventario desactualizado', days };
    return { status: 'unknown', label: FRESHNESS_LABELS.unknown, days: null };
  }

  return { status: 'unknown', label: FRESHNESS_LABELS.unknown, days: null };
}

const isUsable = (item) =>
  Boolean(item) && item.is_active !== false && Number(item.stock ?? 0) > 0 && Number(item.price ?? 0) > 0;

// Puntaje simple y explicable: referencia exacta > producto > marca > categoría.
export function matchScore(requestItem, inventoryItem) {
  const productTokens = tokens(requestItem?.product || requestItem?.name || requestItem?.item);
  const inventoryTokens = tokens(inventoryItem?.name || inventoryItem?.sku);
  const overlaps = productTokens.filter((word) => inventoryTokens.includes(word)).length;

  const reference = normalizeText(requestItem?.reference || requestItem?.part_number);
  const sku = normalizeText(inventoryItem?.sku);
  const inventoryName = normalizeText(inventoryItem?.name);
  const referenceMatch = reference && (reference === sku || reference === inventoryName || inventoryName.includes(reference));

  const brand = normalizeText(requestItem?.brand || requestItem?.vehicleBrand);
  const inventoryBrand = normalizeText(inventoryItem?.brand);
  const brandMatch = brand && inventoryBrand && (brand === inventoryBrand || brand.includes(inventoryBrand) || inventoryBrand.includes(brand));

  const category = normalizeText(requestItem?.category);
  const inventoryCategory = normalizeText(inventoryItem?.category);
  const categoryMatch = category && inventoryCategory && (category === inventoryCategory || category.includes(inventoryCategory) || inventoryCategory.includes(category));

  const group = normalizeText(requestItem?.equivalenceGroup || requestItem?.equivalence_group);
  const inventoryGroup = normalizeText(inventoryItem?.equivalence_group || inventoryItem?.equivalenceGroup);
  const groupMatch = group && inventoryGroup && group === inventoryGroup;

  return overlaps * 4 + (referenceMatch ? 8 : 0) + (brandMatch ? 3 : 0) + (categoryMatch ? 2 : 0) + (groupMatch ? 5 : 0);
}

export function findInventoryMatches(requestItem, inventory = []) {
  if (!requestItem || !Array.isArray(inventory)) return [];
  return inventory
    .map((item) => ({ item, score: matchScore(requestItem, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(a.item?.name || '').localeCompare(String(b.item?.name || '')))
    .map((entry) => entry.item);
}

export function classifyRequest(requestItem, inventory = [], now = new Date()) {
  const matches = findInventoryMatches(requestItem, inventory);
  if (matches.length === 0) return { status: 'manual', label: READINESS_LABELS.manual, match: null };

  const best = matches[0];
  const score = matchScore(requestItem, best);
  const freshness = getFreshness(best, now);
  const reference = normalizeText(requestItem?.reference || requestItem?.part_number);
  const exactReference = Boolean(reference) && score >= 8;

  if (isUsable(best) && freshness.status !== 'expired' && (exactReference || score >= 6)) {
    return { status: 'ready', label: READINESS_LABELS.ready, match: best };
  }

  return { status: 'partial', label: READINESS_LABELS.partial, match: best };
}

const formatDate = (value) => {
  const date = toDate(value);
  if (!date) return '';
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function buildInventoryNotes(item) {
  if (!item) return '';
  const parts = [];
  if (item.sku) parts.push(`SKU ${item.sku}`);
  parts.push(`${Number(item.stock ?? 0)} disponibles`);
  const validity = item.valid_until || item.validUntil;
  if (validity) parts.push(`vigente hasta ${formatDate(validity)}`);
  return parts.join(' · ');
}

const alternativeFromItem = (item, index) => ({
  key: `inventory-alt-${item.id || index}`,
  brand: String(item.brand || item.name || '').trim(),
  price: String(item.price ?? ''),
  note: buildInventoryNotes(item),
  photo: item.photo || item.photo_url || null,
  available: isUsable(item),
  isRecommended: false,
});

// Propone valores para el editor existente de «Disponibilidad de tus productos».
export function autocompleteOfferItem(requestItem, inventory = [], now = new Date()) {
  const matches = findInventoryMatches(requestItem, inventory);
  const best = matches[0] || null;
  const readiness = classifyRequest(requestItem, inventory, now);

  return {
    readiness,
    price: best && Number(best.price) > 0 ? String(best.price) : '',
    notes: best ? buildInventoryNotes(best) : '',
    photo: best?.photo || best?.photo_url || null,
    bonus: String(best?.bonus || '').trim(),
    equivalenceGroup: String(best?.equivalence_group || best?.equivalenceGroup || '').trim(),
    freshness: best ? getFreshness(best, now) : null,
    alternatives: matches
      .filter((item) => item.id !== best?.id)
      .filter((item) => Number(item.price) > 0)
      .slice(0, 3)
      .map(alternativeFromItem),
    match: best,
  };
}

// Resumen de la tarjeta: solo «Listo para enviar» si TODOS los productos lo son.
export function getOpportunityReadiness(items = [], inventory = [], now = new Date()) {
  const mapped = items.map((item) => classifyRequest(item, inventory, now));
  if (mapped.length === 0) return { status: 'manual', label: READINESS_LABELS.manual };
  if (mapped.every((entry) => entry.status === 'ready')) {
    return { status: 'ready', label: READINESS_LABELS.ready };
  }
  if (mapped.some((entry) => entry.status !== 'manual')) {
    return { status: 'partial', label: READINESS_LABELS.partial };
  }
  return { status: 'manual', label: READINESS_LABELS.manual };
}
