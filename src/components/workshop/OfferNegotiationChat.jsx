import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {
  confirmOfferService,
  fetchOfferNegotiation,
  saveOfferNegotiationNotes,
  sendOfferNegotiationMessage,
  subscribeOfferNegotiation,
} from '../../data/offerResponses';
import { formatCurrency } from '../../data/appData';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};

// Normaliza un mensaje recibido por realtime o por RPC a la misma forma.
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

// Vista de chat en tiempo real para UNA oferta. La propiedad de la oferta se
// valida en el backend: aquí solo se muestra lo que la RPC autoriza.
// Paleta replicada del chat existente: fondo gris claro, glassmorphism blanco,
// burbujas turquesa degradado y acentos morado/azul de la identidad Go.Go.
export default function OfferNegotiationChat() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [connected, setConnected] = useState(false);
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
          setError(result.error || 'No se pudo cargar la negociación.');
          return;
        }
        setOffer(result.extra);
        setNotes(result.extra.notes || '');
        setMessages((result.items || []).map((message) => normalizeMessage(message, offerId)));
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la negociación. Inténtalo de nuevo.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = subscribeOfferNegotiation(offerId, {
      onConnected: () => !cancelled && setConnected(true),
      onError: () => !cancelled && setConnected(false),
      onMessage: (payload) => {
        if (cancelled || !payload?.body) return;
        setMessages((current) => {
          const incoming = normalizeMessage(payload, offerId);
          if (current.some((message) => message.id === incoming.id)) return current;
          return [...current, incoming];
        });
      },
      onConfirmation: (payload) => {
        if (cancelled || !payload?.confirmationStatus) return;
        setOffer((current) =>
          current
            ? {
                ...current,
                confirmationStatus: payload.confirmationStatus,
                confirmedAt: payload.confirmedAt,
              }
            : current
        );
      },
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [offerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const confirmed = offer?.confirmationStatus === 'confirmed';

  const statusLabel = useMemo(() => {
    if (confirmed) return 'Reserva confirmada';
    if (offer?.offerStatus) return `Oferta ${offer.offerStatus}`;
    return 'Negociación abierta';
  }, [confirmed, offer?.offerStatus]);

  const handleSend = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setActionError(null);
    // Mensaje optimista; se reemplaza por el evento realtime / respuesta RPC.
    const optimisticId = `local-${Date.now()}`;
    setMessages((current) => [
      ...current,
      normalizeMessage(
        { id: optimisticId, body, senderType: 'commerce', senderName: 'Tú', createdAt: new Date().toISOString() },
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

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    setActionError(null);
    const result = await saveOfferNegotiationNotes(offerId, notes);
    setSavingNotes(false);
    if (!result.ok) {
      setActionError(result.error || 'No se pudieron guardar los detalles.');
      return;
    }
    setOffer((current) => (current ? { ...current, notes } : current));
  };

  const handleConfirm = async () => {
    if (confirmed || confirming) return;
    setConfirming(true);
    setActionError(null);
    const result = await confirmOfferService(offerId);
    setConfirming(false);
    if (!result.ok) {
      setActionError(result.error || 'No se pudo confirmar el servicio.');
      return;
    }
    const updated = result.data?.[0];
    if (updated?.confirmationStatus) {
      setOffer((current) =>
        current
          ? {
              ...current,
              confirmationStatus: updated.confirmationStatus,
              confirmedAt: updated.confirmedAt,
            }
          : current
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E7E7E7] px-6 py-16 text-gray-800">
        <div className="mx-auto flex max-w-md items-center justify-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin text-[#006E7A]" /> Cargando negociación…
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-[#E7E7E7] px-6 py-16 text-gray-800">
        <div className="mx-auto max-w-md rounded-2xl border border-white/30 bg-white/80 p-5 text-center shadow-sm backdrop-blur-md">
          <p role="alert" className="text-sm text-red-700">
            {error || 'No se pudo abrir la negociación.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/workshop-jobs/responses')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#00EED0] px-4 py-2.5 text-xs font-bold text-black shadow-[0_0_15px_rgba(0,238,208,0.3)] hover:bg-[#00EED0]/90"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a respuestas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#E7E7E7] text-gray-800">
      <header className="border-b border-white/30 bg-white/70 px-4 pb-4 pt-10 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/workshop-jobs/responses')}
            className="-ml-2 inline-flex items-center gap-2 rounded-full p-2 text-xs font-bold text-gray-800 transition-colors hover:bg-white/80"
          >
            <ArrowLeft className="h-5 w-5" /> Respuestas
          </button>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              connected
                ? 'border border-[#00EED0]/40 bg-[#00EED0]/20 text-[#006E7A]'
                : 'border border-[#4B227A]/30 bg-[#4B227A]/20 text-[#4B227A]'
            }`}
          >
            {connected ? (
              <span className="h-2 w-2 rounded-full bg-[#00EED0]" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {connected ? 'En vivo' : 'Reconectando'}
          </span>
        </div>

        <div className="mt-4 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#006E7A]">
            Chat de negociación
          </p>
          <h1 className="mt-1 break-words text-base font-bold text-gray-800">
            {offer.requestTitle || 'Servicio solicitado'}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-lg border border-white/30 bg-white/70 px-2 py-1 text-gray-600">
              {offer.clientName || 'Cliente'}
            </span>
            <span className="rounded-lg border border-white/30 bg-white/70 px-2 py-1 font-semibold text-[#006E7A]">
              {formatCurrency(offer.totalAmount, offer.currency)}
            </span>
            <span
              className={`rounded-lg px-2 py-1 font-semibold ${
                confirmed
                  ? 'border border-[#00EED0]/40 bg-[#00EED0]/20 text-[#006E7A]'
                  : 'border border-white/30 bg-white/70 text-gray-600'
              }`}
            >
              {statusLabel}
            </span>
            {offer.ownerType === 'workshop' ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-white/30 bg-white/70 px-2 py-1 text-gray-600">
                <ShieldCheck className="h-3 w-3 text-[#4B227A]" /> Taller verificado
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {actionError ? (
        <p
          role="alert"
          className="mx-4 mt-3 rounded-xl border border-red-300/60 bg-white/80 px-3 py-2 text-xs text-red-700 shadow-sm"
        >
          {actionError}
        </p>
      ) : null}

      <main className="flex-1 p-4 pb-8" aria-label="Chat de negociación">
        <div className="flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-xs rounded-2xl border border-white/30 bg-white/70 px-4 py-6 text-center shadow-sm backdrop-blur-md">
              <MessageCircle className="mx-auto h-6 w-6 text-[#006E7A]" />
              <p className="mt-2 text-xs text-gray-600">
                Inicia la conversación para acordar los detalles del servicio.
              </p>
            </div>
          ) : null}

          {messages.map((message) => {
            const system = message.senderType === 'system';
            return (
              <div
                key={message.id}
                className={`flex flex-col max-w-[85%] ${
                  system
                    ? 'self-center items-center max-w-full'
                    : message.isMine
                      ? 'self-end items-end'
                      : 'self-start items-start'
                }`}
              >
                {system ? (
                  <div className="my-2 rounded-full border border-[#4B227A]/30 bg-[#4B227A]/20 px-4 py-2 text-center text-xs font-bold text-[#4B227A] backdrop-blur-md">
                    {message.body}
                  </div>
                ) : (
                  <>
                    <div
                      className={`whitespace-pre-line break-words rounded-2xl px-4 py-3 text-sm ${
                        message.isMine
                          ? 'rounded-br-none bg-gradient-to-r from-[#00EED0] to-[#0197AF] text-black shadow-[0_0_15px_rgba(0,238,208,0.3)]'
                          : 'rounded-bl-none border border-white/30 bg-white/80 text-gray-800 shadow-sm backdrop-blur-md'
                      }`}
                    >
                      <p className={`mb-1 text-[10px] font-bold ${message.isMine ? 'text-black/70' : 'text-[#006E7A]'}`}>
                        {message.senderName || (message.isMine ? 'Tú' : 'Cliente')}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    </div>
                    <span className="mt-1 px-1 text-[10px] text-gray-600">
                      {formatTime(message.createdAt)}
                    </span>
                  </>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </main>

      <section className="space-y-3 border-t border-white/30 bg-white/70 px-4 pb-8 pt-4 backdrop-blur-md" aria-label="Acciones de negociación">
        <div className="rounded-2xl border border-white/30 bg-white/70 p-3 shadow-sm">
          <label htmlFor="offer-notes" className="flex items-center gap-2 text-[11px] font-bold text-gray-800">
            <FileText className="h-3.5 w-3.5 text-[#006E7A]" /> Detalles del repuesto / servicio
          </label>
          <textarea
            id="offer-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Ej. incluye instalación, garantía de 6 meses, refacción OEM…"
            className="mt-2 w-full resize-none rounded-xl border border-[#4B227A]/30 bg-white/80 px-4 py-3 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20"
          />
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={savingNotes}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#4B227A]/30 bg-white/70 px-3 py-1.5 text-[11px] font-bold text-[#4B227A] transition hover:bg-white/90 disabled:opacity-50"
          >
            {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
            Guardar detalles
          </button>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirmed || confirming}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition disabled:cursor-default ${
            confirmed
              ? 'border border-[#00EED0]/40 bg-white/80 text-[#006E7A] shadow-sm'
              : 'bg-[#00EED0] text-black shadow-[0_0_20px_rgba(0,238,208,0.4)] hover:bg-[#00EED0]/90'
          }`}
        >
          {confirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : confirmed ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          {confirmed ? 'Servicio / Reserva Confirmada' : 'Confirmar Servicio / Reserva'}
        </button>

        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={1000}
            placeholder="Escribe un mensaje…"
            aria-label="Mensaje de negociación"
            className="min-w-0 flex-1 rounded-xl border border-[#4B227A]/30 bg-white/80 px-4 py-3 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Enviar mensaje"
            className="rounded-xl bg-[#00EED0] p-3 text-black shadow-[0_0_15px_rgba(0,238,208,0.3)] transition-colors hover:bg-[#00EED0]/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
      </section>
    </div>
  );
}
