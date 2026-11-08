import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, Ban, Eye, Flag, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import ReasonDialog from '../components/ReasonDialog';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/useToast';
import { useAdminAuth } from '../auth/useAdminAuth';
import { adminRepository } from '../data';
import {
  OFFER_ACTION_REASONS,
  OFFER_STATUS_OPTIONS,
  OFFER_TRANSITIONS,
  offerActionKey,
  offerActionLabel,
  offerActionPermission,
} from '../constants/phase3';
import { formatDateTime, formatRelative } from '../utils/format';

const ACTION_ICONS = {
  flag: Flag,
  unflag: RotateCcw,
  withdraw_admin: Ban,
};

function buildActions(offer, hasPermission) {
  return (OFFER_TRANSITIONS[offer.status] || [])
    .map((to) => {
      const key = offerActionKey(offer.status, to);
      return {
        key,
        to,
        label: offerActionLabel(offer.status, to),
        permission: offerActionPermission(to),
        tone: key === 'unflag' ? 'primary' : 'danger',
        reasons: OFFER_ACTION_REASONS[key] || [],
        title: `${offerActionLabel(offer.status, to)} · ${offer.requestTitle || offer.id}`,
        description: 'La acción exige un motivo y queda registrada en la auditoría.',
        successTitle: 'Oferta actualizada',
        Icon: ACTION_ICONS[key] || Flag,
      };
    })
    .filter((action) => hasPermission(action.permission));
}

function OfferDetail({ offer }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={offer.status} />
          <span className="text-xs font-semibold text-slate-500">
            {offer.commerceName || 'Comercio no disponible'}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {offer.requestTitle || 'Solicitud no disponible'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Comprador: {offer.buyerName || '—'}
          {offer.requestStatus ? ` · Solicitud ${offer.requestStatus}` : ''}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Importe</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">
            {offer.totalAmount} {offer.currency}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Plazo de entrega</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{offer.deliveryDays} día(s)</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Creada</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(offer.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vence</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(offer.expiresAt)}</dd>
        </div>
      </dl>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Condiciones</p>
        <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
          {offer.conditions || 'Sin condiciones adicionales.'}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ítems ofertados</p>
        <ul className="mt-2 space-y-1.5">
          {(offer.items || []).map((item, index) => (
            <li
              key={`${item.description}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700"
            >
              <span className="min-w-0 truncate">
                {item.description} · {item.quantity} × {item.unitPrice} {offer.currency}
              </span>
              <span className="shrink-0 font-semibold">
                {item.totalPrice} {offer.currency}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Motivo del estado</p>
        <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
          {offer.statusReason || 'Sin motivo registrado.'}
        </p>
      </div>

      {offer.flaggedReason ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
          Marcada por {offer.flaggedByName || 'administración'} el {formatDateTime(offer.flaggedAt)}:{' '}
          {offer.flaggedReason}
        </div>
      ) : null}
    </div>
  );
}

export default function Offers() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({ loading: true, error: null, offers: [] });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailTarget, setDetailTarget] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const offers = await adminRepository.listOffers({ actor: session });
      setState({ loading: false, error: null, offers });
    } catch (error) {
      setState({ loading: false, error: error.message, offers: [] });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const offers = await adminRepository.listOffers({ actor: session });
        if (!cancelled) setState({ loading: false, error: null, offers });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, offers: [] });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.offers.filter((offer) => {
      if (statusFilter !== 'all' && offer.status !== statusFilter) return false;
      if (!term) return true;
      return [offer.requestTitle, offer.buyerName, offer.commerceName, offer.conditions]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.offers, search, statusFilter]);

  const openDetail = async (offer) => {
    setDetailTarget(offer);
    try {
      const detail = await adminRepository.getOffer({ offerId: offer.id, actor: session });
      setDetailTarget(detail);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cargar la oferta', description: error.message });
    }
  };

  const confirmAction = async ({ reason, detail }) => {
    if (!actionTarget) return;

    const label = actionTarget.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setActionBusy(true);
    try {
      await adminRepository.setOfferStatus({
        offerId: actionTarget.offer.id,
        status: actionTarget.to,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: actionTarget.successTitle,
        description: `${actionTarget.offer.requestTitle || actionTarget.offer.id} · ${label}`,
      });
      setActionTarget(null);
      setDetailTarget(null);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo actualizar la oferta', description: error.message });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mercado"
        title="Ofertas"
        description="Revisa las ofertas enviadas por los comercios, detecta irregularidades y retira publicaciones con motivo auditado."
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Ofertas de demostración">
          Las ofertas, importes y marcas de esta pantalla son ejemplos guardados en este navegador.
          No representan precios ni comercios reales.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando ofertas…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar las ofertas">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <BadgeDollarSign className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
              Ofertas recibidas
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                {filtered.length}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar solicitud, comprador o comercio…"
                  aria-label="Buscar ofertas"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filtrar ofertas por estado"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todos los estados</option>
                {OFFER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Oferta</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Comercio</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Importe</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Entrega</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Creada</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((offer) => {
                    const actions = buildActions(offer, hasPermission);

                    return (
                      <tr key={offer.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => openDetail(offer)}
                            className="block max-w-xs truncate text-left text-sm font-semibold text-slate-900 hover:text-[#4B227A] hover:underline"
                          >
                            {offer.requestTitle || 'Solicitud no disponible'}
                          </button>
                          <p className="truncate text-xs text-slate-500">
                            {offer.buyerName || '—'} · {offer.itemCount} ítem(s)
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {offer.commerceName || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">
                          {offer.totalAmount} {offer.currency}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {offer.deliveryDays} día(s)
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={offer.status} />
                        </td>
                        <td
                          className="px-5 py-3.5 text-sm text-slate-600"
                          title={formatDateTime(offer.createdAt)}
                        >
                          {formatRelative(offer.createdAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetail(offer)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              Ficha
                            </button>
                            {actions.map((action) => {
                              const Icon = action.Icon;
                              const toneClasses =
                                action.tone === 'danger'
                                  ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                                  : 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100';

                              return (
                                <button
                                  key={action.key}
                                  type="button"
                                  onClick={() => setActionTarget({ ...action, offer })}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${toneClasses}`}
                                >
                                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                  {action.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                Icon={BadgeDollarSign}
                title="Sin ofertas para este filtro"
                description="Prueba con otro estado o limpia la búsqueda."
              />
            </div>
          )}
        </section>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs leading-6 text-slate-500 shadow-sm">
        <p className="flex items-center gap-2 font-semibold text-slate-700">
          <ShieldCheck className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
          Reglas de esta pantalla
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Marcar o retirar una marca exige <code className="font-mono">offers.flag</code>.</li>
          <li>El retiro administrativo exige <code className="font-mono">offers.withdraw_admin</code>.</li>
          <li>Las ofertas aceptadas, vencidas o ya retiradas son de solo lectura.</li>
          <li>Toda acción exige motivo y genera un evento de auditoría.</li>
        </ul>
      </div>

      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Ficha de la oferta"
        description="Importe, condiciones, ítems y estado de la oferta."
        size="lg"
      >
        {detailTarget ? <OfferDetail offer={detailTarget} /> : null}
      </Modal>

      <ReasonDialog
        open={Boolean(actionTarget)}
        title={actionTarget?.title || 'Cambiar estado'}
        description={
          actionTarget
            ? `${actionTarget.offer.requestTitle || actionTarget.offer.id}. ${actionTarget.description}`
            : ''
        }
        reasons={actionTarget?.reasons || []}
        confirmLabel={actionTarget?.label || 'Confirmar'}
        tone={actionTarget?.tone || 'danger'}
        busy={actionBusy}
        onConfirm={confirmAction}
        onClose={() => setActionTarget(null)}
      />
    </div>
  );
}
