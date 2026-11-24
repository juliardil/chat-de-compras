import { describe, expect, it } from 'vitest';
import {
  ALL_RECOMMENDATION_GROUPS,
  MAX_RECOMMENDED_OPTIONS,
  MAX_SAVED_RECOMMENDED_OPTIONS,
  RECOMMENDATION_CATEGORIES,
  RECOMMENDATION_VEHICLE_TYPES,
  buildRecommendationGroups,
  buildRecommendationItem,
  emptyRecommendedOption,
  getSavedRecommendationGroup,
  inferRecommendationGroup,
  normalizeRecommendedOptions,
  normalizeRecommendationBudget,
  normalizeRecommendationGroup,
  normalizeSavedRecommendedOptions,
  recommendationBrandOptions,
  recommendationVehicleToStorage,
  serializeRecommendedOptions,
  validateRecommendedOptions,
} from './recommendations';

describe('reglas del flujo «Recomiéndame»', () => {
  it('ofrece solo los vehículos y las líneas canónicas del enrutamiento', () => {
    expect(RECOMMENDATION_VEHICLE_TYPES).toEqual(['Carro', 'Moto']);
    expect(RECOMMENDATION_CATEGORIES).toEqual([
      'Accesorios Vehiculares',
      'Eléctrico',
      'Llantas y Neumáticos',
      'Audio y Sonido',
      'Seguridad Vehicular',
      'Lubricantes y Fluidos',
      'Interior / Exterior',
    ]);
    expect(MAX_RECOMMENDED_OPTIONS).toBe(5);
    expect(ALL_RECOMMENDATION_GROUPS).toBe('Todas');
  });

  it('normaliza y deduce grupos con capitalización y plurales en español', () => {
    expect(normalizeRecommendationGroup('  baterias  ')).toBe('Baterías');
    expect(normalizeRecommendationGroup('BATERÍAS DEL AUTO')).toBe('Baterías Del Auto');
    expect(normalizeRecommendationGroup('')).toBe('');

    expect(inferRecommendationGroup('Batería para moto')).toBe('Baterías');
    expect(inferRecommendationGroup('bombillo led h4')).toBe('Bombillos');
    expect(inferRecommendationGroup('BOMBILLOS 12V')).toBe('Bombillos');
    expect(inferRecommendationGroup('Llanta 195/65 R15')).toBe('Llantas');
    expect(inferRecommendationGroup('Casco integral talla M')).toBe('Cascos');
    expect(inferRecommendationGroup('')).toBe('');
  });

  it('guarda «Carro» como «Auto» y deja «Moto» como «Moto»', () => {
    expect(recommendationVehicleToStorage('Carro')).toBe('Auto');
    expect(recommendationVehicleToStorage('Moto')).toBe('Moto');
    expect(recommendationVehicleToStorage('motocicleta')).toBe('Moto');
    expect(recommendationVehicleToStorage('')).toBe('Auto');
  });

  it('normaliza el presupuesto aproximado y rechaza valores inválidos', () => {
    expect(normalizeRecommendationBudget('2500')).toBe(2500);
    expect(normalizeRecommendationBudget(' 1250.559 ')).toBe(1250.56);
    expect(normalizeRecommendationBudget(0)).toBe(0);
    expect(normalizeRecommendationBudget('')).toBeNull();
    expect(normalizeRecommendationBudget(null)).toBeNull();
    expect(normalizeRecommendationBudget('abc')).toBeNull();
    expect(normalizeRecommendationBudget(-1)).toBeNull();
  });

  it('construye un ítem sin referencia exacta ni datos de vehículo inventados', () => {
    const item = buildRecommendationItem({
      vehicleType: 'Carro',
      category: 'Eléctrico',
      product: 'Batería',
      preferences: 'Talla M, color negro',
    });

    expect(item).toEqual({
      category: 'Eléctrico',
      item: 'Batería',
      vehicleType: 'Auto',
      quantity: 1,
      images: [],
      notes: 'Talla M, color negro',
      is_recommendation: true,
    });
    expect(item).not.toHaveProperty('reference');
    expect(item).not.toHaveProperty('vehicleBrand');
    expect(item).not.toHaveProperty('vehicleModel');
    expect(item).not.toHaveProperty('yearFrom');
  });

  it('incluye marca y modelo opcionales sin inventar una referencia', () => {
    const item = buildRecommendationItem({
      vehicleType: 'Carro',
      category: 'Eléctrico',
      product: 'Batería',
      preferences: 'Talla YTX9-BS',
      brand: ' Toyota ',
      model: ' Corolla ',
    });

    expect(item).toMatchObject({
      brand: 'Toyota',
      vehicleBrand: 'Toyota',
      model: 'Corolla',
      vehicleModel: 'Corolla',
    });
    expect(item).not.toHaveProperty('year');
    expect(item).not.toHaveProperty('yearFrom');
    expect(item).not.toHaveProperty('yearTo');
    expect(item).not.toHaveProperty('reference');
  });

  it('normaliza el mini-catálogo con la forma exacta de la base de datos', () => {
    const options = normalizeRecommendedOptions([
      {
        id: 'opt-1',
        title: ' Casco integral ',
        price: '480.50',
        image_url: 'https://cdn.example.com/casco.jpg',
        gift_promo: ' Guantes gratis ',
        warranty: '1 año',
      },
      {
        id: 'opt-1',
        brand: 'Batería 12V',
        price: 1200,
        photo: 'https://cdn.example.com/bateria.jpg',
        giftPromo: 'Cargador',
      },
    ]);

    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({
      id: 'opt-1',
      title: 'Casco integral',
      brand: 'Casco integral',
      price: 480.5,
      image_url: 'https://cdn.example.com/casco.jpg',
      photo: 'https://cdn.example.com/casco.jpg',
      gift_promo: 'Guantes gratis',
      warranty: '1 año',
      note: 'Guantes gratis · 1 año',
      available: true,
    });
    expect(options[1]).toMatchObject({
      id: 'opt-1-2',
      title: 'Batería 12V',
      price: 1200,
      gift_promo: 'Cargador',
      note: 'Cargador',
    });
  });

  it('conserva el grupo/carpeta de cada opción y acepta el alias group', () => {
    const options = normalizeRecommendedOptions([
      { id: 'opt-1', title: 'Batería YTX9', price: 1200, category_group: 'baterias' },
      { id: 'opt-2', title: 'Bombillo H4', price: 90, group: 'BOMBILLOS' },
    ]);

    expect(options.map((option) => option.category_group)).toEqual(['Baterías', 'Bombillos']);
  });

  it('descarta opciones incompletas y limita el catálogo a cinco', () => {
    const raw = Array.from({ length: 7 }, (_, index) => ({
      id: `opt-${index + 1}`,
      title: `Opción ${index + 1}`,
      price: 100 + index,
    }));
    raw.push({ id: 'sin-precio', title: 'Sin precio', price: '' });
    raw.push({ id: 'sin-nombre', title: '   ', price: 50 });

    const options = normalizeRecommendedOptions(raw);
    expect(options).toHaveLength(MAX_RECOMMENDED_OPTIONS);
    expect(options.map((option) => option.id)).toEqual([
      'opt-1',
      'opt-2',
      'opt-3',
      'opt-4',
      'opt-5',
    ]);
    expect(normalizeRecommendedOptions(null)).toEqual([]);
  });

  it('recopila solo tarjetas con foto, deduplicadas por título e imagen', () => {
    const offers = [
      {
        id: 'offer-old',
        created_at: '2026-01-01T00:00:00Z',
        recommended_options: [
          {
            id: 'old-casco',
            title: 'Casco Integral M',
            price: 400,
            image_url: 'https://storage.example.com/casco.jpg',
            gift_promo: 'Guantes',
            warranty: '6 meses',
          },
          { id: 'sin-foto', title: 'Sin foto', price: 100 },
        ],
      },
      {
        id: 'offer-new',
        created_at: '2026-02-01T00:00:00Z',
        recommended_options: [
          {
            id: 'new-casco',
            title: 'casco integral m',
            price: 480,
            image_url: 'https://storage.example.com/casco.jpg',
            gift_promo: 'Guantes gratis',
            warranty: '1 año',
          },
          {
            id: 'new-bateria',
            title: 'Batería YTX9',
            price: 1200,
            image_url: 'https://storage.example.com/bateria.jpg',
          },
        ],
      },
    ];

    const cards = normalizeSavedRecommendedOptions(offers);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      id: 'offer-new-new-casco',
      title: 'casco integral m',
      price: 480,
      image_url: 'https://storage.example.com/casco.jpg',
      gift_promo: 'Guantes gratis',
      warranty: '1 año',
      category_group: 'Cascos',
    });
    expect(cards[1]).toMatchObject({
      id: 'offer-new-new-bateria',
      title: 'Batería YTX9',
      price: 1200,
      category_group: 'Baterías',
    });
  });

  it('clasifica tarjetas antiguas desde el producto de la solicitud original', () => {
    const offers = [
      {
        id: 'offer-1',
        request_id: 'req-1',
        created_at: '2026-02-01T00:00:00Z',
        recommended_options: [
          {
            id: 'opt-1',
            title: 'Opción económica',
            price: 100,
            image_url: 'https://storage.example.com/1.jpg',
          },
        ],
      },
      {
        id: 'offer-2',
        request_id: 'req-2',
        created_at: '2026-02-02T00:00:00Z',
        recommended_options: [
          {
            id: 'opt-2',
            title: 'Opción premium',
            price: 200,
            image_url: 'https://storage.example.com/2.jpg',
            category_group: 'bombillos',
          },
        ],
      },
      {
        id: 'offer-3',
        request_id: 'req-3',
        created_at: '2026-02-03T00:00:00Z',
        recommended_options: [
          {
            id: 'opt-3',
            title: 'Batería YTX9',
            price: 300,
            image_url: 'https://storage.example.com/3.jpg',
          },
        ],
      },
    ];

    const cards = normalizeSavedRecommendedOptions(offers, {
      'req-1': 'Batería para moto',
      'req-2': 'Bombillo H4',
      'req-3': '',
    });

    expect(cards.map((card) => card.category_group)).toEqual([
      'Baterías',
      'Bombillos',
      'Baterías',
    ]);
    expect(getSavedRecommendationGroup(cards[1])).toBe('Bombillos');
    expect(buildRecommendationGroups(cards)).toEqual([
      { name: 'Baterías', count: 2 },
      { name: 'Bombillos', count: 1 },
    ]);
  });

  it('limita la biblioteca privada del comercio a 50 tarjetas', () => {
    const offers = Array.from({ length: 11 }, (_, offerIndex) => ({
      id: `offer-${offerIndex}`,
      created_at: `2026-01-${String(offerIndex + 1).padStart(2, '0')}T00:00:00Z`,
      recommended_options: Array.from({ length: 5 }, (_, optionIndex) => ({
        id: `opt-${optionIndex}`,
        title: `Producto ${offerIndex}-${optionIndex}`,
        price: 100 + optionIndex,
        image_url: `https://cdn.example.com/${offerIndex}-${optionIndex}.jpg`,
      })),
    }));

    expect(normalizeSavedRecommendedOptions(offers)).toHaveLength(
      MAX_SAVED_RECOMMENDED_OPTIONS
    );
    expect(normalizeSavedRecommendedOptions(null)).toEqual([]);
  });

  it('valida nombre y precio de cada opción antes de enviarla', () => {
    const valid = [
      { title: 'Opción 1', price: 100 },
      { title: 'Opción 2', price: 250 },
    ];
    expect(validateRecommendedOptions(valid)).toBeNull();
    expect(validateRecommendedOptions([])).toMatch(/al menos una/i);
    expect(validateRecommendedOptions(valid.concat(Array(4).fill(valid[0])))).toMatch(
      /máximo 5/i
    );
    expect(validateRecommendedOptions([{ title: '', price: 10 }])).toMatch(
      /nombre del producto de la opción 1/i
    );
    expect(validateRecommendedOptions([{ title: 'A', price: '0' }])).toMatch(
      /precio de la opción 1/i
    );
  });

  it('serializa sin alias de UI y replica las opciones para el selector existente', () => {
    const raw = [
      {
        key: 'ui-1',
        title: 'Casco',
        price: '500',
        image_url: 'https://cdn.example.com/casco.jpg',
        gift_promo: 'Guantes',
        warranty: '1 año',
      },
    ];

    expect(serializeRecommendedOptions(raw)).toEqual([
      {
        id: 'option-1',
        title: 'Casco',
        price: 500,
        image_url: 'https://cdn.example.com/casco.jpg',
        gift_promo: 'Guantes',
        warranty: '1 año',
      },
    ]);
    expect(recommendationBrandOptions(raw)).toEqual([
      {
        id: 'option-1',
        brand: 'Casco',
        price: 500,
        available: true,
        is_recommended: false,
        note: 'Guantes · 1 año',
        photo: 'https://cdn.example.com/casco.jpg',
      },
    ]);
    expect(
      serializeRecommendedOptions([{ ...raw[0], category_group: 'baterias' }])[0]
    ).toMatchObject({ category_group: 'Baterías' });
  });

  it('crea opciones vacías con claves únicas para el constructor', () => {
    const a = emptyRecommendedOption();
    const b = emptyRecommendedOption();
    expect(a.key).not.toBe(b.key);
    expect(a).toMatchObject({
      title: '',
      price: '',
      image_url: '',
      gift_promo: '',
      warranty: '',
      category_group: '',
    });
  });
});
