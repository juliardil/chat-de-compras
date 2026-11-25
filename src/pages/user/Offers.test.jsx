import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Offers from './Offers';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    expireOfferLifecycles: vi.fn(),
    fetchActiveOfferLifecycles: vi.fn(),
    fetchBuyerOffers: vi.fn(),
    fetchBuyerRequests: vi.fn(),
    selectOfferForLifecycle: vi.fn(),
    selectOfferItemBrands: vi.fn(),
    selectOfferOption: vi.fn(),
    syncLifecycleSelections: vi.fn(),
  };
});

import {
  expireOfferLifecycles,
  fetchActiveOfferLifecycles,
  fetchBuyerOffers,
  fetchBuyerRequests,
  selectOfferForLifecycle,
  selectOfferItemBrands,
  selectOfferOption,
  syncLifecycleSelections,
} from '../../data/appData';

const offer = (id, requestId, store, amount) => ({
  id,
  request_id: requestId,
  commerce_id: `commerce-${id}`,
  commerce_name: store,
  total_amount: amount,
  currency: 'MXN',
  delivery_days: 2,
  conditions: 'Pago contra entrega',
  status: 'sent',
  items: [{ name: 'Pastillas', available: true }],
});

const multiBrandOffer = () => ({
  ...offer('offer-multi', 'req-1', 'Comercio Multi', 500),
  brand_options: [
    {
      id: 'mobil',
      brand: 'Mobil',
      price: 500,
      available: true,
      is_recommended: true,
      note: 'Mejor rendimiento',
    },
    {
      id: 'lubrax',
      brand: 'Lubrax',
      price: 450,
      available: true,
      is_recommended: false,
      note: 'Opción económica',
    },
  ],
});

const perItemOffer = () => ({
  ...offer('offer-items', 'req-1', 'Comercio Multi', 600),
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
        {
          id: 'sony',
          brand: 'Sony',
          price: 220,
          available: true,
          is_recommended: true,
          note: 'Garantía',
        },
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
});

const request = (id, title) => ({
  id,
  title,
  description: 'Repuesto solicitado',
  status: 'open',
  currency: 'MXN',
  created_at: new Date().toISOString(),
  items: [{ item: title }],
});

const recommendationOffer = () => ({
  ...offer('offer-rec', 'req-rec', 'Comercio Recomienda', 480),
  recommended_options: [
    {
      id: 'casco-m',
      title: 'Casco integral talla M',
      price: 480,
      image_url: 'https://cdn.example.com/casco-m.jpg',
      gift_promo: 'Guantes gratis',
      warranty: '1 año',
    },
    {
      id: 'casco-l',
      title: 'Casco integral talla L',
      price: 520,
      image_url: 'https://cdn.example.com/casco-l.jpg',
      gift_promo: '',
      warranty: '6 meses',
    },
  ],
});

const renderOffers = (user = { id: 'buyer-1', role: 'user' }) =>
  render(
    <AuthContext.Provider value={{ user }}>
      <MemoryRouter initialEntries={['/offers']}>
        <Routes>
          <Route path="/offers" element={<Offers />} />
          <Route path="/chat/:id" element={<ChatProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

function ChatProbe() {
  const { id } = useParams();
  return <div>Conversación abierta: {id}</div>;
}

describe('sección Ofertas del comprador', () => {
  beforeAll(() => {
    // jsdom no implementa scrollTo; el carrusel lo usa solo para los controles.
    Element.prototype.scrollTo = vi.fn();
  });

  beforeEach(() => {
    expireOfferLifecycles.mockReset();
    expireOfferLifecycles.mockResolvedValue({ ok: true, data: 0, error: null });
    fetchActiveOfferLifecycles.mockReset();
    fetchActiveOfferLifecycles.mockResolvedValue({ items: [], error: null, notice: null });
    fetchBuyerOffers.mockReset();
    fetchBuyerRequests.mockReset();
    selectOfferForLifecycle.mockReset();
    selectOfferForLifecycle.mockImplementation(async ({ offerId }) => ({
      ok: true,
      item: { chatId: `thread-${offerId}`, state: 'ESPERANDO_ACEPTACION' },
      error: null,
    }));
    selectOfferItemBrands.mockReset();
    selectOfferItemBrands.mockResolvedValue({ ok: true, data: null, error: null });
    selectOfferOption.mockReset();
    selectOfferOption.mockResolvedValue({ ok: true, data: null, error: null });
    syncLifecycleSelections.mockReset();
    syncLifecycleSelections.mockResolvedValue({ ok: true, error: null });
  });

  it('agrupa las ofertas por producto y conserva el comercio de cada oferta', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        offer('offer-a', 'req-1', 'Comercio A', 900),
        offer('offer-b', 'req-1', 'Comercio B', 950),
        offer('offer-c', 'req-2', 'Comercio C', 400),
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno'), request('req-2', 'Filtro de aceite')],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByRole('heading', { name: 'Ofertas' })).toBeInTheDocument();
    expect(await screen.findByText('3 ofertas recibidas')).toBeInTheDocument();

    const brakes = screen.getByRole('heading', { name: 'Pastillas de freno' }).closest('section');
    const filter = screen.getByRole('heading', { name: 'Filtro de aceite' }).closest('section');

    expect(within(brakes).getByText('Comercio A')).toBeInTheDocument();
    expect(within(brakes).getByText('Comercio B')).toBeInTheDocument();
    expect(within(brakes).queryByText('Comercio C')).not.toBeInTheDocument();

    expect(within(filter).getByText('Comercio C')).toBeInTheDocument();
    expect(within(filter).queryByText('Comercio A')).not.toBeInTheDocument();
  });

  it('muestra el precio cotizado y los productos no disponibles en cada oferta', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          ...offer('offer-a', 'req-1', 'Comercio A', 300),
          items: [
            {
              name: 'Pastillas',
              quantity: 2,
              available: true,
              unitPrice: 100,
              totalPrice: 200,
            },
            { name: 'Discos', quantity: 1, available: false },
          ],
        },
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByText(/Pastillas × 2 · \$200/)).toBeInTheDocument();
    expect(screen.getByText(/Discos × 1 \(no disponible\)/)).toBeInTheDocument();
  });

  it('inicia el ciclo de la oferta elegida y navega a su conversación', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [offer('offer-a', 'req-1', 'Comercio A', 900)],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();
    const buttons = await screen.findAllByRole('button', { name: 'Elegir esta oferta' });
    await userEvent.click(buttons[0]);

    expect(expireOfferLifecycles).toHaveBeenCalled();
    expect(selectOfferForLifecycle).toHaveBeenCalledWith({
      offerId: 'offer-a',
      category: null,
    });
    expect(syncLifecycleSelections).toHaveBeenCalledWith({
      chatId: 'thread-offer-a',
      selectedOption: null,
      selectedItemOptions: [],
    });
    expect(await screen.findByText('Conversación abierta: thread-offer-a')).toBeInTheDocument();
  });

  it('lista las marcas, guarda la elegida y la fija como acuerdo del chat', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [multiBrandOffer()],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByText('Opciones de marca')).toBeInTheDocument();
    expect(screen.getByText('Recomendada')).toBeInTheDocument();
    expect(screen.getByText('Mejor rendimiento')).toBeInTheDocument();
    expect(screen.getByText('Opción económica')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Lubrax/ }));

    expect(selectOfferOption).toHaveBeenCalledWith({
      offerId: 'offer-multi',
      optionId: 'lubrax',
    });
    expect(screen.getAllByText('$450.00').length).toBeGreaterThan(0);

    const chatButton = await screen.findByRole('button', { name: 'Elegir esta oferta' });
    await userEvent.click(chatButton);

    expect(selectOfferForLifecycle).toHaveBeenCalledWith({
      offerId: 'offer-multi',
      category: null,
    });
    expect(syncLifecycleSelections).toHaveBeenCalledWith({
      chatId: 'thread-offer-multi',
      selectedOption: {
        id: 'lubrax',
        brand: 'Lubrax',
        price: 450,
        available: true,
        is_recommended: false,
        note: 'Opción económica',
      },
      selectedItemOptions: [],
    });
    expect(
      await screen.findByText('Conversación abierta: thread-offer-multi')
    ).toBeInTheDocument();
  });

  it('permite elegir una marca por producto y abre el chat con el acuerdo desglosado', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [perItemOffer()],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Bafles y GPS')],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByText('Marcas para Bafles')).toBeInTheDocument();
    expect(screen.getByText('Marcas para GPS')).toBeInTheDocument();
    expect(screen.queryByText('Opciones de marca')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Pioneer/ }));
    await userEvent.click(screen.getByRole('radio', { name: /Garmin/ }));

    expect(selectOfferItemBrands).toHaveBeenCalledWith({
      offerId: 'offer-items',
      selections: { 'item-1': 'pioneer', 'item-2': 'garmin' },
    });
    expect(screen.getAllByText('$590.00').length).toBeGreaterThan(0);

    const chatButton = await screen.findByRole('button', { name: 'Elegir esta oferta' });
    await userEvent.click(chatButton);

    expect(syncLifecycleSelections).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'thread-offer-items',
        selectedItemOptions: [
          expect.objectContaining({ item_key: 'item-1', brand: 'Pioneer', price: 240 }),
          expect.objectContaining({ item_key: 'item-2', brand: 'Garmin', price: 110 }),
        ],
      })
    );
    expect(
      await screen.findByText('Conversación abierta: thread-offer-items')
    ).toBeInTheDocument();
  });

  it('revierte la elección si el backend no puede guardarla', async () => {
    selectOfferOption.mockResolvedValue({
      ok: false,
      error: 'No tienes permiso para elegir esta opción.',
    });
    fetchBuyerOffers.mockResolvedValue({
      items: [multiBrandOffer()],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();

    const lubrax = await screen.findByRole('radio', { name: /Lubrax/ });
    await userEvent.click(lubrax);

    expect(
      await screen.findByText('No tienes permiso para elegir esta opción.')
    ).toBeInTheDocument();
    expect(lubrax).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Elegir esta oferta' })).toBeInTheDocument();
  });

  it('muestra un aviso si no se puede iniciar la atención de la oferta', async () => {
    selectOfferForLifecycle.mockResolvedValue({
      ok: false,
      item: null,
      error: 'El backend rechazó la operación por permisos.',
      notice: null,
    });
    fetchBuyerOffers.mockResolvedValue({
      items: [offer('offer-a', 'req-1', 'Comercio A', 900)],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();
    const buttons = await screen.findAllByRole('button', { name: 'Elegir esta oferta' });
    await userEvent.click(buttons[0]);

    expect(
      await screen.findByText('El backend rechazó la operación por permisos.')
    ).toBeInTheDocument();
  });

  it('muestra el estado vacío real cuando no hay ofertas', async () => {
    fetchBuyerOffers.mockResolvedValue({ items: [], error: null, notice: null });
    fetchBuyerRequests.mockResolvedValue({ items: [], error: null, notice: null });

    renderOffers();

    expect(await screen.findByText('Sin ofertas recibidas')).toBeInTheDocument();
  });

  it('muestra el nombre del producto una sola vez aunque la solicitud lo repita', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          ...offer('offer-a', 'req-1', 'Comercio A', 500),
          items: [],
        },
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [
        {
          ...request('req-1', 'ACEITE'),
          description: 'ACEITE',
          items: [{ item: 'ACEITE' }],
        },
      ],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByRole('heading', { name: 'ACEITE' })).toBeInTheDocument();
    // Título, descripción y chip repetían el mismo texto: ahora solo el título.
    expect(screen.getAllByText('ACEITE')).toHaveLength(1);
    expect(screen.queryByText('ACEITE × 1')).not.toBeInTheDocument();
  });

  it('muestra la distancia real en km y la confiabilidad de cada comercio', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          ...offer('offer-a', 'req-1', 'Comercio Cercano', 500),
          commerce_latitude: 19.4576,
          commerce_longitude: -99.1332,
          commerce_rating: 4.5,
          commerce_rating_count: 12,
        },
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers({
      id: 'buyer-1',
      role: 'user',
      location: { latitude: 19.4326, longitude: -99.1332 },
    });

    expect(await screen.findByText('2.8 km')).toBeInTheDocument();
    expect(screen.getByText('4.5 (12)')).toBeInTheDocument();
  });

  it('ordena las ofertas del producto por precio y por confiabilidad', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          ...offer('offer-a', 'req-1', 'Comercio A', 900),
          commerce_rating: 4.9,
          commerce_rating_count: 5,
        },
        {
          ...offer('offer-b', 'req-1', 'Comercio B', 300),
          commerce_rating: 3.1,
          commerce_rating_count: 20,
        },
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();
    const section = (await screen.findByRole('heading', { name: 'Pastillas de freno' })).closest(
      'section'
    );
    const storeOrder = () =>
      within(section)
        .getAllByText(/^Comercio [AB]$/)
        .map((node) => node.textContent);

    expect(storeOrder()).toEqual(['Comercio A', 'Comercio B']);

    await userEvent.click(screen.getByRole('button', { name: 'Menor precio' }));
    expect(storeOrder()).toEqual(['Comercio B', 'Comercio A']);

    await userEvent.click(screen.getByRole('button', { name: 'Mayor precio' }));
    expect(storeOrder()).toEqual(['Comercio A', 'Comercio B']);

    await userEvent.click(screen.getByRole('button', { name: 'Confiabilidad' }));
    expect(storeOrder()).toEqual(['Comercio A', 'Comercio B']);
  });

  it('ordena los productos por su mejor oferta aunque haya una oferta por producto', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        offer('offer-a', 'req-1', 'Comercio A', 900),
        offer('offer-b', 'req-2', 'Comercio B', 300),
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'ACEITE'), request('req-2', 'pastillas')],
      error: null,
      notice: null,
    });

    renderOffers();
    await screen.findByRole('heading', { name: 'ACEITE' });

    const productOrder = () =>
      screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);

    expect(productOrder()).toEqual(['ACEITE', 'pastillas']);

    await userEvent.click(screen.getByRole('button', { name: 'Menor precio' }));
    expect(productOrder()).toEqual(['pastillas', 'ACEITE']);

    await userEvent.click(screen.getByRole('button', { name: 'Mayor precio' }));
    expect(productOrder()).toEqual(['ACEITE', 'pastillas']);
  });

  it('ordena por kilómetros de forma predeterminada, del más cercano al más lejano', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          ...offer('offer-lejos', 'req-1', 'Comercio Lejos', 900),
          commerce_latitude: 19.5326,
          commerce_longitude: -99.1332,
        },
        {
          ...offer('offer-cerca', 'req-2', 'Comercio Cerca', 300),
          commerce_latitude: 19.4576,
          commerce_longitude: -99.1332,
        },
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'ACEITE'), request('req-2', 'pastillas')],
      error: null,
      notice: null,
    });

    renderOffers({
      id: 'buyer-1',
      role: 'user',
      location: { latitude: 19.4326, longitude: -99.1332 },
    });
    await screen.findByRole('heading', { name: 'ACEITE' });

    // Aunque ACEITE se cargó primero, el más cercano (2.8 km) va primero.
    expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual([
      'pastillas',
      'ACEITE',
    ]);
    expect(screen.getByText('2.8 km')).toBeInTheDocument();
    expect(screen.getByText('11 km')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menor distancia' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('muestra foto y bono del producto en la tarjeta, el detalle y las opciones de marca', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          ...offer('offer-photo', 'req-1', 'Comercio Foto', 500),
          bonus: '10% de descuento',
          items: [
            {
              name: 'Pastillas',
              quantity: 1,
              available: true,
              unitPrice: 500,
              totalPrice: 500,
              photo: 'https://cdn.example.com/pastillas.jpg',
              bonus: 'Instalación gratis',
              brand_options: [
                {
                  id: 'bosch',
                  brand: 'Bosch',
                  price: 450,
                  available: true,
                  photo: 'https://cdn.example.com/bosch.jpg',
                },
              ],
            },
          ],
        },
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByAltText('Producto de Comercio Foto')).toBeInTheDocument();
    expect(screen.getByText('Bono: 10% de descuento')).toBeInTheDocument();
    expect(screen.getByAltText('Foto de Pastillas')).toBeInTheDocument();
    expect(screen.getByText(/Instalación gratis/)).toBeInTheDocument();
    expect(screen.getByAltText('Foto de Bosch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir esta oferta' })).toBeInTheDocument();
  });

  it('muestra el badge de recomendación y el carrusel con foto, precio, regalo y garantía', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [recommendationOffer()],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [
        {
          ...request('req-rec', 'Casco integral'),
          is_recommendation: true,
          description: 'Busco recomendaciones para casco',
        },
      ],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByText('✨ Recomiéndame')).toBeInTheDocument();
    expect(screen.getByText('Opciones recomendadas')).toBeInTheDocument();
    expect(screen.getByAltText('Foto de Casco integral talla M')).toBeInTheDocument();
    expect(screen.getByAltText('Foto de Casco integral talla L')).toBeInTheDocument();
    expect(screen.getByText('Guantes gratis')).toBeInTheDocument();
    expect(screen.getByText('1 año')).toBeInTheDocument();
    expect(screen.getByText('6 meses')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /elegir esta opción/i })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Opción anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente opción' })).toBeEnabled();
    // El selector antiguo no se muestra en ofertas recomendadas.
    expect(screen.queryByText('Opciones de marca')).not.toBeInTheDocument();
  });

  it('guarda la opción elegida del carrusel y la fija como acuerdo del chat', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [recommendationOffer()],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [{ ...request('req-rec', 'Casco integral'), is_recommendation: true }],
      error: null,
      notice: null,
    });

    renderOffers();

    const options = await screen.findAllByRole('button', { name: /elegir esta opción/i });
    await userEvent.click(options[1]);

    expect(selectOfferOption).toHaveBeenCalledWith({
      offerId: 'offer-rec',
      optionId: 'casco-l',
    });
    expect(
      screen.getAllByRole('button', { name: /opción elegida/i })
    ).toHaveLength(1);

    const chatButton = await screen.findByRole('button', { name: 'Elegir esta oferta' });
    await userEvent.click(chatButton);

    expect(selectOfferForLifecycle).toHaveBeenCalledWith({
      offerId: 'offer-rec',
      category: null,
    });
    expect(syncLifecycleSelections).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'thread-offer-rec',
        selectedOption: expect.objectContaining({
          id: 'casco-l',
          brand: 'Casco integral talla L',
          price: 520,
        }),
      })
    );
    expect(
      await screen.findByText('Conversación abierta: thread-offer-rec')
    ).toBeInTheDocument();
  });

  it('mueve el carrusel con los controles y los indicadores', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [recommendationOffer()],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [{ ...request('req-rec', 'Casco integral'), is_recommendation: true }],
      error: null,
      notice: null,
    });

    renderOffers();

    await screen.findByText('Opciones recomendadas');
    expect(screen.getByText('1/2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ir a la opción 2' }));

    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir a la opción 2' })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Siguiente opción' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Opción anterior' }));
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('muestra la miniatura de una opción de marca en ofertas antiguas', async () => {
    const withPhoto = multiBrandOffer();
    withPhoto.brand_options[0].photo = 'https://cdn.example.com/mobil.jpg';

    fetchBuyerOffers.mockResolvedValue({
      items: [withPhoto],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByAltText('Foto de Mobil')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Mobil/ })).toBeInTheDocument();
  });

  it('muestra el SLA del comercio y envía la categoría al elegir la oferta', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        offer('offer-sla', 'req-cat', 'Comercio SLA', 900),
        { ...offer('offer-custom', 'req-otro', 'Comercio Rápido', 800), commerce_max_response_minutes: 5 },
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [
        { ...request('req-cat', 'Pastillas'), category: 'Frenos' },
        request('req-otro', 'Bafles'),
      ],
      error: null,
      notice: null,
    });

    renderOffers();

    // El SLA por defecto es 15 min y solo se aceptan 5/10/15/20/30.
    expect(await screen.findByText('Responde en máx. 15 min')).toBeInTheDocument();
    expect(screen.getByText('Responde en máx. 5 min')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button', { name: 'Elegir esta oferta' });
    await userEvent.click(buttons[0]);

    expect(selectOfferForLifecycle).toHaveBeenCalledWith({
      offerId: 'offer-sla',
      category: 'Frenos',
    });
  });

  it('bloquea solo la solicitud en atención y deja navegar el hilo elegido', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        offer('offer-elegida', 'req-bloqueada', 'Comercio Elegido', 900),
        offer('offer-ajena', 'req-bloqueada', 'Comercio Ajeno', 950),
        offer('offer-libre', 'req-libre', 'Comercio Libre', 400),
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-bloqueada', 'Pastillas'), request('req-libre', 'Bafles')],
      error: null,
      notice: null,
    });
    fetchActiveOfferLifecycles.mockResolvedValue({
      items: [
        {
          id: 'thread-elegida',
          requestId: 'req-bloqueada',
          offerId: 'offer-elegida',
          state: 'EN_NEGOCIACION',
        },
      ],
      error: null,
      notice: null,
    });

    renderOffers();

    // El texto aparece en el aviso de la solicitud y en el botón de la oferta ajena.
    expect(await screen.findAllByText('Te están atendiendo')).toHaveLength(2);
    const verConversacion = screen.getAllByRole('button', { name: 'Ver conversación' })[0];
    expect(
      screen.getByRole('button', { name: 'Te están atendiendo' })
    ).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Te están atendiendo' })).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'Elegir esta oferta' })
    ).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Elegir esta oferta' })).toBeEnabled();

    await userEvent.click(verConversacion);
    expect(await screen.findByText('Conversación abierta: thread-elegida')).toBeInTheDocument();
    expect(selectOfferForLifecycle).not.toHaveBeenCalled();
  });

  it('muestra el contador en las ofertas recibidas y oculta las ya vencidas', async () => {
    const now = Date.now();
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          ...offer('offer-viva', 'req-1', 'Comercio Vigente', 900),
          expires_at: new Date(now + 5 * 60000).toISOString(),
        },
        {
          ...offer('offer-vencida', 'req-1', 'Comercio Vencido', 950),
          created_at: new Date(now - 31 * 60000).toISOString(),
        },
      ],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByText('Comercio Vigente')).toBeInTheDocument();
    expect(screen.queryByText('Comercio Vencido')).not.toBeInTheDocument();
    expect(screen.getAllByRole('timer').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
  });
});
