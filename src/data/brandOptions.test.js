import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simula un backend conectado para ejercitar el RPC de selección sin red.
const harness = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../lib/insforge', () => ({
  isInsforgeConfigured: true,
  get insforge() {
    return { database: { rpc: harness.rpc } };
  },
}));

const {
  DEFAULT_OFFER_BRAND,
  getOfferEffectiveAmount,
  getSelectedOfferOption,
  mapOffer,
  normalizeBrandOptions,
  normalizeItemBrandOptions,
  offerItemAgreement,
  offerOptionAgreement,
  selectOfferItemBrands,
  selectOfferOption,
} = await import('./appData');

const brandRow = () => ({
  id: 'offer-1',
  request_id: 'request-1',
  total_amount: 500,
  currency: 'MXN',
  brand_options: [
    {
      id: 'mobil',
      brand: ' Mobil ',
      price: '480',
      available: true,
      is_recommended: true,
      note: ' Mejor rendimiento ',
    },
    {
      id: 'lubrax',
      brand: 'Lubrax',
      price: 450,
      available: true,
      is_recommended: false,
      note: 'Precio especial',
    },
  ],
});

describe('opciones de marca de una oferta', () => {
  beforeEach(() => {
    harness.rpc.mockReset();
  });

  it('convierte una oferta antigua de precio único en una opción por defecto', () => {
    expect(normalizeBrandOptions({ total_amount: 900, currency: 'MXN' })).toEqual([
      {
        id: 'legacy-default',
        brand: DEFAULT_OFFER_BRAND,
        price: 900,
        available: true,
        isRecommended: true,
        note: '',
      },
    ]);
  });

  it('normaliza las opciones nuevas y descarta las que no tienen precio', () => {
    const options = normalizeBrandOptions({
      total_amount: 900,
      brand_options: [
        { id: 'mobil', brand: 'Mobil', price: '480', is_recommended: true, note: '  Rendimiento  ' },
        { id: 'sin-precio', brand: 'Sin precio', price: null },
      ],
    });

    expect(options).toHaveLength(1);
    expect(options[0]).toEqual({
      id: 'mobil',
      brand: 'Mobil',
      price: 480,
      available: true,
      isRecommended: true,
      note: 'Rendimiento',
    });
  });

  it('no inventa opciones cuando no hay precio ni arreglo de marcas', () => {
    expect(normalizeBrandOptions({ total_amount: 0 })).toEqual([]);
    expect(normalizeBrandOptions({ total_amount: null, brand_options: [] })).toEqual([]);
  });

  it('recupera la opción elegida por id y también por marca/precio antiguo', () => {
    const row = {
      ...brandRow(),
      selected_option: { id: 'lubrax', brand: 'Lubrax', price: 450 },
      selected_at: '2026-11-17T12:00:00.000Z',
    };

    expect(getSelectedOfferOption(row)).toMatchObject({
      id: 'lubrax',
      brand: 'Lubrax',
      price: 450,
      note: 'Precio especial',
      selectedAt: '2026-11-17T12:00:00.000Z',
      currency: 'MXN',
    });

    expect(
      getSelectedOfferOption({
        ...brandRow(),
        selected_option: { brand: 'Mobil', price: 480 },
      })
    ).toMatchObject({ id: 'mobil', brand: 'Mobil', price: 480 });
  });

  it('expone las opciones y la elegida en la oferta mapeada para la interfaz', () => {
    const offer = mapOffer({
      ...brandRow(),
      selected_option: { id: 'mobil', brand: 'Mobil', price: 480 },
    });

    expect(offer.brandOptions.map((option) => option.brand)).toEqual(['Mobil', 'Lubrax']);
    expect(offer.brandOptions[0].priceLabel).toBe('$480.00');
    expect(offer.selectedOption).toMatchObject({
      id: 'mobil',
      brand: 'Mobil',
      price: 480,
      priceLabel: '$480.00',
    });
  });

  it('convierte la opción elegida en el acuerdo inicial del chat', () => {
    const option = normalizeBrandOptions(brandRow())[0];

    expect(offerOptionAgreement(option)).toEqual({
      id: 'mobil',
      brand: 'Mobil',
      price: 480,
      available: true,
      is_recommended: true,
      note: 'Mejor rendimiento',
    });
    expect(offerOptionAgreement(null)).toBeNull();
  });

  it('guarda la elección mediante el RPC autorizado', async () => {
    harness.rpc.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await selectOfferOption({ offerId: 'offer-1', optionId: 'mobil' });

    expect(result).toEqual({ ok: true, data: { ok: true }, error: null });
    expect(harness.rpc).toHaveBeenCalledWith('app_select_offer_option', {
      p_offer_id: 'offer-1',
      p_option_id: 'mobil',
    });
  });

  it('traduce el rechazo del RPC al guardar la marca elegida', async () => {
    harness.rpc.mockResolvedValue({ data: null, error: { statusCode: 403 } });

    const result = await selectOfferOption({ offerId: 'offer-1', optionId: 'mobil' });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/permisos/i);
  });

  it('normaliza las marcas guardadas dentro de cada producto', () => {
    const options = normalizeItemBrandOptions({
      brand_options: [
        { id: 'sony', brand: ' Sony ', price: '120', note: 'Garantía' },
        { id: 'sin-precio', brand: 'Sin precio', price: null },
      ],
    });

    expect(options).toEqual([
      {
        id: 'sony',
        brand: 'Sony',
        price: 120,
        available: true,
        isRecommended: false,
        note: 'Garantía',
      },
    ]);
  });

  it('expone las marcas por producto y calcula el importe con la elección de cada uno', () => {
    const offer = mapOffer({
      ...brandRow(),
      total_amount: 600,
      items: [
        {
          key: 'item-1',
          name: 'Bafles',
          quantity: 2,
          available: true,
          unitPrice: 250,
          totalPrice: 500,
          brand_options: [
            { id: 'sony', brand: 'Sony', price: 220, available: true, note: 'Recomendada' },
            { id: 'pioneer', brand: 'Pioneer', price: 240, available: true },
          ],
        },
        {
          key: 'item-2',
          name: 'GPS',
          quantity: 1,
          available: true,
          unitPrice: 100,
          totalPrice: 100,
          brand_options: [{ id: 'garmin', brand: 'Garmin', price: 110, available: true }],
        },
      ],
      selected_item_options: {
        'item-1': { id: 'sony', brand: 'Sony', price: 220 },
        'item-2': { id: 'garmin', brand: 'Garmin', price: 110 },
      },
    });

    expect(offer.brandOptionsByItem).toBe(true);
    expect(offer.brandOptions).toEqual([]);
    expect(offer.items[0].brandOptions).toHaveLength(2);
    expect(offer.items[0].selectedOption).toMatchObject({ brand: 'Sony', amount: 440 });
    expect(offer.items[1].selectedOption).toMatchObject({ brand: 'Garmin', amount: 110 });
    expect(getOfferEffectiveAmount(offer)).toBe(550);
  });

  it('convierte las elecciones por producto en el acuerdo desglosado del chat', () => {
    expect(
      offerItemAgreement([
        {
          item_key: 'item-1',
          item_name: 'Bafles',
          quantity: 2,
          option: normalizeItemBrandOptions({
            brand_options: [{ id: 'sony', brand: 'Sony', price: 220, note: 'Garantía' }],
          })[0],
        },
      ])
    ).toEqual([
      {
        item_key: 'item-1',
        item_name: 'Bafles',
        quantity: 2,
        id: 'sony',
        brand: 'Sony',
        price: 220,
        available: true,
        is_recommended: false,
        note: 'Garantía',
      },
    ]);
  });

  it('guarda todas las marcas elegidas por producto con un solo RPC', async () => {
    harness.rpc.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await selectOfferItemBrands({
      offerId: 'offer-1',
      selections: { 'item-1': 'sony', 'item-2': 'garmin' },
    });

    expect(result).toEqual({ ok: true, data: { ok: true }, error: null });
    expect(harness.rpc).toHaveBeenCalledWith('app_select_offer_item_brands', {
      p_offer_id: 'offer-1',
      p_selections: { 'item-1': 'sony', 'item-2': 'garmin' },
    });
  });
});
