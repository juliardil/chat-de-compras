import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Inbox, MessageCircle, ShieldCheck } from 'lucide-react';
import { useModuleData } from '../../data/useModuleData';
import { fetchMyOfferResponses } from '../../data/offerResponses';

const formatMoney = (value, currency) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(date);
};

// Bandeja oscura de "Respuestas de mis ofertas". Solo muestra las ofertas del
// proveedor autenticado: el filtrado lo hace la RPC en el servidor.
export default function OfferResponsesPage() {
  const navigate = useNavigate();
  const responses = useModuleData(fetchMyOfferResponses, []);

  return (
    <div className="min-h-screen bg-[#0B1020] pb-24 text-white">
      <header className="rounded-b-[32px] border-b border-white/10 bg-[#111827] px-6 pb-6 pt-12 shadow-xl">
        <button
          type="button"
          onClick={() => navigate('/workshop-jobs')}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver al panel
        </button>

        <div className="mt-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#00EED0]">
              Bandeja de negociación
            </p>
            <h1 className="mt-1 text-xl font-bold">Respuestas de mis ofertas</h1>
            <p className="mt-1 text-xs text-slate-300">
              Conversa con el cliente, afina los detalles y confirma cada servicio.
            </p>
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#00EED0]">
            <Inbox className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
      </header>

      <main className="mt-6 px-6" aria-label="Respuestas de mis ofertas">
        {responses.loading ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-xs text-slate-300">
            Cargando respuestas…
          </p>
        ) : null}

        {!responses.loading && responses.error ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs text-red-200"
          >
            {responses.error}
          </p>
        ) : null}

        {!responses.loading && !responses.error && responses.items.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#111827]/90 px-5 py-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-[#00EED0]" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold">Todavía no hay respuestas</p>
            <p className="mt-1 text-xs text-slate-400">
              Cuando envíes una propuesta y el cliente la responda, aparecerá aquí.
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          {responses.items.map((item) => {
            const confirmed = item.confirmation_status === 'confirmed';
            return (
              <article
                key={item.offer_id}
                className="rounded-2xl border border-white/10 bg-[#111827]/90 p-4 shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-white">
                      {item.request_title || 'Servicio solicitado'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {item.client_name || 'Cliente'}
                      {item.created_at ? ` · ${formatDate(item.created_at)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${
                      confirmed
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    {confirmed ? 'Reserva confirmada' : item.offer_status || 'active'}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                  <span className="rounded-lg bg-white/5 px-2 py-1 font-semibold text-[#00EED0]">
                    {formatMoney(item.total_amount, item.currency)}
                  </span>
                  {item.estimated_days ? (
                    <span className="rounded-lg bg-white/5 px-2 py-1">{item.estimated_days} días</span>
                  ) : null}
                  {item.owner_type === 'workshop' ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                      <ShieldCheck className="h-3 w-3" /> Taller verificado
                    </span>
                  ) : null}
                </div>

                {item.last_message ? (
                  <p className="mt-3 line-clamp-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-xs text-slate-300">
                    {item.last_message}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => navigate(`/workshop-jobs/responses/${item.offer_id}`)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00EED0] px-4 py-3 text-xs font-bold text-slate-950 transition hover:opacity-90"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" /> Abrir negociación
                </button>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
