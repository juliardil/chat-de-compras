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
  uploadClubImage: vi.fn(),
  validateClubImage: vi.fn(() => null),
}));

import {
  fetchClubEvents,
  fetchClubIdentity,
  fetchClubMessages,
  sendClubMessage,
  uploadClubImage,
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

  it('muestra flyers, fecha y hora, confirmados y acciones de asistencia', async () => {
    const user = userEvent.setup();
    fetchClubIdentity.mockResolvedValue({
      items: [{ name: 'mostdil', is_owner: false, group_id: 'group-1' }],
      error: null,
      notice: null,
    });
    fetchClubEvents.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          title: 'Rodada al parque',
          description: 'Salida familiar',
          location: 'Plaza principal',
          starts_at: '2026-11-21T10:30:00',
          going_count: 2,
          my_status: 'none',
          image_url: 'https://cdn.test/flyer.png',
          confirmed_members: [
            { user_id: 'u-1', display_name: 'Ana', avatar_url: null },
            { user_id: 'u-2', display_name: 'Luis', avatar_url: null },
          ],
        },
      ],
      error: null,
      notice: null,
    });
    fetchClubMessages.mockResolvedValue({
      items: [
        {
          id: 'message-1',
          body: 'Imagen compartida',
          author_name: 'Ana',
          is_mine: false,
          created_at: '2026-11-20T09:15:00.000Z',
          image_url: 'https://cdn.test/chat.png',
        },
      ],
      error: null,
      notice: null,
    });

    renderPage();

    expect(await screen.findByAltText('Imagen compartida en el club')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /actividades y rodadas/i }));

    expect(await screen.findByAltText('Flyer de Rodada al parque')).toBeInTheDocument();
    expect(screen.getByText('21 nov 2026')).toBeInTheDocument();
    expect(screen.getByText(/10:30/)).toBeInTheDocument();
    expect(screen.getByText(/Plaza principal/)).toBeInTheDocument();
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /asistiré/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /no podré ir/i })).toBeInTheDocument();
  });

  it('sube una imagen del chat y la envía con texto opcional', async () => {
    const user = userEvent.setup();
    fetchClubIdentity.mockResolvedValue({
      items: [{ name: 'mostdil', is_owner: false, group_id: 'group-1' }],
      error: null,
      notice: null,
    });
    uploadClubImage.mockResolvedValue({ url: 'https://cdn.test/chat.png', error: null });
    sendClubMessage.mockResolvedValue({ ok: true, error: null });

    renderPage();

    const file = new File(['img'], 'foto.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Adjuntar imagen del club'), file);
    await user.click(await screen.findByRole('button', { name: /enviar mensaje/i }));

    expect(uploadClubImage).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'group-1', kind: 'chat', file })
    );
    expect(sendClubMessage).toHaveBeenCalledWith('', 'https://cdn.test/chat.png');
  });

  it('muestra un selector de flyer limpio con opción de cambiar y quitar', async () => {
    const user = userEvent.setup();
    fetchClubIdentity.mockResolvedValue({
      items: [{ name: 'mostdil', is_owner: true, group_id: 'group-1' }],
      error: null,
      notice: null,
    });

    renderPage();

    await user.click(await screen.findByRole('button', { name: /actividades y rodadas/i }));
    await user.click(await screen.findByRole('button', { name: /crear actividad/i }));

    const input = screen.getByLabelText('Flyer de la actividad');
    expect(input).toHaveClass('sr-only');
    expect(screen.getByText('Elegir flyer')).toBeInTheDocument();
    expect(screen.getByText('JPG, PNG o WEBP · máximo 5 MB')).toBeInTheDocument();

    const file = new File(['img'], 'rodada.png', { type: 'image/png' });
    await user.upload(input, file);

    expect(screen.getByText('Cambiar flyer')).toBeInTheDocument();
    expect(screen.getByText('rodada.png')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quitar/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /quitar/i }));

    expect(screen.getByText('Elegir flyer')).toBeInTheDocument();
    expect(screen.queryByText('rodada.png')).not.toBeInTheDocument();
    expect(input).toHaveValue('');
  });
});
