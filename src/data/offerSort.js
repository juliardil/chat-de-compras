// Ordenamiento de ofertas recibidas por el comprador.
// Se comparte entre la sección «Ofertas» y el detalle de «Respuestas» para que
// ambas pantallas ordenen con las mismas reglas reales:
//   * precio: usa el importe cotizado (total_amount); las ofertas sin importe
//     quedan al final.
//   * tiempo de entrega: usa delivery_days; sin plazo, al final.
//   * confiabilidad: promedio de reseñas publicadas del comercio y, a igual
//     promedio, el comercio con más reseñas. Los comercios sin reseñas quedan
//     al final (no se les inventa una calificación).

export const OFFER_SORT_OPTIONS = [
  { key: 'relevance', label: 'Relevancia' },
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

export const sortOffers = (list, sortKey) => {
  if (!Array.isArray(list) || sortKey === 'relevance') return list;

  return [...list].sort((a, b) => {
    if (sortKey === 'price_asc') {
      return compareNullable(toNumberOrNull(a.amount), toNumberOrNull(b.amount), 'asc');
    }

    if (sortKey === 'price_desc') {
      return compareNullable(toNumberOrNull(a.amount), toNumberOrNull(b.amount), 'desc');
    }

    if (sortKey === 'delivery') {
      return compareNullable(toNumberOrNull(a.deliveryDays), toNumberOrNull(b.deliveryDays), 'asc');
    }

    const byRating = compareNullable(a.rating ?? null, b.rating ?? null, 'desc');
    if (byRating !== 0) return byRating;
    return (b.ratingCount || 0) - (a.ratingCount || 0);
  });
};
