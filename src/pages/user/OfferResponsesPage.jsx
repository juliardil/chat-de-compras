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

// Bandeja de "Respuestas de mis ofertas". Solo muestra las ofertas del
// proveedor autenticado: el filtrado lo hace la RPC en el servidor.
// La paleta replica la del chat existente de la app (fondo gris claro,
// glassmorphism blanco y acentos morado/turquesa de Go.Go).
export default function OfferResponsesPage() {
  const navigate = useNavigate();
  const responses = useModuleData(fetchMyOfferResponses, []);

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-24 text-gray-800">
      <header className="rounded-b-[32px] border-b border-white/30 bg-white/70 px-4 pb-6 pt-12 shadow-sm backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate('/workshop-jobs')}
          className="inline-flex items-center gap-2 rounded-xl p-2 text-xs font-bold text-gray-800 transition-colors hover:bg-white/80"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Volver al panel
        </button>

        <div className="mt-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#006E7A]">
              Bandeja de negociación
            </p>
            <h1 className="mt-1 text-xl font-bold text-gray-800">Respuestas de mis ofertas</h1>
            <p className="mt-1 text-xs text-gray-600">
              Conversa con el cliente, afina los detalles y confirma cada servicio.
            </p>
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#4B227A]/10 text-[#4B227A] shadow-sm">
            <Inbox className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
      </header>

      <main className="mt-6 px-4" aria-label="Respuestas de mis ofertas">
        {responses.loading ? (
          <p className="rounded-2xl border border-white/30 bg-white/80 px-4 py-6 text-center text-xs text-gray-600 shadow-sm backdrop-blur-md">
            Cargando respuestas…
          </p>
        ) : null}

        {!responses.loading && responses.error ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-300/60 bg-white/80 px-4 py-3 text-xs text-red-700 shadow-sm"
          >
            {responses.error}
          </p>
        ) : null}

        {!responses.loading && !responses.error && responses.items.length === 0 ? (
          <div className="rounded-3xl border border-white/30 bg-white/70 px-5 py-10 text-center shadow-sm backdrop-blur-md">
            <Inbox className="mx-auto h-8 w-8 text-[#006E7A]" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-gray-800">Todavía no hay respuestas</p>
            <p className="mt-1 text-xs text-gray-600">
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
                className="rounded-2xl border border-white/30 bg-white/80 p-4 shadow-sm backdrop-blur-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-gray-800">
                      {item.request_title || 'Servicio solicitado'}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-600">
                      {item.client_name || 'Cliente'}
                      {item.created_at ? ` · ${formatDate(item.created_at)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${
                      confirmed
                        ? 'border-[#00EED0]/40 bg-[#00EED0]/20 text-[#006E7A]'
                        : 'border-[#4B227A]/30 bg-[#4B227A]/10 text-[#4B227A]'
                    }`}
                  >
                    {confirmed ? 'Reserva confirmada' : item.offer_status || 'active'}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                  <span className="rounded-lg border border-white/30 bg-white/70 px-2 py-1 font-semibold text-[#006E7A]">
                    {formatMoney(item.total_amount, item.currency)}
                  </span>
                  {item.estimated_days ? (
                    <span className="rounded-lg border border-white/30 bg-white/70 px-2 py-1">
                      {item.estimated_days} días
                    </span>
                  ) : null}
                  {item.owner_type === 'workshop' ? (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-white/30 bg-white/70 px-2 py-1">
                      <ShieldCheck className="h-3 w-3 text-[#4B227A]" /> Taller verificado
                    </span>
                  ) : null}
                </div>

                {item.last_message ? (
                  <p className="mt-3 line-clamp-2 rounded-xl border border-white/30 bg-white/60 px-3 py-2 text-xs text-gray-600">
                    {item.last_message}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => navigate(`/workshop-jobs/responses/${item.offer_id}`)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00EED0] px-4 py-3 text-xs font-bold text-black shadow-[0_0_15px_rgba(0,238,208,0.3)] transition hover:bg-[#00EED0]/90"
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
