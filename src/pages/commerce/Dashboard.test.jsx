import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchCommerceIdForUser: vi.fn(),
    fetchOpenRequests: vi.fn(),
    fetchCommerceSales: vi.fn(),
    createOffer: vi.fn(),
  };
});

import {
  createOffer,
  fetchCommerceIdForUser,
  fetchCommerceSales,
  fetchOpenRequests,
} from '../../data/appData';

const requestWithItems = {
  id: 'req-1',
  title: 'Bafles',
  description: 'Bafles traseros para el auto',
  budget_amount: 2000,
  currency: 'MXN',
  created_at: new Date().toISOString(),
  items: [
    {
      id: 1,
      category: 'Audio y Sonido',
      item: 'Bafles',
      vehicleType: 'Auto',
      vehicleBrand: 'Toyota',
      vehicleModel: 'Corolla',
      yearFrom: '2015',
      yearTo: '2020',
      reference: 'REF-1',
      brand: 'Sony',
      condition: 'Nuevo',
      quantity: '2',
      notes: 'Instalación delantera',
      images: ['data:image/jpeg;base64,AAA'],
    },
  ],
};

const requestWithTwoItems = {
  ...requestWithItems,
  id: 'req-2',
  title: 'Bafles y amplificador',
  items: [
    { id: 11, item: 'Bafles', quantity: '2' },
    { id: 12, item: 'Amplificador', quantity: '3' },
  ],
};

const renderDashboard = () =>
  render(
    <AuthContext.Provider value={{ user: { id: 'user-1', role: 'commerce' } }}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('panel de oportunidades del comercio', () => {
  beforeEach(() => {
    fetchCommerceIdForUser.mockReset();
    fetchOpenRequests.mockReset();
    fetchCommerceSales.mockReset();
    createOffer.mockReset();

    fetchCommerceIdForUser.mockResolvedValue({
      item: { id: 'commerce-1', status: 'approved', trade_name: 'Taller Real' },
      error: null,
      notice: null,
    });
    fetchOpenRequests.mockResolvedValue({
      items: [requestWithItems],
      error: null,
      notice: null,
    });
    fetchCommerceSales.mockResolvedValue({ items: [], error: null, notice: null });
    createOffer.mockResolvedValue({ ok: true, data: [{ id: 'offer-1' }], error: null });
  });

  it('muestra todos los campos técnicos y las imágenes en el detalle', async () => {
    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: /ver detalles/i }));

    const dialog = await screen.findByRole('dialog', { name: /detalle de la oportunidad/i });

    expect(within(dialog).getByText('Audio y Sonido')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Bafles').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('Auto')).toBeInTheDocument();
    expect(within(dialog).getByText('Toyota')).toBeInTheDocument();
    expect(within(dialog).getByText('Corolla')).toBeInTheDocument();
    expect(within(dialog).getByText('2015 – 2020')).toBeInTheDocument();
    expect(within(dialog).getByText('REF-1')).toBeInTheDocument();
    expect(within(dialog).getByText('Sony')).toBeInTheDocument();
    expect(within(dialog).getByText('Nuevo')).toBeInTheDocument();
    expect(within(dialog).getByText('Instalación delantera')).toBeInTheDocument();
    expect(within(dialog).getByText('× 2')).toBeInTheDocument();
    expect(within(dialog).getByText('2 unidades')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('img', { name: /referencia 1 de bafles/i })
    ).toBeInTheDocument();
  });

  it('multiplica el precio por unidad por la cantidad real solicitada', async () => {
    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: /ofertar ahora/i }));
    await userEvent.type(
      await screen.findByLabelText('Precio unitario de Bafles'),
      '250'
    );
    await userEvent.click(screen.getByRole('button', { name: /enviar oferta/i }));

    expect(await screen.findByText('Oferta enviada')).toBeInTheDocument();
    expect(createOffer).toHaveBeenCalledTimes(1);

    expect(createOffer.mock.calls[0][0]).toMatchObject({
      request_id: 'req-1',
      commerce_id: 'commerce-1',
      total_amount: 500,
      currency: 'MXN',
      status: 'active',
      items: [
        {
          name: 'Bafles',
          quantity: 2,
          available: true,
          unitPrice: 250,
          totalPrice: 500,
          brand_options: [],
        },
      ],
    });
    expect(createOffer.mock.calls[0][0].brand_options).toBeUndefined();
  });

  it('excluye los productos marcados como «No lo tengo» y cotiza solo los disponibles', async () => {
    fetchOpenRequests.mockResolvedValue({
      items: [requestWithTwoItems],
      error: null,
      notice: null,
    });

    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: /ofertar ahora/i }));
    await userEvent.type(await screen.findByLabelText('Precio unitario de Bafles'), '100');
    await userEvent.type(
      screen.getByLabelText('Notas para Bafles'),
      'Incluye instalación'
    );

    const ampGroup = screen.getByRole('group', { name: 'Disponibilidad de Amplificador' });
    await userEvent.click(within(ampGroup).getByRole('button', { name: 'No lo tengo' }));

    expect(
      screen.getByText('Este producto no se incluirá en la cotización.')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /enviar oferta/i }));

    expect(await screen.findByText('Oferta enviada')).toBeInTheDocument();
    expect(createOffer).toHaveBeenCalledTimes(1);

    expect(createOffer.mock.calls[0][0]).toMatchObject({
      request_id: 'req-2',
      total_amount: 200,
      items: [
        {
          name: 'Bafles',
          quantity: 2,
          available: true,
          unitPrice: 100,
          totalPrice: 200,
          notes: 'Incluye instalación',
        },
        {
          name: 'Amplificador',
          quantity: 3,
          available: false,
          unitPrice: 0,
          totalPrice: 0,
          notes: null,
        },
      ],
    });
  });

  it('no envía la oferta si todos los productos están marcados como «No lo tengo»', async () => {
    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: /ofertar ahora/i }));
    const group = screen.getByRole('group', { name: 'Disponibilidad de Bafles' });
    await userEvent.click(within(group).getByRole('button', { name: 'No lo tengo' }));
    await userEvent.click(screen.getByRole('button', { name: /enviar oferta/i }));

    expect(
      await screen.findByText(/marca al menos un producto como «lo tengo»/i)
    ).toBeInTheDocument();
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('guarda las alternativas dentro del producto, colapsadas por defecto', async () => {
    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: /ofertar ahora/i }));
    await userEvent.type(await screen.findByLabelText('Precio unitario de Bafles'), '250');

    expect(screen.queryByLabelText('Marca de Bafles, alternativa 1')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /cotizar varias marcas para bafles/i })
    );

    await userEvent.type(screen.getByLabelText('Marca de Bafles, alternativa 1'), 'Pioneer');
    await userEvent.type(screen.getByLabelText('Precio de Bafles, alternativa 1'), '480');
    await userEvent.type(
      screen.getByLabelText('Nota de Bafles, alternativa 1'),
      'Mejor rendimiento'
    );

    await userEvent.click(screen.getByRole('button', { name: /agregar otra marca/i }));
    await userEvent.type(screen.getByLabelText('Marca de Bafles, alternativa 2'), 'Sony');
    await userEvent.type(screen.getByLabelText('Precio de Bafles, alternativa 2'), '450');
    await userEvent.click(
      screen.getByRole('button', { name: /recomendar alternativa 2 de bafles/i })
    );

    expect(screen.queryByText('Opciones de marca')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /enviar oferta/i }));

    expect(await screen.findByText('Oferta enviada')).toBeInTheDocument();
    const payload = createOffer.mock.calls[0][0];
    expect(payload.brand_options).toBeUndefined();
    expect(payload.items[0]).toMatchObject({
      name: 'Bafles',
      unitPrice: 250,
      totalPrice: 500,
      brand_options: [
        {
          id: expect.any(String),
          brand: 'Pioneer',
          price: 480,
          available: true,
          is_recommended: false,
          note: 'Mejor rendimiento',
        },
        {
          id: expect.any(String),
          brand: 'Sony',
          price: 450,
          available: true,
          is_recommended: true,
          note: '',
        },
      ],
    });
  });

  it('vuelve al precio principal al cerrar el bloque de marcas del producto', async () => {
    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: /ofertar ahora/i }));
    await userEvent.type(await screen.findByLabelText('Precio unitario de Bafles'), '250');
    await userEvent.click(
      screen.getByRole('button', { name: /cotizar varias marcas para bafles/i })
    );
    await userEvent.type(screen.getByLabelText('Marca de Bafles, alternativa 1'), 'Bosch');
    await userEvent.type(screen.getByLabelText('Precio de Bafles, alternativa 1'), '300');
    await userEvent.click(
      screen.getByRole('button', { name: /cerrar opciones de marca de bafles/i })
    );

    expect(screen.queryByLabelText('Marca de Bafles, alternativa 1')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /enviar oferta/i }));

    expect(await screen.findByText('Oferta enviada')).toBeInTheDocument();
    expect(createOffer.mock.calls[0][0].items[0].brand_options).toEqual([]);
    expect(createOffer.mock.calls[0][0].items[0].unitPrice).toBe(250);
  });

  it('mantiene las alternativas aisladas entre productos de una misma solicitud', async () => {
    fetchOpenRequests.mockResolvedValue({
      items: [requestWithTwoItems],
      error: null,
      notice: null,
    });

    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: /ofertar ahora/i }));
    await userEvent.type(await screen.findByLabelText('Precio unitario de Bafles'), '100');
    await userEvent.type(await screen.findByLabelText('Precio unitario de Amplificador'), '200');

    await userEvent.click(
      screen.getByRole('button', { name: /cotizar varias marcas para bafles/i })
    );
    await userEvent.type(screen.getByLabelText('Marca de Bafles, alternativa 1'), 'Sony');
    await userEvent.type(screen.getByLabelText('Precio de Bafles, alternativa 1'), '120');

    expect(
      screen.queryByLabelText('Marca de Amplificador, alternativa 1')
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /enviar oferta/i }));

    expect(await screen.findByText('Oferta enviada')).toBeInTheDocument();
    const items = createOffer.mock.calls[0][0].items;
    expect(items[0].brand_options).toHaveLength(1);
    expect(items[1].brand_options).toEqual([]);
  });
});
