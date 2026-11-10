import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  FileWarning,
  MapPin,
  Package,
  RotateCcw,
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
  DELIVERY_INCIDENT_TYPES,
  DELIVERY_STATUS_OPTIONS,
  DELIVERY_TRANSITIONS,
  DELIVERY_TRANSITION_REASONS,
  deliveryActionLabel,
  deliveryTransitionPermission,
} from '../constants/phase3';
import { formatDateTime, formatRelative } from '../utils/format';

const ACTION_ICONS = {
  preparing: Package,
  shipped: Truck,
  in_transit: MapPin,
  delivered: CheckCircle2,
  failed: AlertTriangle,
  returned: RotateCcw,
  cancelled: XCircle,
};

function buildActions(delivery, hasPermission) {
  return (DELIVERY_TRANSITIONS[delivery.status] || [])
    .map((to) => ({
      key: `${delivery.status}-${to}`,
      to,
      label: deliveryActionLabel(to),
      permission: deliveryTransitionPermission(to),
      tone: to === 'failed' || to === 'returned' || to === 'cancelled' ? 'danger' : 'primary',
      reasons: DELIVERY_TRANSITION_REASONS[to] || [],
      title: `${deliveryActionLabel(to)} · ${delivery.orderNumber}`,
      description: 'El seguimiento se valida en el servidor y queda registrado en la auditoría.',
      successTitle: 'Entrega actualizada',
      Icon: ACTION_ICONS[to] || Check,
    }))
    .filter((action) => hasPermission(action.permission));
}

function IncidentReportDialog({ open, delivery, busy, onClose, onConfirm }) {
  const [incidentType, setIncidentType] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setIncidentType('');
      setDescription('');
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={delivery ? `Registrar incidencia · ${delivery.orderNumber}` : 'Registrar incidencia'}
      description="La incidencia queda asociada a la entrega y se registra en la auditoría."
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
            disabled={busy || !incidentType || !description.trim()}
            onClick={() => onConfirm({ incidentType, description })}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Registrar incidencia'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="incident-type" className="text-sm font-medium text-slate-700">
            Tipo de incidencia
          </label>
          <select
            id="incident-type"
            value={incidentType}
            onChange={(event) => setIncidentType(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          >
            <option value="">Selecciona un tipo…</option>
            {DELIVERY_INCIDENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="incident-description" className="text-sm font-medium text-slate-700">
            Descripción
          </label>
          <textarea
            id="incident-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Qué ocurrió y qué información aporta el comprador o el transportista"
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          />
        </div>
      </div>
    </Modal>
  );
}

function IncidentResolveDialog({ open, incident, busy, onClose, onConfirm }) {
  const [resolutionReason, setResolutionReason] = useState('');

  useEffect(() => {
    if (open) setResolutionReason('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resolver incidencia"
      description={
        incident?.typeLabel ? `${incident.typeLabel}. Deja constancia de la resolución.` : ''
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
            disabled={busy || !resolutionReason.trim()}
            onClick={() => onConfirm({ resolutionReason })}
            className="rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Resolver incidencia'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="incident-resolution" className="text-sm font-medium text-slate-700">
            Resolución
          </label>
          <textarea
            id="incident-resolution"
            value={resolutionReason}
            onChange={(event) => setResolutionReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Cómo se resolvió y qué evidencia se revisó"
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          />
        </div>
      </div>
    </Modal>
  );
}

function DeliveryDetail({ delivery, mode, canUpdate, onReportIncident, onResolveIncident, onPreview }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={delivery.status} />
          <span className="text-xs font-semibold text-slate-500">{delivery.orderNumber}</span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {delivery.commerceName || 'Comercio no disponible'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Comprador: {delivery.buyerName || '—'}
          {delivery.orderTotalAmount != null
            ? ` · ${delivery.orderTotalAmount} ${delivery.currency || ''}`
            : ''}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Transportista</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{delivery.carrier || 'Sin asignar'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Seguimiento</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{delivery.trackingCode || 'Sin código'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Entrega estimada</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(delivery.estimatedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Última actualización</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatRelative(delivery.updatedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Enviado</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(delivery.shippedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Entregado</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(delivery.deliveredAt)}</dd>
        </div>
      </dl>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Motivo del estado</p>
        <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
          {delivery.statusReason || 'Sin motivo registrado.'}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Incidencias</p>
          {canUpdate ? (
            <button
              type="button"
              onClick={onReportIncident}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              <FileWarning className="h-3.5 w-3.5" aria-hidden="true" />
              Registrar incidencia
            </button>
          ) : null}
        </div>
        {delivery.incidents?.length ? (
          <ul className="mt-2 space-y-2">
            {delivery.incidents.map((incident) => (
              <li key={incident.id} className="rounded-lg border border-slate-100 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={incident.status === 'open' ? 'failed' : 'delivered'}>
                    {incident.status === 'open' ? 'Abierta' : 'Resuelta'}
                  </StatusBadge>
                  <span className="text-xs font-semibold text-slate-700">{incident.typeLabel}</span>
                  <span className="text-xs text-slate-500">
                    {formatDateTime(incident.reportedAt)} · {incident.reportedByName || '—'}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-700">{incident.description}</p>
                {incident.status === 'resolved' ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {incident.resolutionReason || 'Resuelta.'}
                    {incident.resolvedByName ? ` · ${incident.resolvedByName}` : ''}
                  </p>
                ) : canUpdate ? (
                  <button
                    type="button"
                    onClick={() => onResolveIncident(incident)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Resolver incidencia
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Sin incidencias registradas.
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Evidencia de entrega</p>
        {mode === 'demo' ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
            En la demostración la evidencia es solo metadatos: no existen archivos ni bucket. No se
            simula ninguna imagen ni firma.
          </div>
        ) : null}
        {delivery.evidence?.length ? (
          <ul className="mt-2 space-y-2">
            {delivery.evidence.map((evidence) => (
              <li
                key={evidence.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {evidence.typeLabel} · {evidence.fileName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(evidence.uploadedAt)} · {evidence.mimeType || 'sin tipo'} ·{' '}
                    {evidence.note || 'Sin nota'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!evidence.hasFile}
                  title={
                    evidence.hasFile
                      ? 'Abrir archivo firmado'
                      : 'Sin archivo: la demostración solo guarda metadatos'
                  }
                  onClick={() => onPreview(evidence)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  {evidence.hasFile ? 'Abrir archivo' : 'Sin archivo'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Sin evidencia registrada.
          </p>
        )}
      </div>
    </div>
  );
}

export default function Deliveries() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({ loading: true, error: null, deliveries: [] });
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailTarget, setDetailTarget] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [incidentTarget, setIncidentTarget] = useState(null);
  const [incidentBusy, setIncidentBusy] = useState(false);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveBusy, setResolveBusy] = useState(false);

  const canUpdate = hasPermission('deliveries.update');

  const refresh = useCallback(async () => {
    try {
      const deliveries = await adminRepository.listDeliveries({ actor: session });
      setState({ loading: false, error: null, deliveries });
    } catch (error) {
      setState({ loading: false, error: error.message, deliveries: [] });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const deliveries = await adminRepository.listDeliveries({ actor: session });
        if (!cancelled) setState({ loading: false, error: null, deliveries });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, deliveries: [] });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.deliveries.filter((delivery) => {
      if (statusFilter !== 'all' && delivery.status !== statusFilter) return false;
      if (!term) return true;
      return [
        delivery.orderNumber,
        delivery.buyerName,
        delivery.commerceName,
        delivery.carrier,
        delivery.trackingCode,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.deliveries, search, statusFilter]);

  const openDetail = async (delivery) => {
    setDetailTarget(delivery);
    try {
      const detail = await adminRepository.getDelivery({ deliveryId: delivery.id, actor: session });
      setDetailTarget(detail);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cargar la entrega', description: error.message });
    }
  };

  const refreshDetail = async (deliveryId) => {
    try {
      const detail = await adminRepository.getDelivery({ deliveryId, actor: session });
      setDetailTarget(detail);
    } catch {
      setDetailTarget(null);
    }
  };

  const confirmAction = async ({ reason, detail }) => {
    if (!actionTarget) return;

    const label = actionTarget.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setActionBusy(true);
    try {
      if (actionTarget.to === 'delivered') {
        await adminRepository.confirmDelivery({
          deliveryId: actionTarget.delivery.id,
          reason: reasonText,
          reasonCode: reason,
          actor: session,
        });
      } else {
        await adminRepository.updateDelivery({
          deliveryId: actionTarget.delivery.id,
          status: actionTarget.to,
          reason: reasonText,
          reasonCode: reason,
          actor: session,
        });
      }
      notify({
        title: actionTarget.successTitle,
        description: `${actionTarget.delivery.orderNumber} · ${label}`,
      });
      setActionTarget(null);
      setDetailTarget(null);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo actualizar la entrega', description: error.message });
    } finally {
      setActionBusy(false);
    }
  };

  const reportIncident = async ({ incidentType, description }) => {
    if (!incidentTarget) return;

    setIncidentBusy(true);
    try {
      await adminRepository.reportDeliveryIncident({
        deliveryId: incidentTarget.id,
        incidentType,
        description,
        actor: session,
      });
      notify({
        title: 'Incidencia registrada',
        description: `${incidentTarget.orderNumber} · ${description}`,
      });
      setIncidentTarget(null);
      await Promise.all([refresh(), refreshDetail(incidentTarget.id)]);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo registrar la incidencia', description: error.message });
    } finally {
      setIncidentBusy(false);
    }
  };

  const resolveIncident = async ({ resolutionReason }) => {
    if (!resolveTarget) return;

    setResolveBusy(true);
    try {
      await adminRepository.resolveDeliveryIncident({
        incidentId: resolveTarget.incident.id,
        resolutionReason,
        actor: session,
      });
      notify({
        title: 'Incidencia resuelta',
        description: `${resolveTarget.delivery.orderNumber} · ${resolveTarget.incident.typeLabel}`,
      });
      const deliveryId = resolveTarget.delivery.id;
      setResolveTarget(null);
      await Promise.all([refresh(), refreshDetail(deliveryId)]);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo resolver la incidencia', description: error.message });
    } finally {
      setResolveBusy(false);
    }
  };

  const previewEvidence = async (evidence) => {
    try {
      const url = await adminRepository.getDeliveryEvidenceSignedUrl({
        evidenceId: evidence.id,
        actor: session,
      });
      if (url) window.open(url, '_blank', 'noopener');
    } catch (error) {
      notify({ tone: 'error', title: 'Vista previa no disponible', description: error.message });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operaciones"
        title="Entregas"
        description="Seguimiento logístico, incidencias y evidencia de entrega. La confirmación de recepción está separada del avance de estado."
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Entregas de demostración">
          Las entregas, incidencias y evidencias de esta pantalla son ejemplos guardados en este
          navegador. La evidencia son solo metadatos: no hay archivos reales.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando entregas…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar las entregas">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Truck className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
              Entregas
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
                  placeholder="Buscar pedido, comprador o seguimiento…"
                  aria-label="Buscar entregas"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filtrar entregas por estado"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todos los estados</option>
                {DELIVERY_STATUS_OPTIONS.map((option) => (
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
                    <th scope="col" className="px-5 py-2.5 font-semibold">Entrega</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Comercio</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Seguimiento</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Incidencias</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Actualizada</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((delivery) => {
                    const actions = buildActions(delivery, hasPermission);

                    return (
                      <tr key={delivery.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => openDetail(delivery)}
                            className="block text-left text-sm font-semibold text-slate-900 hover:text-[#4B227A] hover:underline"
                          >
                            {delivery.orderNumber || delivery.id}
                          </button>
                          <p className="truncate text-xs text-slate-500">
                            {delivery.buyerName || '—'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {delivery.commerceName || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          <p>{delivery.carrier || 'Sin transportista'}</p>
                          <p className="text-xs text-slate-500">{delivery.trackingCode || '—'}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={delivery.status} />
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {delivery.incidentCount} total · {delivery.openIncidentCount} abiertas
                        </td>
                        <td
                          className="px-5 py-3.5 text-sm text-slate-600"
                          title={formatDateTime(delivery.updatedAt)}
                        >
                          {formatRelative(delivery.updatedAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetail(delivery)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              Ficha
                            </button>
                            {canUpdate ? (
                              <button
                                type="button"
                                onClick={() => setIncidentTarget(delivery)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                              >
                                <FileWarning className="h-3.5 w-3.5" aria-hidden="true" />
                                Incidencia
                              </button>
                            ) : null}
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
                                  onClick={() => setActionTarget({ ...action, delivery })}
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
                Icon={Truck}
                title="Sin entregas para este filtro"
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
          <li>Actualizar el seguimiento o registrar incidencias exige <code className="font-mono">deliveries.update</code>.</li>
          <li>Confirmar la recepción exige <code className="font-mono">deliveries.confirm</code>.</li>
          <li>Las transiciones se validan en el servidor, no solo en la interfaz.</li>
          <li>La evidencia real requiere almacenamiento privado; en demostración solo hay metadatos.</li>
        </ul>
      </div>

      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Ficha de la entrega"
        description="Seguimiento, incidencias y evidencia registrada."
        size="lg"
      >
        {detailTarget ? (
          <DeliveryDetail
            delivery={detailTarget}
            mode={mode}
            canUpdate={canUpdate}
            onReportIncident={() => setIncidentTarget(detailTarget)}
            onResolveIncident={(incident) =>
              setResolveTarget({ incident, delivery: detailTarget })
            }
            onPreview={previewEvidence}
          />
        ) : null}
      </Modal>

      <ReasonDialog
        open={Boolean(actionTarget)}
        title={actionTarget?.title || 'Cambiar estado'}
        description={
          actionTarget ? `${actionTarget.delivery.orderNumber}. ${actionTarget.description}` : ''
        }
        reasons={actionTarget?.reasons || []}
        confirmLabel={actionTarget?.label || 'Confirmar'}
        tone={actionTarget?.tone || 'danger'}
        busy={actionBusy}
        onConfirm={confirmAction}
        onClose={() => setActionTarget(null)}
      />

      <IncidentReportDialog
        open={Boolean(incidentTarget)}
        delivery={incidentTarget}
        busy={incidentBusy}
        onConfirm={reportIncident}
        onClose={() => setIncidentTarget(null)}
      />

      <IncidentResolveDialog
        open={Boolean(resolveTarget)}
        incident={resolveTarget?.incident}
        busy={resolveBusy}
        onConfirm={resolveIncident}
        onClose={() => setResolveTarget(null)}
      />
    </div>
  );
}
