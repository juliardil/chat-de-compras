import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
      <div className="min-h-screen bg-[#0B1020] px-6 py-16 text-white">
        <div className="mx-auto flex max-w-md items-center justify-center gap-2 text-sm text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-[#00EED0]" /> Cargando negociación…
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-[#0B1020] px-6 py-16 text-white">
        <div className="mx-auto max-w-md rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-center">
          <p role="alert" className="text-sm text-red-200">
            {error || 'No se pudo abrir la negociación.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/workshop-jobs/responses')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#00EED0] px-4 py-2.5 text-xs font-bold text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a respuestas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0B1020] text-white">
      <header className="border-b border-white/10 bg-[#111827] px-5 pb-4 pt-10">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/workshop-jobs/responses')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Respuestas
          </button>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
              connected
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                : 'border-white/15 bg-white/5 text-slate-400'
            }`}
          >
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? 'En vivo' : 'Reconectando'}
          </span>
        </div>

        <div className="mt-4 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#00EED0]">
            Chat de negociación
          </p>
          <h1 className="mt-1 break-words text-base font-bold">
            {offer.requestTitle || 'Servicio solicitado'}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-lg bg-white/5 px-2 py-1 text-slate-300">
              {offer.clientName || 'Cliente'}
            </span>
            <span className="rounded-lg bg-white/5 px-2 py-1 font-semibold text-[#00EED0]">
              {formatCurrency(offer.totalAmount, offer.currency)}
            </span>
            <span
              className={`rounded-lg px-2 py-1 font-semibold ${
                confirmed
                  ? 'bg-emerald-400/10 text-emerald-300'
                  : 'bg-white/5 text-slate-300'
              }`}
            >
              {statusLabel}
            </span>
            {offer.ownerType === 'workshop' ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-slate-300">
                <ShieldCheck className="h-3 w-3" /> Taller verificado
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {actionError ? (
        <p
          role="alert"
          className="mx-5 mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
        >
          {actionError}
        </p>
      ) : null}

      <main className="flex-1 px-5 py-5" aria-label="Chat de negociación">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-xs rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center">
              <MessageCircle className="mx-auto h-6 w-6 text-[#00EED0]" />
              <p className="mt-2 text-xs text-slate-300">
                Inicia la conversación para acordar los detalles del servicio.
              </p>
            </div>
          ) : null}

          {messages.map((message) => {
            const system = message.senderType === 'system';
            return (
              <div
                key={message.id}
                className={`flex ${system ? 'justify-center' : message.isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-md ${
                    system
                      ? 'border border-emerald-400/20 bg-emerald-400/10 text-center text-emerald-200'
                      : message.isMine
                        ? 'rounded-br-md bg-[#00EED0] text-slate-950'
                        : 'rounded-bl-md border border-white/10 bg-[#111827] text-slate-100'
                  }`}
                >
                  {!system ? (
                    <p className={`mb-1 text-[10px] font-bold ${message.isMine ? 'text-slate-800' : 'text-[#00EED0]'}`}>
                      {message.senderName || (message.isMine ? 'Tú' : 'Cliente')}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  {!system ? (
                    <p className={`mt-1 text-right text-[9px] ${message.isMine ? 'text-slate-700' : 'text-slate-500'}`}>
                      {formatTime(message.createdAt)}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </main>

      <section className="space-y-3 border-t border-white/10 bg-[#111827] px-5 pb-8 pt-4" aria-label="Acciones de negociación">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <label htmlFor="offer-notes" className="flex items-center gap-2 text-[11px] font-bold text-slate-200">
            <FileText className="h-3.5 w-3.5 text-[#00EED0]" /> Detalles del repuesto / servicio
          </label>
          <textarea
            id="offer-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Ej. incluye instalación, garantía de 6 meses, refacción OEM…"
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#00EED0]/50"
          />
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={savingNotes}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
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
              ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
              : 'bg-[#19C6A5] text-slate-950 hover:opacity-90'
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

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={1000}
            placeholder="Escribe un mensaje…"
            aria-label="Mensaje de negociación"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#00EED0]/50"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Enviar mensaje"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00EED0] text-slate-950 transition hover:opacity-90 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </section>
    </div>
  );
}
