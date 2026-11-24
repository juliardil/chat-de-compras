import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatProvider } from './ChatContext';
import { useChat } from './chat-context';

const STORAGE_KEY = 'chat_compras_chats_v1';
const SHIPPING_DRAFT_KEY = 'chat_compras_shipping_draft_v1';

function ChatProbe({ chatId = '1' }) {
  const {
    openChat,
    messages,
    inputText,
    setInputText,
    sendMessage,
    timeLeft,
    closed,
    shippingData,
    setShippingData,
    handleShippingSubmit,
    handleProductArrivedYes,
    shippingSent,
    receiptConfirmed,
  } = useChat();

  useEffect(() => {
    openChat(chatId);
  }, [chatId, openChat]);

  return (
    <div>
      <span data-testid="time">{timeLeft}</span>
      <span data-testid="closed">{String(Boolean(closed))}</span>
      <span data-testid="shipping">{String(Boolean(shippingSent))}</span>
      <span data-testid="receipt">{String(Boolean(receiptConfirmed))}</span>
      <ul>
        {messages.map((message) => (
          <li key={message.id}>{message.text}</li>
        ))}
      </ul>
      <input
        aria-label="Mensaje"
        value={inputText}
        onChange={(event) => setInputText(event.target.value)}
      />
      <button type="button" onClick={() => sendMessage('buyer')}>
        Enviar
      </button>
      <button
        type="button"
        onClick={() =>
          setShippingData({
            name: 'Luis',
            phone: '55 1234 5678',
            street: 'Av. Reforma 10',
            interior: '',
            neighborhood: 'Centro',
            city: 'CDMX',
            references: 'Portón negro',
          })
        }
      >
        Cargar envío
      </button>
      <form onSubmit={handleShippingSubmit}>
        <button type="submit">Enviar datos</button>
      </form>
      <button type="button" onClick={() => handleProductArrivedYes()}>
        Confirmar recepción
      </button>
      <span data-testid="shipping-name">{shippingData.name}</span>
    </div>
  );
}

const renderChat = () => render(
  <ChatProvider>
    <ChatProbe />
  </ChatProvider>
);

describe('ChatContext', () => {
  beforeEach(() => {
    vi.useRealTimers();
    // Cada prueba parte de un borrador vacío: el borrador existe para conservar
    // los datos al cambiar de vendedor, no para contaminar otras pruebas.
    sessionStorage.removeItem(SHIPPING_DRAFT_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('crea la conversación vacía, sin mensajes de ejemplo', async () => {
    renderChat();

    expect(await screen.findByTestId('time')).toHaveTextContent('300');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryByText(/pastillas de freno para Corolla/i)).not.toBeInTheDocument();
  });

  it('envía un mensaje y limpia el campo', async () => {
    const user = userEvent.setup();
    renderChat();

    const input = screen.getByLabelText('Mensaje');
    await user.type(input, '¿Está disponible?');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('¿Está disponible?')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('persiste la conversación en localStorage', async () => {
    const user = userEvent.setup();
    renderChat();

    await user.type(screen.getByLabelText('Mensaje'), 'Mensaje persistente');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const messages = stored['1'].messages.map((message) => message.text);

    expect(messages).toContain('Mensaje persistente');
  });

  it('envía los datos de envío como mensaje y permite confirmar la recepción', async () => {
    const user = userEvent.setup();
    renderChat();

    await user.click(screen.getByRole('button', { name: 'Cargar envío' }));
    await user.click(screen.getByRole('button', { name: 'Enviar datos' }));

    expect(await screen.findByText(/Datos de envío del comprador/i)).toBeInTheDocument();
    expect(screen.getByText(/Destinatario: Luis/i)).toBeInTheDocument();
    expect(screen.getByText(/Av. Reforma 10, Centro, CDMX/i)).toBeInTheDocument();
    expect(screen.getByTestId('shipping')).toHaveTextContent('true');

    await user.click(screen.getByRole('button', { name: 'Confirmar recepción' }));

    expect(await screen.findByText(/Recepción confirmada/i)).toBeInTheDocument();
    expect(screen.getByTestId('receipt')).toHaveTextContent('true');
  });

  it('no envía los datos de envío si faltan campos obligatorios', async () => {
    const user = userEvent.setup();
    renderChat();

    await user.click(screen.getByRole('button', { name: 'Enviar datos' }));

    expect(screen.queryByText(/Datos de envío del comprador/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('shipping')).toHaveTextContent('false');
  });

  it('cierra el chat cuando el temporizador llega a cero', async () => {
    vi.useFakeTimers();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      '1': {
        messages: [
          { id: 'm1', text: 'Hola', sender: 'seller', time: '10:00' },
        ],
        timeLeft: 2,
        sellerStep: 'initial',
        warningSent: true,
        closed: false,
      },
    }));

    renderChat();

    expect(screen.getByTestId('time')).toHaveTextContent('2');

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('time')).toHaveTextContent('0');
    expect(screen.getByTestId('closed')).toHaveTextContent('true');
    expect(screen.getByText(/El tiempo del chat ha terminado/i)).toBeInTheDocument();
  });
});
