import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompactOfferChat from './CompactOfferChat';

const { fetchOfferNegotiation, sendOfferNegotiationMessage, subscribeOfferNegotiation } =
  vi.hoisted(() => ({
    fetchOfferNegotiation: vi.fn(),
    sendOfferNegotiationMessage: vi.fn(),
    subscribeOfferNegotiation: vi.fn(),
  }));

vi.mock('../../data/offerResponses', () => ({
  fetchOfferNegotiation,
  sendOfferNegotiationMessage,
  subscribeOfferNegotiation,
}));

beforeEach(() => {
  vi.clearAllMocks();
  fetchOfferNegotiation.mockResolvedValue({
    items: [
      {
        id: 'm-1',
        senderType: 'buyer',
        senderName: 'juliana',
        body: '¿Pueden instalarlo mañana?',
        createdAt: '2026-11-19T12:00:00Z',
        isMine: false,
      },
    ],
    extra: {
      offerId: 'offer-1',
      requestTitle: 'Cambio de frenos',
      clientName: 'Juliana',
    },
    error: null,
  });
  sendOfferNegotiationMessage.mockResolvedValue({
    ok: true,
    data: [
      {
        id: 'm-2',
        senderType: 'commerce',
        senderName: 'Taller',
        body: 'Sí, mañana a primera hora.',
        createdAt: '2026-11-19T12:05:00Z',
        isMine: true,
      },
    ],
    error: null,
  });
  subscribeOfferNegotiation.mockReturnValue(() => {});
});

const renderSheet = (onClose = vi.fn()) =>
  render(<CompactOfferChat offerId="offer-1" onClose={onClose} />);

describe('bottom-sheet de chat de negociación', () => {
  it('muestra el encabezado compacto y los mensajes autorizados', async () => {
    renderSheet();

    expect(await screen.findByRole('dialog', { name: 'Chat con juliana' })).toBeInTheDocument();
    expect(await screen.findByText('¿Pueden instalarlo mañana?')).toBeInTheDocument();
    expect(screen.getByText('Cambio de frenos')).toBeInTheDocument();
    expect(subscribeOfferNegotiation).toHaveBeenCalledWith('offer-1', expect.any(Object));
  });

  it('envía mensajes usando la RPC de negociación sin navegar', async () => {
    const user = userEvent.setup();
    renderSheet();

    await screen.findByText('¿Pueden instalarlo mañana?');
    const input = screen.getByPlaceholderText('Escribe un mensaje...');
    await user.type(input, 'Sí, mañana a primera hora.');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() =>
      expect(sendOfferNegotiationMessage).toHaveBeenCalledWith('offer-1', 'Sí, mañana a primera hora.')
    );
    expect(await screen.findByText('Sí, mañana a primera hora.')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('se cierra con la X y con Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSheet(onClose);

    await screen.findByRole('dialog', { name: 'Chat con juliana' });
    await user.click(screen.getByRole('button', { name: 'Cerrar chat' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
