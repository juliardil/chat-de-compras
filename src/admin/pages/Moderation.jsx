import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Search, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
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
  MODERATION_ACTION_REASONS,
  MODERATION_REPORT_TYPES,
  MODERATION_STATUS_OPTIONS,
  MODERATION_TRANSITIONS,
  moderationActionKey,
  moderationActionLabel,
  moderationActionPermission,
} from '../constants/phase4';
import { formatDateTime, formatRelative } from '../utils/format';

const ACTION_ICONS = {
  assign: UserCheck,
  resolve: ShieldCheck,
  dismiss: ShieldAlert,
};

function buildActions(report, hasPermission) {
  return (MODERATION_TRANSITIONS[report.status] || [])
    .map((to) => {
      const key = moderationActionKey(report.status, to);
      return {
        key: `${report.status}-${to}`,
        to,
        label: moderationActionLabel(report.status, to),
        permission: moderationActionPermission(to),
        tone: to === 'in_review' ? 'primary' : 'danger',
        reasons: MODERATION_ACTION_REASONS[key] || [],
        title: `${moderationActionLabel(report.status, to)} · ${report.subject}`,
        description: 'La acción exige un motivo y queda registrada en la auditoría.',
        successTitle: 'Reporte actualizado',
        Icon: ACTION_ICONS[key] || ShieldAlert,
      };
    })
    .filter((action) => hasPermission(action.permission));
}

function ReportDetail({ report }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={report.status} />
          <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
            {report.typeLabel}
          </span>
          <span className="text-xs font-semibold text-slate-500">
            Prioridad {report.priorityLabel}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">{report.subject}</p>
        <p className="mt-1 text-xs text-slate-500">{report.entityLabel}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Descripción</p>
        <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
          {report.description}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reportado por</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{report.reporterName || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Creado</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(report.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Asignado a</dt>
          <dd className="mt-0.5 text-sm text-slate-700">
            {report.assignedToName || 'Sin asignar'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Actualizado</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatRelative(report.updatedAt)}</dd>
        </div>
      </dl>

      {report.resolutionReason ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-800">
          Resuelto por {report.resolvedByName || 'administración'} el{' '}
          {formatDateTime(report.resolvedAt)}: {report.resolutionReason}
        </div>
      ) : null}
    </div>
  );
}

export default function Moderation() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({ loading: true, error: null, reports: [] });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [detailTarget, setDetailTarget] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const reports = await adminRepository.listModerationReports({ actor: session });
      setState({ loading: false, error: null, reports });
    } catch (error) {
      setState({ loading: false, error: error.message, reports: [] });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const reports = await adminRepository.listModerationReports({ actor: session });
        if (!cancelled) setState({ loading: false, error: null, reports });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, reports: [] });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.reports.filter((report) => {
      if (statusFilter !== 'all' && report.status !== statusFilter) return false;
      if (typeFilter !== 'all' && report.reportType !== typeFilter) return false;
      if (!term) return true;
      return [report.subject, report.entityLabel, report.reporterName, report.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.reports, search, statusFilter, typeFilter]);

  const openDetail = async (report) => {
    setDetailTarget(report);
    try {
      const detail = await adminRepository.getModerationReport({
        reportId: report.id,
        actor: session,
      });
      setDetailTarget(detail);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cargar el reporte', description: error.message });
    }
  };

  const confirmAction = async ({ reason, detail }) => {
    if (!actionTarget) return;

    const label = actionTarget.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setActionBusy(true);
    try {
      await adminRepository.updateModerationReport({
        reportId: actionTarget.report.id,
        status: actionTarget.to,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: actionTarget.successTitle,
        description: `${actionTarget.report.subject} · ${label}`,
      });
      setActionTarget(null);
      setDetailTarget(null);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo actualizar el reporte', description: error.message });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Confianza"
        title="Moderación"
        description="Gestiona los reportes de la comunidad: asigna, revisa, resuelve o descarta con un motivo auditado."
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Reportes de demostración">
          Los reportes, entidades y resoluciones son ejemplos guardados en este navegador. Las
          transiciones y permisos se aplican localmente para reproducir el servidor, pero no hay
          datos reales.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando reportes…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar los reportes">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldAlert className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
              Bandeja de moderación
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
                  placeholder="Buscar asunto, entidad o reportante…"
                  aria-label="Buscar reportes"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filtrar reportes por estado"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todos los estados</option>
                {MODERATION_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Filtrar reportes por tipo"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todos los tipos</option>
                {MODERATION_REPORT_TYPES.map((option) => (
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
                    <th scope="col" className="px-5 py-2.5 font-semibold">Reporte</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Tipo</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Prioridad</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Reportado por</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Asignado</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Creado</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((report) => {
                    const actions = buildActions(report, hasPermission);

                    return (
                      <tr key={report.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => openDetail(report)}
                            className="block max-w-xs truncate text-left text-sm font-semibold text-slate-900 hover:text-[#4B227A] hover:underline"
                          >
                            {report.subject}
                          </button>
                          <p className="truncate text-xs text-slate-500">{report.entityLabel}</p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{report.typeLabel}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{report.priorityLabel}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {report.reporterName || '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={report.status} />
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {report.assignedToName || 'Sin asignar'}
                          {report.assignedToMe ? (
                            <span className="ml-1 text-xs font-semibold text-[#006E7A]">(tú)</span>
                          ) : null}
                        </td>
                        <td
                          className="px-5 py-3.5 text-sm text-slate-600"
                          title={formatDateTime(report.createdAt)}
                        >
                          {formatRelative(report.createdAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetail(report)}
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
                                  onClick={() => setActionTarget({ ...action, report })}
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
                Icon={ShieldAlert}
                title="Sin reportes para este filtro"
                description="Prueba con otro estado, otro tipo o limpia la búsqueda."
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
          <li>Ver reportes exige <code className="font-mono">moderation.view</code>.</li>
          <li>Asignarse un reporte exige <code className="font-mono">moderation.assign</code>.</li>
          <li>Resolver o descartar exige <code className="font-mono">moderation.resolve</code>.</li>
          <li>Toda acción exige motivo y genera un evento de auditoría.</li>
        </ul>
      </div>

      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Ficha del reporte"
        description="Contexto, prioridad, asignación y resolución."
        size="lg"
      >
        {detailTarget ? <ReportDetail report={detailTarget} /> : null}
      </Modal>

      <ReasonDialog
        open={Boolean(actionTarget)}
        title={actionTarget?.title || 'Actualizar reporte'}
        description={actionTarget ? `${actionTarget.report.subject}. ${actionTarget.description}` : ''}
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
