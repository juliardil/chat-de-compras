import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ban,
  Check,
  ClipboardList,
  Eye,
  EyeOff,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
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
  REQUEST_ACTION_REASONS,
  REQUEST_STATUS_OPTIONS,
  REQUEST_TRANSITIONS,
  requestActionKey,
  requestActionLabel,
  requestActionPermission,
} from '../constants/phase3';
import { formatDate, formatDateTime, formatRelative } from '../utils/format';

const ACTION_ICONS = {
  hide: EyeOff,
  restore: RotateCcw,
  close: Check,
  cancel: Ban,
};

function buildActions(request, hasPermission) {
  return (REQUEST_TRANSITIONS[request.status] || [])
    .map((to) => {
      const key = requestActionKey(request.status, to);
      return {
        key,
        to,
        label: requestActionLabel(request.status, to),
        permission: requestActionPermission(to),
        tone: key === 'hide' || key === 'cancel' ? 'danger' : 'primary',
        reasons: REQUEST_ACTION_REASONS[key] || [],
        title: `${requestActionLabel(request.status, to)} · ${request.title}`,
        description: 'La acción exige un motivo y queda registrada en la auditoría.',
        successTitle: 'Solicitud actualizada',
        Icon: ACTION_ICONS[key] || Check,
      };
    })
    .filter((action) => hasPermission(action.permission));
}

function RequestDetail({ request }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={request.status} />
          <span className="text-xs font-semibold text-slate-500">
            {request.buyerName || 'Comprador no disponible'}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">{request.title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{request.description}</p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Categoría</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{request.categoryName || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Presupuesto</dt>
          <dd className="mt-0.5 text-sm text-slate-700">
            {request.budgetAmount != null ? `${request.budgetAmount} ${request.currency}` : 'Sin definir'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Publicada</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(request.publishedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vence</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(request.expiresAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Última actualización</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatRelative(request.updatedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ofertas</dt>
          <dd className="mt-0.5 text-sm text-slate-700">
            {request.offerCount} recibidas · {request.activeOfferCount} activas
          </dd>
        </div>
      </dl>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ítems solicitados</p>
        <ul className="mt-2 space-y-1.5">
          {(request.items || []).map((item, index) => {
            const name = item.product || item.item || item.description || item.name || 'Producto';
            const quantity = Number(item.quantity ?? item.cantidad ?? 1) || 1;
            const years = [item.yearFrom ?? item.year_from, item.yearTo ?? item.year_to]
              .filter(Boolean)
              .join(' – ');
            const details = [
              item.category,
              item.vehicleType || item.vehicle_type,
              [item.vehicleBrand || item.vehicle_brand, item.vehicleModel || item.vehicle_model]
                .filter(Boolean)
                .join(' '),
              years ? `Años ${years}` : '',
              item.reference || item.part_number
                ? `Ref. ${item.reference || item.part_number}`
                : '',
              item.condition,
            ]
              .filter(Boolean)
              .join(' · ');
            const hasPrice = item.unitPrice != null || item.totalPrice != null;

            return (
              <li
                key={`${name}-${index}`}
                className="rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 break-words font-medium">{name}</span>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">
                    {quantity} {quantity === 1 ? 'unidad' : 'unidades'}
                  </span>
                </div>
                {details ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{details}</p>
                ) : null}
                {item.notes ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.notes}</p>
                ) : null}
                {hasPrice ? (
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    Precio unitario: {item.unitPrice ?? '—'} {request.currency} · Total:{' '}
                    {item.totalPrice ?? '—'} {request.currency}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Motivo del estado</p>
        <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
          {request.statusReason || 'Sin motivo registrado.'}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Ofertas recibidas
        </p>
        {request.offersRestricted ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
            Tu rol no incluye <code className="font-mono">offers.view</code>. El detalle de ofertas
            está restringido.
          </div>
        ) : request.offers.length ? (
          <ul className="mt-2 space-y-2">
            {request.offers.map((offer) => (
              <li
                key={offer.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {offer.commerceName || 'Comercio no disponible'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {offer.deliveryDays} día(s) · {formatDate(offer.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">
                    {offer.totalAmount} {offer.currency}
                  </span>
                  <StatusBadge status={offer.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Esta solicitud no tiene ofertas registradas.
          </p>
        )}
      </div>
    </div>
  );
}

export default function Requests() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({ loading: true, error: null, requests: [] });
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailTarget, setDetailTarget] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const requests = await adminRepository.listRequests({ actor: session });
      setState({ loading: false, error: null, requests });
    } catch (error) {
      setState({ loading: false, error: error.message, requests: [] });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const requests = await adminRepository.listRequests({ actor: session });
        if (!cancelled) setState({ loading: false, error: null, requests });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, requests: [] });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.requests.filter((request) => {
      if (statusFilter !== 'all' && request.status !== statusFilter) return false;
      if (!term) return true;
      return [request.title, request.description, request.buyerName, request.categoryName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.requests, search, statusFilter]);

  const openDetail = async (request) => {
    setDetailTarget(request);
    try {
      const detail = await adminRepository.getRequest({ requestId: request.id, actor: session });
      setDetailTarget(detail);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cargar la solicitud', description: error.message });
    }
  };

  const confirmAction = async ({ reason, detail }) => {
    if (!actionTarget) return;

    const label = actionTarget.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setActionBusy(true);
    try {
      await adminRepository.setRequestStatus({
        requestId: actionTarget.request.id,
        status: actionTarget.to,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: actionTarget.successTitle,
        description: `${actionTarget.request.title} · ${label}`,
      });
      setActionTarget(null);
      setDetailTarget(null);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo actualizar la solicitud', description: error.message });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mercado"
        title="Solicitudes"
        description="Supervisa las solicitudes de compra publicadas: estado, vencimiento, ofertas recibidas y medidas de moderación con motivo auditado."
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Solicitudes de demostración">
          Esta bandeja usa solicitudes de ejemplo guardadas en este navegador. Las transiciones y
          permisos se aplican localmente para reproducir el servidor, pero aquí no hay datos reales.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando solicitudes…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar las solicitudes">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ClipboardList className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
              Bandeja de solicitudes
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
                  placeholder="Buscar título, comprador o categoría…"
                  aria-label="Buscar solicitudes"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filtrar solicitudes por estado"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todos los estados</option>
                {REQUEST_STATUS_OPTIONS.map((option) => (
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
                    <th scope="col" className="px-5 py-2.5 font-semibold">Solicitud</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Categoría</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Presupuesto</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Ofertas</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Publicada</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((request) => {
                    const actions = buildActions(request, hasPermission);

                    return (
                      <tr key={request.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => openDetail(request)}
                            className="block max-w-xs truncate text-left text-sm font-semibold text-slate-900 hover:text-[#4B227A] hover:underline"
                          >
                            {request.title}
                          </button>
                          <p className="truncate text-xs text-slate-500">
                            {request.buyerName || 'Comprador no disponible'} · {request.itemCount} ítem(s)
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {request.categoryName || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {request.budgetAmount != null
                            ? `${request.budgetAmount} ${request.currency}`
                            : 'Sin definir'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {request.offerCount} · {request.activeOfferCount} activas
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={request.status} />
                        </td>
                        <td
                          className="px-5 py-3.5 text-sm text-slate-600"
                          title={formatDateTime(request.publishedAt)}
                        >
                          {formatRelative(request.publishedAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetail(request)}
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
                                  onClick={() => setActionTarget({ ...action, request })}
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
                Icon={ClipboardList}
                title="Sin solicitudes para este filtro"
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
          <li>Ocultar y restaurar exigen <code className="font-mono">requests.moderate</code>.</li>
          <li>Cerrar y cancelar exigen <code className="font-mono">requests.close</code>.</li>
          <li>Las transiciones se validan también en el servidor; la interfaz solo muestra las permitidas.</li>
          <li>Toda acción exige motivo y genera un evento de auditoría.</li>
        </ul>
      </div>

      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Ficha de la solicitud"
        description="Contenido publicado, estado y ofertas recibidas."
        size="lg"
      >
        {detailTarget ? <RequestDetail request={detailTarget} /> : null}
      </Modal>

      <ReasonDialog
        open={Boolean(actionTarget)}
        title={actionTarget?.title || 'Cambiar estado'}
        description={
          actionTarget ? `${actionTarget.request.title}. ${actionTarget.description}` : ''
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
