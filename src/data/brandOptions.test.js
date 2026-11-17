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
  getSelectedOfferOption,
  mapOffer,
  normalizeBrandOptions,
  offerOptionAgreement,
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
});
