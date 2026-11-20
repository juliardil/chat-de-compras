import React, { useState } from 'react';
import {
  BadgeCheck,
  Car,
  CheckCircle2,
  Clock,
  ClipboardList,
  MapPin,
  MessageCircle,
  Send,
  Users,
} from 'lucide-react';
import Button from '../ui/Button';
import CompactOfferChat from './CompactOfferChat';
import { DataNotice, EmptyModule, LoadingModule } from '../ui/ModuleState';
import { useModuleData } from '../../data/useModuleData';
import {
  createServiceProposal,
  fetchAvailableServiceJobs,
  fetchMyServiceProposals,
  openWorkshopOfferChat,
} from '../../data/workshop';

const inputClass =
  'w-full rounded-xl border border-[#4B227A]/20 bg-white/80 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20';

const formatMoney = (value) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

// Bandeja "Trabajos / Instalaciones Disponibles" del taller verificado.
// Las propuestas son ofertas reutilizadas y el chat es el hilo de siempre.
export default function WorkshopJobsPanel({ activeTab = 'all', embedded = false }) {
  const jobs = useModuleData(fetchAvailableServiceJobs, []);
  const proposals = useModuleData(fetchMyServiceProposals, []);

  const [quotingJobId, setQuotingJobId] = useState(null);
  const [laborAmount, setLaborAmount] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [chatError, setChatError] = useState(null);
  const [chatSheet, setChatSheet] = useState(null);

  // Por defecto se muestran ambos bloques (uso independiente del componente).
  // El Panel de Trabajos pasa `embedded` y elige qué pestaña pintar.
  const showJobs = activeTab === 'all' || activeTab === 'jobs';
  const showProposals = activeTab === 'all' || activeTab === 'proposals';

  const startQuote = (job) => {
    setQuotingJobId(job.id);
    setLaborAmount('');
    setEstimatedDays('');
    setNotes('');
    setActionError(null);
    setActionSuccess(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await createServiceProposal({
        requestId: quotingJobId,
        laborAmount: Number(laborAmount),
        estimatedDays: Number(estimatedDays),
        notes,
      });
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setActionSuccess('Propuesta enviada. El cliente la verá junto a sus ofertas');
      setQuotingJobId(null);
      jobs.reload();
      proposals.reload();
    } catch (error) {
      setActionError(error?.message || 'No se pudo enviar la propuesta.');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenChat = async (proposal) => {
    setChatError(null);
    // La RPC crea/reutiliza el hilo compartido; la corrección SQL garantiza
    // que su `returning id` esté calificado y ya no sea ambiguo.
    const result = await openWorkshopOfferChat(proposal.id);
    if (result.error || !result.items?.[0]) {
      setChatError(result.error || result.notice || 'No se pudo abrir la conversación.');
      return;
    }
    // Se abre el bottom-sheet con la oferta: la misma lógica de negociación
    // del chat completo, sin navegar fuera del Panel de Trabajos.
    setChatSheet({ offerId: proposal.id, clientName: proposal.client_name || null });
  };

  return (
    <section
      className={embedded ? '' : 'mt-5 border-t border-[#4B227A]/15 pt-5'}
      aria-label="Trabajos disponibles"
    >
      {!embedded ? (
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-[#4B227A]" aria-hidden="true" />
          <h4 className="text-sm font-bold text-gray-800">Trabajos / Instalaciones Disponibles</h4>
        </div>
      ) : null}

      {actionError ? <DataNotice tone="error" className="mb-3">{actionError}</DataNotice> : null}
      {actionSuccess ? (
        <DataNotice tone="info" className="mb-3">{actionSuccess}</DataNotice>
      ) : null}
      {chatError ? <DataNotice tone="error" className="mb-3">{chatError}</DataNotice> : null}

      {showJobs ? (
        <>
          {jobs.loading ? <LoadingModule label="Buscando trabajos…" /> : null}
          {!jobs.loading && jobs.error ? (
            <DataNotice tone="error" className="mb-3">{jobs.error}</DataNotice>
          ) : null}

          {!jobs.loading && jobs.items.length === 0 ? (
            <EmptyModule
              icon={ClipboardList}
              title="Sin trabajos disponibles"
              description="Todavía no hay solicitudes de instalación o reparación abiertas."
            />
          ) : null}

          <div className="space-y-3">
            {jobs.items.map((job) => (
              <article
                key={job.id}
                className="rounded-2xl border border-[#4B227A]/15 bg-white/70 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 break-words">
                      {job.title || 'Trabajo de instalación / reparación'}
                    </p>
                    <p className="mt-1 text-xs text-gray-600 break-words">
                      {job.description || 'Sin descripción adicional.'}
                    </p>
                  </div>
                  {job.client_is_club_member ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] font-bold text-amber-800">
                      <Users className="w-3 h-3" /> Cliente de club
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-gray-600">
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1">
                    <Car className="w-3 h-3" /> {job.vehicle_plate || job.vehicle_type || 'Vehículo no indicado'}
                  </span>
                  {job.service_zone ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1">
                      <MapPin className="w-3 h-3" /> {job.service_zone}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1">
                    {job.client_name || 'Comprador'}
                  </span>
                </div>

                {quotingJobId === job.id ? (
                  <form className="mt-3 space-y-3 border-t border-white/60 pt-3" onSubmit={handleSubmit}>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-700">Precio de mano de obra (MXN)</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        className={`mt-1 ${inputClass}`}
                        value={laborAmount}
                        onChange={(event) => setLaborAmount(event.target.value)}
                        placeholder="Ej. 850"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-700">Tiempo estimado (días)</span>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        required
                        className={`mt-1 ${inputClass}`}
                        value={estimatedDays}
                        onChange={(event) => setEstimatedDays(event.target.value)}
                        placeholder="Ej. 2"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-700">Notas para el cliente</span>
                      <textarea
                        className={`mt-1 ${inputClass} min-h-[70px]`}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Incluye lo que cubre tu servicio y cualquier recomendación"
                        maxLength={1000}
                      />
                    </label>
                    <div className="flex gap-2">
                      <Button type="submit" fullWidth disabled={busy}>
                        <Send className="w-4 h-4" /> {busy ? 'Enviando…' : 'Enviar propuesta'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setQuotingJobId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button type="button" fullWidth onClick={() => startQuote(job)} className="mt-3 !py-2.5 !text-xs">
                    Enviar propuesta
                  </Button>
                )}
              </article>
            ))}
          </div>
        </>
      ) : null}

      {showProposals ? (
        <div className={embedded ? '' : 'mt-5 border-t border-[#4B227A]/15 pt-4'}>
          {!embedded ? (
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              Mis propuestas enviadas
            </h5>
          ) : null}
          {proposals.loading ? <LoadingModule label="Cargando propuestas…" /> : null}
          {!proposals.loading && proposals.items.length === 0 ? (
            <p className="text-xs text-gray-500">Aún no has enviado propuestas.</p>
          ) : null}
          <div className="space-y-2">
            {proposals.items.map((proposal) => (
              <div
                key={proposal.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 border border-[#4B227A]/10 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 break-words">
                    {proposal.request_title || 'Trabajo'}
                  </p>
                  <p className="text-[11px] text-gray-600 flex flex-wrap items-center gap-2">
                    <span>{formatMoney(proposal.labor_amount)} de mano de obra</span>
                    {proposal.estimated_days != null ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {proposal.estimated_days} días
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 capitalize">
                      <CheckCircle2 className="w-3 h-3" /> {proposal.status}
                    </span>
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => handleOpenChat(proposal)} className="!py-2 !text-xs">
                  <MessageCircle className="w-3.5 h-3.5" /> Chat
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showJobs ? (
        <p className="mt-4 flex items-center gap-1 text-[11px] text-gray-500">
          <BadgeCheck className="w-3.5 h-3.5 text-green-600" />
          Tus propuestas llegan al comprador dentro del flujo de ofertas y chat existente.
        </p>
      ) : null}

      {chatSheet ? (
        <CompactOfferChat
          offerId={chatSheet.offerId}
          clientName={chatSheet.clientName}
          onClose={() => setChatSheet(null)}
        />
      ) : null}
    </section>
  );
}
