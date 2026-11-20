import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';
import {
  fetchOfferNegotiation,
  sendOfferNegotiationMessage,
  subscribeOfferNegotiation,
} from '../../data/offerResponses';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};

// Misma normalización que el chat completo de negociación: los eventos
// realtime y la respuesta de la RPC llegan en formatos distintos.
const normalizeMessage = (message, offerId) => ({
  id: message?.id || `local-${Date.now()}-${Math.random()}`,
  senderType: message?.senderType || message?.sender_type || 'commerce',
  senderName: message?.senderName || message?.sender_name || 'Proveedor',
  body: message?.body || '',
  createdAt: message?.createdAt || message?.created_at || new Date().toISOString(),
  isMine:
    typeof message?.isMine === 'boolean'
      ? message.isMine
      : (message?.senderType || message?.sender_type) === 'commerce',
  offerId: message?.offerId || message?.offer_id || offerId,
});

// Bottom-sheet compacto para "Mis propuestas": reutiliza las RPCs y el canal
// realtime del chat de negociación, pero sin sacar al usuario del Panel de
// Trabajos. La oferta pertenece al taller porque el backend lo valida.
export default function CompactOfferChat({ offerId, clientName, onClose }) {
  const [offer, setOffer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchOfferNegotiation(offerId)
      .then((result) => {
        if (cancelled) return;
        if (result.error || !result.extra) {
          setError(result.error || 'No se pudo cargar la conversación.');
          return;
        }
        setOffer(result.extra);
        setMessages((result.items || []).map((message) => normalizeMessage(message, offerId)));
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la conversación. Inténtalo de nuevo.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = subscribeOfferNegotiation(offerId, {
      onMessage: (payload) => {
        if (cancelled || !payload?.body) return;
        setMessages((current) => {
          const incoming = normalizeMessage(payload, offerId);
          if (current.some((message) => message.id === incoming.id)) return current;
          return [...current, incoming];
        });
      },
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [offerId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const handleSend = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setActionError(null);
    const optimisticId = `local-${Date.now()}`;
    setMessages((current) => [
      ...current,
      normalizeMessage(
        {
          id: optimisticId,
          body,
          senderType: 'commerce',
          senderName: 'Tú',
          createdAt: new Date().toISOString(),
        },
        offerId
      ),
    ]);
    setDraft('');

    const result = await sendOfferNegotiationMessage(offerId, body);
    setSending(false);
    if (!result.ok) {
      setActionError(result.error || 'No se pudo enviar el mensaje.');
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      setDraft(body);
      return;
    }
    const saved = result.data?.[0];
    if (saved) {
      setMessages((current) =>
        current.map((message) => (message.id === optimisticId ? normalizeMessage(saved, offerId) : message))
      );
    }
  };

  const name = (clientName || offer?.clientName || 'cliente').toLowerCase();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chat con ${name}`}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/40 bg-white/90 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-200"
      >
        <header className="shrink-0 border-b border-white/40 bg-white/80 px-4 pb-3 pt-2 backdrop-blur-md">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#4B227A]/20" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#006E7A]">
                Chat de negociación
              </p>
              <h2 className="mt-0.5 truncate text-sm font-bold text-gray-800">Chat con {name}</h2>
              {offer?.requestTitle ? (
                <p className="truncate text-[11px] text-gray-600">{offer.requestTitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar chat"
              className="shrink-0 rounded-full border border-white/40 bg-white/70 p-2 text-gray-700 transition-colors hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {actionError ? (
          <p role="alert" className="mx-4 mt-2 rounded-xl border border-red-300/60 bg-white/80 px-3 py-2 text-[11px] text-red-700">
            {actionError}
          </p>
        ) : null}

        <div className="min-h-[180px] flex-1 space-y-3 overflow-y-auto bg-[#E7E7E7]/70 p-4" aria-label="Mensajes de negociación">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-xs text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin text-[#006E7A]" /> Cargando conversación…
            </div>
          ) : null}

          {!loading && error ? (
            <p role="alert" className="rounded-xl border border-red-300/60 bg-white/80 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}

          {!loading && !error && messages.length === 0 ? (
            <div className="mx-auto max-w-[220px] rounded-2xl border border-white/40 bg-white/80 px-4 py-5 text-center shadow-sm">
              <MessageCircle className="mx-auto h-5 w-5 text-[#006E7A]" />
              <p className="mt-2 text-[11px] text-gray-600">
                Escribe el primer mensaje para acordar los detalles del servicio.
              </p>
            </div>
          ) : null}

          {messages.map((message) => {
            const system = message.senderType === 'system';
            return (
              <div
                key={message.id}
                className={`flex max-w-[88%] flex-col ${
                  system ? 'mx-auto items-center' : message.isMine ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                {system ? (
                  <span className="rounded-full border border-[#4B227A]/30 bg-[#4B227A]/10 px-3 py-1.5 text-[10px] font-bold text-[#4B227A]">
                    {message.body}
                  </span>
                ) : (
                  <>
                    <div
                      className={`whitespace-pre-line break-words rounded-2xl px-3 py-2 text-xs ${
                        message.isMine
                          ? 'rounded-br-none bg-gradient-to-r from-[#00EED0] to-[#0197AF] text-black shadow-[0_0_12px_rgba(0,238,208,0.3)]'
                          : 'rounded-bl-none border border-white/40 bg-white/85 text-gray-800 shadow-sm'
                      }`}
                    >
                      <p className={`mb-0.5 text-[10px] font-bold ${message.isMine ? 'text-black/70' : 'text-[#006E7A]'}`}>
                        {message.senderName || (message.isMine ? 'Tú' : 'Cliente')}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    </div>
                    <span className="mt-0.5 px-1 text-[10px] text-gray-600">{formatTime(message.createdAt)}</span>
                  </>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSend}
          className="flex shrink-0 gap-2 border-t border-white/40 bg-white/80 px-4 py-3 backdrop-blur-md"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={1000}
            placeholder="Escribe un mensaje..."
            aria-label="Mensaje de negociación"
            className="min-w-0 flex-1 rounded-xl border border-[#4B227A]/25 bg-white/85 px-3 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Enviar mensaje"
            className="rounded-xl bg-[#00EED0] p-2.5 text-black shadow-[0_0_12px_rgba(0,238,208,0.3)] transition-colors hover:bg-[#00EED0]/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
