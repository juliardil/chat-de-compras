// Ordenamiento de ofertas recibidas por el comprador.
// Se comparte entre la sección «Ofertas» y el detalle de «Respuestas» para que
// ambas pantallas ordenen con las mismas reglas reales:
//   * distancia: usa la distancia real en km; las ofertas sin ubicación quedan
//     al final.
//   * precio: usa el importe cotizado (total_amount); las ofertas sin importe
//     quedan al final.
//   * tiempo de entrega: usa delivery_days; sin plazo, al final.
//   * confiabilidad: promedio de reseñas publicadas del comercio y, a igual
//     promedio, el comercio con más reseñas. Los comercios sin reseñas quedan
//     al final (no se les inventa una calificación).

export const OFFER_SORT_OPTIONS = [
  { key: 'distance', label: 'Menor distancia' },
  { key: 'price_asc', label: 'Menor precio' },
  { key: 'price_desc', label: 'Mayor precio' },
  { key: 'delivery', label: 'Entrega rápida' },
  { key: 'reliability', label: 'Confiabilidad' },
];

const toNumberOrNull = (value) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? null
    : Number(value);

const compareNullable = (a, b, direction = 'asc') => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === 'asc' ? a - b : b - a;
};

const getOfferComparator = (sortKey) => {
  if (sortKey === 'distance') {
    return (a, b) =>
      compareNullable(toNumberOrNull(a.distanceKm), toNumberOrNull(b.distanceKm), 'asc');
  }

  if (sortKey === 'price_asc') {
    return (a, b) => compareNullable(toNumberOrNull(a.amount), toNumberOrNull(b.amount), 'asc');
  }

  if (sortKey === 'price_desc') {
    return (a, b) => compareNullable(toNumberOrNull(a.amount), toNumberOrNull(b.amount), 'desc');
  }

  if (sortKey === 'delivery') {
    return (a, b) =>
      compareNullable(toNumberOrNull(a.deliveryDays), toNumberOrNull(b.deliveryDays), 'asc');
  }

  if (sortKey === 'reliability') {
    return (a, b) => {
      // La reputación integra reseñas publicadas, respuestas dentro del SLA y
      // entregas a tiempo. Para comercios sin historial se mantiene el criterio
      // anterior (promedio de reseñas y número de reseñas).
      const byReputation = compareNullable(
        a.reputationScore ?? null,
        b.reputationScore ?? null,
        'desc'
      );
      if (byReputation !== 0) return byReputation;

      const byRating = compareNullable(a.rating ?? null, b.rating ?? null, 'desc');
      if (byRating !== 0) return byRating;
      if (a.ratingCount !== b.ratingCount) return (b.ratingCount || 0) - (a.ratingCount || 0);

      return compareNullable(
        a.deliveryOnTimeRate ?? null,
        b.deliveryOnTimeRate ?? null,
        'desc'
      );
    };
  }

  return null;
};

export const sortOffers = (list, sortKey) => {
  const comparator = getOfferComparator(sortKey);
  if (!Array.isArray(list) || !comparator) return list;

  return [...list].sort(comparator);
};

// Los productos se muestran agrupados. Al elegir un criterio, cada grupo se
// ordena por dentro y los grupos se ordenan por su mejor oferta, para que el
// selector también tenga efecto cuando hay una sola oferta por producto.
export const sortOfferGroups = (groups, sortKey) => {
  const comparator = getOfferComparator(sortKey);
  if (!Array.isArray(groups) || !comparator) return groups;

  return [...groups]
    .map((group) => ({ ...group, offers: sortOffers(group.offers, sortKey) }))
    .sort((a, b) => comparator(a.offers[0], b.offers[0]));
};
