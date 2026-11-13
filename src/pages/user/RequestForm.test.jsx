import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RequestForm from './RequestForm';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchBuyerProfileId: vi.fn(),
    createPurchaseRequest: vi.fn(),
  };
});

import { createPurchaseRequest, fetchBuyerProfileId } from '../../data/appData';

const renderForm = () =>
  render(
    <AuthContext.Provider value={{ user: { id: 'user-1', role: 'user' } }}>
      <MemoryRouter initialEntries={['/request']}>
        <Routes>
          <Route path="/request" element={<RequestForm />} />
          <Route path="/request-success" element={<div>Confirmación de publicación</div>} />
          <Route path="/responses" element={<div>Pantalla de respuestas</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

const fillMinimumFields = async () => {
  const selects = screen.getAllByRole('combobox');
  await userEvent.selectOptions(selects[0], 'Frenos');
  await userEvent.type(
    screen.getByPlaceholderText('Ej: Pastillas de freno, filtro de aceite, batería'),
    'Pastillas de freno'
  );
  await userEvent.selectOptions(selects[1], 'Auto');
};

describe('publicación de una solicitud', () => {
  beforeEach(() => {
    fetchBuyerProfileId.mockReset();
    createPurchaseRequest.mockReset();
    fetchBuyerProfileId.mockResolvedValue({
      item: { id: 'buyer-1' },
      error: null,
      notice: null,
    });
  });

  it('muestra la confirmación solo cuando la solicitud se guardó correctamente', async () => {
    createPurchaseRequest.mockResolvedValue({
      ok: true,
      data: [{ id: 'req-1' }],
      error: null,
    });

    renderForm();
    await fillMinimumFields();
    await userEvent.click(screen.getByRole('button', { name: /enviar solicitud automotriz/i }));

    expect(await screen.findByText('Confirmación de publicación')).toBeInTheDocument();
    expect(createPurchaseRequest).toHaveBeenCalledTimes(1);
    expect(createPurchaseRequest.mock.calls[0][0]).toMatchObject({
      buyer_id: 'buyer-1',
      title: 'Pastillas de freno',
      status: 'open',
    });
  });

  it('no muestra la confirmación si la publicación falla', async () => {
    createPurchaseRequest.mockResolvedValue({
      ok: false,
      data: null,
      error: 'No se pudo publicar la solicitud.',
    });

    renderForm();
    await fillMinimumFields();
    await userEvent.click(screen.getByRole('button', { name: /enviar solicitud automotriz/i }));

    expect(await screen.findByText('Pantalla de respuestas')).toBeInTheDocument();
    expect(screen.queryByText('Confirmación de publicación')).not.toBeInTheDocument();
  });

  it('conserva la cantidad solicitada en el payload de la solicitud', async () => {
    createPurchaseRequest.mockResolvedValue({
      ok: true,
      data: [{ id: 'req-1' }],
      error: null,
    });

    renderForm();
    await fillMinimumFields();

    const quantity = screen.getByPlaceholderText('Ej: 1');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '4');

    await userEvent.click(screen.getByRole('button', { name: /enviar solicitud automotriz/i }));

    expect(await screen.findByText('Confirmación de publicación')).toBeInTheDocument();
    expect(createPurchaseRequest).toHaveBeenCalledTimes(1);

    const payload = createPurchaseRequest.mock.calls[0][0];
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      item: 'Pastillas de freno',
      quantity: 4,
      images: [],
    });
  });

  it('no muestra la confirmación si el comprador no tiene perfil en el backend', async () => {
    fetchBuyerProfileId.mockResolvedValue({
      item: null,
      error: null,
      notice: 'Tu cuenta todavía no tiene un perfil de comprador en el backend.',
    });

    renderForm();
    await fillMinimumFields();
    await userEvent.click(screen.getByRole('button', { name: /enviar solicitud automotriz/i }));

    expect(await screen.findByText('Pantalla de respuestas')).toBeInTheDocument();
    expect(createPurchaseRequest).not.toHaveBeenCalled();
  });
});
