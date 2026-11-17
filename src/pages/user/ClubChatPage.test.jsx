import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClubChatPage from './ClubChatPage';

vi.mock('../../data/clubAdvanced', () => ({
  fetchClubIdentity: vi.fn(),
  fetchClubMessages: vi.fn(),
  sendClubMessage: vi.fn(),
  fetchClubEvents: vi.fn(),
  createClubEvent: vi.fn(),
  rsvpClubEvent: vi.fn(),
}));

import {
  fetchClubEvents,
  fetchClubIdentity,
  fetchClubMessages,
} from '../../data/clubAdvanced';

const renderPage = () =>
  render(
    <MemoryRouter>
      <ClubChatPage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  fetchClubIdentity.mockResolvedValue({
    items: [{ name: 'mostdil', is_owner: false }],
    error: null,
    notice: null,
  });
  fetchClubMessages.mockResolvedValue({
    items: [
      {
        id: 'message-1',
        body: 'Nos vemos en la rodada del sábado',
        author_name: 'Fernando',
        is_mine: false,
        created_at: new Date().toISOString(),
      },
    ],
    error: null,
    notice: null,
  });
  fetchClubEvents.mockResolvedValue({ items: [], error: null, notice: null });
});

describe('pantalla dedicada del chat del club', () => {
  it('muestra la cabecera con retroceso y el nombre del club', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'mostdil Chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver al perfil/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actividades y rodadas/i })).toBeInTheDocument();
  });

  it('muestra mensajes y la barra inferior de envío', async () => {
    renderPage();

    expect(await screen.findByText('Nos vemos en la rodada del sábado')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /mensaje del club/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar mensaje/i })).toBeInTheDocument();
  });

  it('abre y cierra las actividades encima del chat', async () => {
    const user = userEvent.setup();
    renderPage();

    const toggle = await screen.findByRole('button', { name: /actividades y rodadas/i });
    expect(screen.queryByRole('region', { name: /actividades y rodadas/i })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByRole('region', { name: /actividades y rodadas/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cerrar actividades/i }));
    expect(screen.queryByRole('region', { name: /actividades y rodadas/i })).not.toBeInTheDocument();
  });
});
