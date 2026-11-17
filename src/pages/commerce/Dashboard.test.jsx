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
        },
      ],
      brand_options: [
        {
          id: expect.any(String),
          brand: 'Opción estándar',
          price: 500,
          available: true,
          is_recommended: true,
          note: '',
        },
      ],
    });
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

  it('envía varias opciones de marca con precio, nota y recomendación', async () => {
    renderDashboard();

    await userEvent.click(await screen.findByRole('button', { name: /ofertar ahora/i }));
    await userEvent.type(await screen.findByLabelText('Precio unitario de Bafles'), '250');

    await userEvent.type(screen.getByLabelText('Marca de la opción 1'), 'Mobil');
    await userEvent.type(screen.getByLabelText('Precio de la opción 1'), '480');
    await userEvent.type(
      screen.getByLabelText('Nota de la opción 1'),
      'Mejor rendimiento'
    );

    await userEvent.click(screen.getByRole('button', { name: /agregar marca/i }));
    await userEvent.type(screen.getByLabelText('Marca de la opción 2'), 'Lubrax');
    await userEvent.type(screen.getByLabelText('Precio de la opción 2'), '450');
    await userEvent.click(screen.getAllByRole('button', { name: 'Recomendada' })[1]);

    await userEvent.click(screen.getByRole('button', { name: /enviar oferta/i }));

    expect(await screen.findByText('Oferta enviada')).toBeInTheDocument();
    expect(createOffer).toHaveBeenCalledTimes(1);
    expect(createOffer.mock.calls[0][0].brand_options).toEqual([
      {
        id: expect.any(String),
        brand: 'Mobil',
        price: 480,
        available: true,
        is_recommended: false,
        note: 'Mejor rendimiento',
      },
      {
        id: expect.any(String),
        brand: 'Lubrax',
        price: 450,
        available: true,
        is_recommended: true,
        note: '',
      },
    ]);
  });
});
