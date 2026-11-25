import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Tracking from './Tracking';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchBuyerRequests: vi.fn() };
});

import { fetchBuyerRequests } from '../../data/appData';

const renderTracking = () =>
  render(
    <AuthContext.Provider value={{ user: { id: 'buyer-1', role: 'user' } }}>
      <MemoryRouter>
        <Tracking />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('seguimiento de solicitudes del comprador', () => {
  beforeEach(() => {
    fetchBuyerRequests.mockReset();
  });

  it('muestra el contador y oculta las solicitudes ya vencidas', async () => {
    const now = Date.now();
    fetchBuyerRequests.mockResolvedValue({
      items: [
        {
          id: 'req-viva',
          title: 'Bujías vigentes',
          status: 'open',
          created_at: new Date(now).toISOString(),
          expires_at: new Date(now + 5 * 60000).toISOString(),
        },
        {
          id: 'req-vencida',
          title: 'Bujías vencidas',
          status: 'open',
          created_at: new Date(now - 31 * 60000).toISOString(),
        },
      ],
      error: null,
      notice: null,
    });

    renderTracking();

    expect(await screen.findByText('Bujías vigentes')).toBeInTheDocument();
    expect(screen.queryByText('Bujías vencidas')).not.toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(/Por acabar/);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
