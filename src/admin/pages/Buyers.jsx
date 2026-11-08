import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  LockKeyhole,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
  Users,
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
import { BUYER_ACTION_REASONS, BUYER_STATUS_OPTIONS } from '../constants/phase2';
import { formatDate, formatDateTime, formatRelative, initials } from '../utils/format';

function actionsForBuyer(buyer, hasPermission) {
  const actions = [];

  if (buyer.status === 'blocked') {
    actions.push({
      key: 'unblock',
      label: 'Desbloquear',
      nextStatus: 'active',
      permission: 'users.block',
      tone: 'primary',
      reasons: BUYER_ACTION_REASONS.unblock,
      title: 'Desbloquear comprador',
      description: 'El comprador podrá volver a operar. La acción requiere motivo y queda auditada.',
      successTitle: 'Comprador desbloqueado',
    });
  } else {
    if (buyer.status === 'suspended' || buyer.status === 'limited') {
      actions.push({
        key: 'reactivate',
        label: 'Reactivar',
        nextStatus: 'active',
        permission: 'users.suspend',
        tone: 'primary',
        reasons: BUYER_ACTION_REASONS.reactivate,
        title: 'Reactivar comprador',
        description: 'La cuenta volverá al estado activo. La acción requiere motivo y queda auditada.',
        successTitle: 'Comprador reactivado',
      });
    } else {
      actions.push({
        key: 'suspend',
        label: 'Suspender',
        nextStatus: 'suspended',
        permission: 'users.suspend',
        tone: 'danger',
        reasons: BUYER_ACTION_REASONS.suspend,
        title: 'Suspender comprador',
        description: 'La cuenta quedará suspendida temporalmente. La acción requiere motivo y queda auditada.',
        successTitle: 'Comprador suspendido',
      });
    }

    actions.push({
      key: 'block',
      label: 'Bloquear',
      nextStatus: 'blocked',
      permission: 'users.block',
      tone: 'danger',
      reasons: BUYER_ACTION_REASONS.block,
      title: 'Bloquear comprador',
      description: 'El bloqueo impide operar en la plataforma. La acción requiere motivo y queda auditada.',
      successTitle: 'Comprador bloqueado',
    });
  }

  return actions.filter((action) => hasPermission(action.permission));
}

function BuyerDetail({ buyer, canViewPii }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4B227A]/10 text-sm font-bold text-[#4B227A]">
          {initials(buyer.name)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{buyer.name}</p>
          <p className="text-xs text-slate-500">{buyer.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={buyer.status} />
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
              {buyer.piiMasked ? 'Datos personales enmascarados' : 'Datos personales completos'}
            </span>
          </div>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Teléfono</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{buyer.phone || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Alta</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDate(buyer.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Última actividad</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatRelative(buyer.lastActivityAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cambio de estado</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(buyer.statusChangedAt)}</dd>
        </div>
      </dl>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Motivo del estado</p>
        <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
          {buyer.statusReason || 'Sin motivo registrado.'}
        </p>
      </div>

      {!canViewPii ? (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Tu rol no incluye <code className="font-mono">users.view_pii</code>. El correo y el
          teléfono se muestran enmascarados desde el origen de datos.
        </div>
      ) : null}
    </div>
  );
}

export default function Buyers() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({ loading: true, error: null, buyers: [] });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailTarget, setDetailTarget] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const canViewPii = hasPermission('users.view_pii');

  const refresh = useCallback(async () => {
    try {
      const buyers = await adminRepository.listBuyers({ actor: session });
      setState({ loading: false, error: null, buyers });
    } catch (error) {
      setState({ loading: false, error: error.message, buyers: [] });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const buyers = await adminRepository.listBuyers({ actor: session });
        if (!cancelled) setState({ loading: false, error: null, buyers });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, buyers: [] });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.buyers.filter((buyer) => {
      if (statusFilter !== 'all' && buyer.status !== statusFilter) return false;
      if (!term) return true;
      return [buyer.name, buyer.email, buyer.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.buyers, search, statusFilter]);

  const confirmAction = async ({ reason, detail }) => {
    if (!actionTarget) return;

    const label = actionTarget.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setActionBusy(true);
    try {
      await adminRepository.setBuyerStatus({
        buyerId: actionTarget.buyer.id,
        status: actionTarget.nextStatus,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: actionTarget.successTitle,
        description: `${actionTarget.buyer.name} · ${actionTarget.buyer.email}`,
      });
      setActionTarget(null);
      setDetailTarget(null);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cambiar el estado', description: error.message });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Personas"
        title="Compradores"
        description="Consulta la cuenta de cada comprador, su estado y actividad. Los datos personales se enmascaran en el servidor salvo que tu rol tenga el permiso correspondiente."
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Compradores de demostración">
          Los compradores, estados y cambios de esta pantalla son ejemplos guardados en este
          navegador. El enmascarado se aplica localmente para reproducir la política del servidor,
          pero aquí no protege datos reales.
        </Alert>
      ) : null}

      {!canViewPii ? (
        <Alert tone="info" title="Datos personales enmascarados">
          Tu rol incluye <code className="font-mono text-xs">users.view</code> pero no{' '}
          <code className="font-mono text-xs">users.view_pii</code>. Por eso el correo y el
          teléfono se muestran parcialmente ocultos.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando compradores…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar los compradores">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Users className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
              Directorio
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
                  placeholder="Buscar nombre, correo o teléfono…"
                  aria-label="Buscar compradores"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filtrar compradores por estado"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todos los estados</option>
                {BUYER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Comprador</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Teléfono</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Alta</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Última actividad</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((buyer) => {
                    const actions = actionsForBuyer(buyer, hasPermission);

                    return (
                      <tr key={buyer.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4B227A]/10 text-xs font-bold text-[#4B227A]">
                              {initials(buyer.name)}
                            </span>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setDetailTarget(buyer)}
                                className="truncate text-left text-sm font-semibold text-slate-900 hover:text-[#4B227A] hover:underline"
                              >
                                {buyer.name}
                              </button>
                              <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                                {buyer.piiMasked ? (
                                  <LockKeyhole className="h-3 w-3 shrink-0" aria-hidden="true" />
                                ) : null}
                                {buyer.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{buyer.phone || '—'}</td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={buyer.status} />
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{formatDate(buyer.createdAt)}</td>
                        <td
                          className="px-5 py-3.5 text-sm text-slate-600"
                          title={formatDateTime(buyer.lastActivityAt)}
                        >
                          {formatRelative(buyer.lastActivityAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailTarget(buyer)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                              Ficha
                            </button>
                            {actions.map((action) => {
                              const Icon = action.key === 'block' ? ShieldAlert : action.key === 'unblock' ? BadgeCheck : action.key === 'suspend' ? UserX : UserCheck;
                              const toneClasses =
                                action.tone === 'danger'
                                  ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100';

                              return (
                                <button
                                  key={action.key}
                                  type="button"
                                  onClick={() => setActionTarget({ ...action, buyer })}
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
                Icon={Users}
                title="Sin compradores para este filtro"
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
          <li>Suspender y reactivar exigen <code className="font-mono">users.suspend</code>.</li>
          <li>Bloquear y desbloquear exigen <code className="font-mono">users.block</code>.</li>
          <li>Toda acción exige motivo y genera un evento de auditoría.</li>
          <li>La anonimización o eliminación (<code className="font-mono">users.delete</code>) no forma parte de esta fase.</li>
        </ul>
      </div>

      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Ficha del comprador"
        description="Datos de contacto, estado y actividad registrada."
        size="md"
      >
        {detailTarget ? <BuyerDetail buyer={detailTarget} canViewPii={canViewPii} /> : null}
      </Modal>

      <ReasonDialog
        open={Boolean(actionTarget)}
        title={actionTarget?.title || 'Cambiar estado'}
        description={
          actionTarget
            ? `${actionTarget.buyer.name} · ${actionTarget.buyer.email}. ${actionTarget.description}`
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
