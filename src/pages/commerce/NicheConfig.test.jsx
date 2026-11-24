import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NicheConfig from './NicheConfig';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchCommerceIdForUser: vi.fn(),
    updateCommerceMaxResponseMinutes: vi.fn(),
  };
});

import { fetchCommerceIdForUser, updateCommerceMaxResponseMinutes } from '../../data/appData';

const renderConfig = () =>
  render(
    <AuthContext.Provider value={{ user: { id: 'user-1', role: 'commerce', business: {} } }}>
      <MemoryRouter initialEntries={['/niche-config']}>
        <NicheConfig />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('configuración del tiempo de respuesta del comercio', () => {
  beforeEach(() => {
    fetchCommerceIdForUser.mockReset();
    fetchCommerceIdForUser.mockResolvedValue({
      item: { id: 'commerce-1', max_response_minutes: 15 },
      error: null,
      notice: null,
    });
    updateCommerceMaxResponseMinutes.mockReset();
    updateCommerceMaxResponseMinutes.mockResolvedValue({ ok: true, data: null, error: null });
  });

  it('carga el SLA guardado y ofrece solo los valores permitidos', async () => {
    renderConfig();

    expect(await screen.findByText('Tiempo de respuesta')).toBeInTheDocument();
    const select = screen.getByLabelText('Tiempo máximo de respuesta');
    expect(select).toHaveValue('15');
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      '5',
      '10',
      '15',
      '20',
      '30',
    ]);
    expect(screen.getByText(/Responde en máx. 15 min/)).toBeInTheDocument();
  });

  it('guarda el nuevo tiempo de respuesta y confirma lo que verán los compradores', async () => {
    const user = userEvent.setup();
    renderConfig();

    const select = await screen.findByLabelText('Tiempo máximo de respuesta');
    await user.selectOptions(select, '30');
    await user.click(screen.getByRole('button', { name: 'Guardar tiempo de respuesta' }));

    expect(updateCommerceMaxResponseMinutes).toHaveBeenCalledWith(30);
    expect(
      await screen.findByText(/ahora respondes en máx. 30 min/i)
    ).toBeInTheDocument();
  });

  it('muestra el error del backend sin cambiar la selección guardada', async () => {
    const user = userEvent.setup();
    updateCommerceMaxResponseMinutes.mockResolvedValue({
      ok: false,
      error: 'No se pudo guardar el tiempo de respuesta.',
    });
    renderConfig();

    await user.selectOptions(
      await screen.findByLabelText('Tiempo máximo de respuesta'),
      '5'
    );
    await user.click(screen.getByRole('button', { name: 'Guardar tiempo de respuesta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo guardar el tiempo de respuesta.'
    );
  });
});
