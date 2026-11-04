import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatProvider } from './ChatContext';
import { useChat } from './chat-context';

const STORAGE_KEY = 'chat_compras_chats_v1';

function ChatProbe({ chatId = '1' }) {
  const {
    openChat,
    messages,
    inputText,
    setInputText,
    sendMessage,
    timeLeft,
    closed,
  } = useChat();

  useEffect(() => {
    openChat(chatId);
  }, [chatId, openChat]);

  return (
    <div>
      <span data-testid="time">{timeLeft}</span>
      <span data-testid="closed">{String(Boolean(closed))}</span>
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('crea la conversación con los mensajes iniciales', async () => {
    renderChat();

    expect(await screen.findByText(/pastillas de freno para Corolla/i)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
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
