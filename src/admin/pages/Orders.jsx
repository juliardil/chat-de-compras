import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  Package,
  Scale,
  Search,
  ShieldCheck,
  Truck,
  XCircle,
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
  ORDER_DISPUTE_RESOLUTIONS,
  ORDER_STATUS_OPTIONS,
  ORDER_TRANSITIONS,
  ORDER_TRANSITION_REASONS,
  orderTransitionLabel,
  orderTransitionPermission,
  orderTransitionReasonKey,
} from '../constants/phase3';
import { formatDateTime, formatRelative } from '../utils/format';

const ACTION_ICONS = {
  confirmed: Check,
  preparing: Package,
  shipped: Truck,
  delivered: CheckCircle2,
  completed: CheckCircle2,
  disputed: AlertTriangle,
  cancelled: XCircle,
};

const RESOLUTION_LABELS = ORDER_DISPUTE_RESOLUTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

function buildActions(order, hasPermission) {
  return (ORDER_TRANSITIONS[order.status] || [])
    .map((to) => {
      const permission = orderTransitionPermission(order.status, to);
      const reasonKey = orderTransitionReasonKey(order.status, to);
      return {
        key: `${order.status}-${to}`,
        to,
        label: orderTransitionLabel(order.status, to),
        permission,
        tone: to === 'cancelled' || to === 'disputed' ? 'danger' : 'primary',
        reasons: ORDER_TRANSITION_REASONS[reasonKey] || [],
        title: `${orderTransitionLabel(order.status, to)} · ${order.orderNumber}`,
        description: 'La transición se valida en el servidor y queda registrada en la auditoría.',
        successTitle: 'Pedido actualizado',
        resolve: order.status === 'disputed',
        Icon: ACTION_ICONS[to] || Check,
      };
    })
    .filter((action) => hasPermission(action.permission));
}

function ResolveDisputeDialog({ open, target, busy, onClose, onConfirm }) {
  const [resolution, setResolution] = useState('');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (open) {
      setResolution('');
      setDetail('');
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target?.title || 'Resolver disputa'}
      description={
        target
          ? `${target.order.orderNumber}. Elige la resolución y deja constancia para la auditoría.`
          : ''
      }
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !resolution}
            onClick={() => onConfirm({ resolution, detail })}
            className="rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Guardando…' : target?.label || 'Resolver'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="dispute-resolution" className="text-sm font-medium text-slate-700">
            Resolución
          </label>
          <select
            id="dispute-resolution"
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          >
            <option value="">Selecciona una resolución…</option>
            {ORDER_DISPUTE_RESOLUTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dispute-detail" className="text-sm font-medium text-slate-700">
            Detalle de la resolución
          </label>
          <textarea
            id="dispute-detail"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Contexto y criterio aplicado"
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          />
        </div>
        <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-500">
          Resolver una disputa exige <code className="font-mono">orders.resolve_dispute</code> y
          genera un evento de auditoría con la resolución elegida.
        </p>
      </div>
    </Modal>
  );
}

function OrderDetail({ order }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <span className="text-xs font-semibold text-slate-500">{order.orderNumber}</span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {order.snapshot?.requestTitle || 'Pedido sin título de solicitud'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {order.buyerName || '—'} · {order.commerceName || '—'}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Importe</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-800">
            {order.totalAmount} {order.currency}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Creado</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(order.placedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Confirmado</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(order.confirmedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Última actualización</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatRelative(order.updatedAt)}</dd>
        </div>
      </dl>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-5 text-sky-800">
        Los ítems de este pedido son una copia inmutable tomada al confirmar la oferta. No se
        recalculan desde la oferta ni desde el catálogo actual.
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ítems del pedido</p>
        <ul className="mt-2 space-y-1.5">
          {(order.items || []).map((item, index) => (
            <li
              key={`${item.description}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700"
            >
              <span className="min-w-0 truncate">
                {item.description} · {item.quantity} × {item.unitPrice} {order.currency}
              </span>
              <span className="shrink-0 font-semibold">
                {item.totalPrice} {order.currency}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Motivo del estado</p>
        <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
          {order.statusReason || 'Sin motivo registrado.'}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Timeline</p>
        {order.timeline?.length ? (
          <ol className="mt-2 space-y-2">
            {order.timeline.map((event) => (
              <li key={event.id} className="flex gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#006E7A]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={event.status} />
                    <span className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-700">{event.description}</p>
                  <p className="text-xs text-slate-500">Por {event.actorName || 'Sistema'}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Sin eventos registrados.
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Disputas</p>
        {order.disputes?.length ? (
          <ul className="mt-2 space-y-2">
            {order.disputes.map((dispute) => (
              <li key={dispute.id} className="rounded-lg border border-slate-100 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={dispute.status === 'open' ? 'disputed' : 'resolved'}>
                    {dispute.status === 'open' ? 'Abierta' : 'Resuelta'}
                  </StatusBadge>
                  <span className="text-xs text-slate-500">
                    {formatDateTime(dispute.openedAt)} · {dispute.openedByName || '—'}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-700">{dispute.reason}</p>
                {dispute.status === 'resolved' ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {RESOLUTION_LABELS[dispute.resolution] || dispute.resolution}
                    {dispute.resolutionReason ? ` · ${dispute.resolutionReason}` : ''}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Sin disputas registradas.
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Entrega</p>
        {order.deliveryRestricted ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
            Tu rol no incluye <code className="font-mono">deliveries.view</code>. El seguimiento de
            entrega está restringido.
          </div>
        ) : order.delivery ? (
          <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={order.delivery.status} />
              <span className="text-xs text-slate-500">
                {order.delivery.carrier || 'Sin transportista'}
                {order.delivery.trackingCode ? ` · ${order.delivery.trackingCode}` : ''}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Actualizada {formatRelative(order.delivery.updatedAt)}
            </p>
          </div>
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Este pedido no tiene una entrega registrada.
          </p>
        )}
      </div>
    </div>
  );
}

export default function Orders() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({ loading: true, error: null, orders: [] });
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailTarget, setDetailTarget] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const orders = await adminRepository.listOrders({ actor: session });
      setState({ loading: false, error: null, orders });
    } catch (error) {
      setState({ loading: false, error: error.message, orders: [] });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const orders = await adminRepository.listOrders({ actor: session });
        if (!cancelled) setState({ loading: false, error: null, orders });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, orders: [] });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (!term) return true;
      return [
        order.orderNumber,
        order.snapshot?.requestTitle,
        order.buyerName,
        order.commerceName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.orders, search, statusFilter]);

  const openDetail = async (order) => {
    setDetailTarget(order);
    try {
      const detail = await adminRepository.getOrder({ orderId: order.id, actor: session });
      setDetailTarget(detail);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cargar el pedido', description: error.message });
    }
  };

  const runTransition = async ({ order, action, reason, reasonCode, resolution }) => {
    setActionBusy(true);
    try {
      await adminRepository.transitionOrder({
        orderId: order.id,
        status: action.to,
        reason,
        reasonCode: reasonCode || null,
        resolution: resolution || null,
        actor: session,
      });
      notify({
        title: action.successTitle,
        description: `${order.orderNumber} · ${action.label}`,
      });
      setActionTarget(null);
      setDetailTarget(null);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo actualizar el pedido', description: error.message });
    } finally {
      setActionBusy(false);
    }
  };

  const confirmAction = async ({ reason, detail }) => {
    if (!actionTarget) return;

    const label = actionTarget.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    await runTransition({
      order: actionTarget.order,
      action: actionTarget,
      reason: reasonText,
      reasonCode: reason,
    });
  };

  const confirmResolution = async ({ resolution, detail }) => {
    if (!actionTarget) return;

    const label = RESOLUTION_LABELS[resolution] || resolution;
    const reasonText = detail ? `${label}: ${detail}` : label;

    await runTransition({
      order: actionTarget.order,
      action: actionTarget,
      reason: reasonText,
      reasonCode: resolution,
      resolution,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operaciones"
        title="Pedidos"
        description="Ciclo completo del pedido: timeline, snapshot inmutable de ítems, cancelación controlada y resolución de disputas con motivo auditado."
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Pedidos de demostración">
          Los pedidos, importes y timelines de esta pantalla son ejemplos guardados en este
          navegador. No representan operaciones reales.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando pedidos…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar los pedidos">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Package className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
              Pedidos
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
                  placeholder="Buscar pedido, comprador o comercio…"
                  aria-label="Buscar pedidos"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filtrar pedidos por estado"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todos los estados</option>
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Pedido</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Comercio</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Importe</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Entrega</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Creado</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => {
                    const actions = buildActions(order, hasPermission);

                    return (
                      <tr key={order.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => openDetail(order)}
                            className="block max-w-xs truncate text-left text-sm font-semibold text-slate-900 hover:text-[#4B227A] hover:underline"
                          >
                            {order.orderNumber}
                          </button>
                          <p className="truncate text-xs text-slate-500">
                            {order.snapshot?.requestTitle || 'Sin título'} · {order.buyerName || '—'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {order.commerceName || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">
                          {order.totalAmount} {order.currency}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={order.status} />
                          {order.hasOpenDispute ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                              Disputa abierta
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {order.deliveryStatus ? (
                            <StatusBadge status={order.deliveryStatus} />
                          ) : (
                            <span className="text-xs text-slate-400">Sin acceso o sin entrega</span>
                          )}
                        </td>
                        <td
                          className="px-5 py-3.5 text-sm text-slate-600"
                          title={formatDateTime(order.createdAt)}
                        >
                          {formatRelative(order.createdAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetail(order)}
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
                                  onClick={() => setActionTarget({ ...action, order })}
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
                Icon={Package}
                title="Sin pedidos para este filtro"
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
          <li>Avanzar estados exige <code className="font-mono">orders.transition</code>.</li>
          <li>Cancelar exige <code className="font-mono">orders.cancel</code>.</li>
          <li>Resolver una disputa exige <code className="font-mono">orders.resolve_dispute</code> y una resolución explícita.</li>
          <li>Las transiciones se validan en el servidor, no solo en la interfaz.</li>
        </ul>
      </div>

      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Ficha del pedido"
        description="Snapshot, timeline, disputas y entrega asociada."
        size="lg"
      >
        {detailTarget ? <OrderDetail order={detailTarget} /> : null}
      </Modal>

      <ReasonDialog
        open={Boolean(actionTarget) && !actionTarget?.resolve}
        title={actionTarget?.title || 'Cambiar estado'}
        description={
          actionTarget
            ? `${actionTarget.order.orderNumber}. ${actionTarget.description}`
            : ''
        }
        reasons={actionTarget?.reasons || []}
        confirmLabel={actionTarget?.label || 'Confirmar'}
        tone={actionTarget?.tone || 'danger'}
        busy={actionBusy}
        onConfirm={confirmAction}
        onClose={() => setActionTarget(null)}
      />

      <ResolveDisputeDialog
        open={Boolean(actionTarget?.resolve)}
        target={actionTarget}
        busy={actionBusy}
        onConfirm={confirmResolution}
        onClose={() => setActionTarget(null)}
      />
    </div>
  );
}
