import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Eye,
  Landmark,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import KpiCard from '../components/KpiCard';
import Modal from '../components/Modal';
import ReasonDialog from '../components/ReasonDialog';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/useToast';
import { useAdminAuth } from '../auth/useAdminAuth';
import { adminRepository } from '../data';
import {
  PAYMENT_GATEWAY_NOTICE,
  PAYMENT_RECONCILIATION_REASONS,
  PAYMENT_REFUND_NOTICE,
  PAYMENT_SIMULATION_NOTICE,
  PAYMENT_STATUS_OPTIONS,
} from '../constants/phase5';
import { formatCurrency, formatDateTime } from '../utils/format';

function PaymentDetail({ payment }) {
  if (!payment) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={payment.status}>{payment.statusLabel}</StatusBadge>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
            {payment.methodLabel}
          </span>
          {payment.simulated ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              Simulado
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-lg font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {payment.orderNumber || 'Sin pedido'} · {payment.commerceName || 'Comercio no disponible'}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Comprador</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{payment.buyerName || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Proveedor</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{payment.providerLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Comisión</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatCurrency(payment.commissionAmount)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Neto al comercio</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatCurrency(payment.netAmount)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reembolsado</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatCurrency(payment.refundedAmount)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Referencia</dt>
          <dd className="mt-0.5 break-all font-mono text-xs text-slate-600">
            {payment.providerReference || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Creado</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(payment.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cobrado</dt>
          <dd className="mt-0.5 text-sm text-slate-700">
            {payment.paidAt ? formatDateTime(payment.paidAt) : 'No cobrado'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Conciliación</dt>
          <dd className="mt-0.5 text-sm text-slate-700">
            {payment.reconciled
              ? `Conciliado por ${payment.reconciledByName || '—'} · ${formatDateTime(payment.reconciledAt)}`
              : 'Sin conciliar'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado del pedido</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{payment.order?.status || payment.orderStatus || '—'}</dd>
        </div>
      </dl>

      {payment.failureReason ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Observación</p>
          <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
            {payment.failureReason}
          </p>
        </div>
      ) : null}

      {payment.metadata?.refundReason ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Motivo del reembolso
          </p>
          <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
            {payment.metadata.refundReason}
          </p>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Liquidaciones simuladas del comercio
        </p>
        {payment.payouts?.length ? (
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {payment.payouts.map((payout) => (
              <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{formatCurrency(payout.netAmount)}</p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(payout.periodStart)} → {formatDateTime(payout.periodEnd)}
                  </p>
                </div>
                <StatusBadge status={payout.status}>{payout.statusLabel}</StatusBadge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
            No hay liquidaciones registradas para este comercio.
          </p>
        )}
      </div>

      <Alert tone="warning" title="Sin pasarela conectada">
        {PAYMENT_REFUND_NOTICE}
      </Alert>
    </div>
  );
}

export default function Payments() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({
    loading: true,
    error: null,
    payments: [],
    payouts: [],
    metrics: null,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reconciliationFilter, setReconciliationFilter] = useState('all');
  const [detailTarget, setDetailTarget] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [payments, payouts, metrics] = await Promise.all([
        adminRepository.listPayments({ actor: session }),
        adminRepository.listPaymentPayouts({ actor: session }),
        adminRepository.getPaymentMetrics({ actor: session }),
      ]);
      setState({ loading: false, error: null, payments, payouts, metrics });
    } catch (error) {
      setState({ loading: false, error: error.message, payments: [], payouts: [], metrics: null });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [payments, payouts, metrics] = await Promise.all([
          adminRepository.listPayments({ actor: session }),
          adminRepository.listPaymentPayouts({ actor: session }),
          adminRepository.getPaymentMetrics({ actor: session }),
        ]);
        if (!cancelled) setState({ loading: false, error: null, payments, payouts, metrics });
      } catch (error) {
        if (!cancelled) {
          setState({ loading: false, error: error.message, payments: [], payouts: [], metrics: null });
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.payments.filter((payment) => {
      if (statusFilter !== 'all' && payment.status !== statusFilter) return false;
      if (reconciliationFilter === 'unreconciled' && !(payment.reconcilable && !payment.reconciled)) {
        return false;
      }
      if (reconciliationFilter === 'reconciled' && !payment.reconciled) return false;
      if (!term) return true;
      return [
        payment.orderNumber,
        payment.buyerName,
        payment.commerceName,
        payment.providerReference,
        payment.statusLabel,
        payment.methodLabel,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.payments, search, statusFilter, reconciliationFilter]);

  const openDetail = async (payment) => {
    setDetailLoading(true);
    setDetailTarget(payment);
    try {
      const detail = await adminRepository.getPayment({ paymentId: payment.id, actor: session });
      setDetailTarget(detail);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cargar el pago', description: error.message });
    } finally {
      setDetailLoading(false);
    }
  };

  const startReconcile = (payment) => {
    setActionTarget({
      payment,
      reconciled: !payment.reconciled,
    });
  };

  const confirmReconcile = async ({ reason, detail }) => {
    if (!actionTarget) return;

    const label = PAYMENT_RECONCILIATION_REASONS.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setActionBusy(true);
    try {
      await adminRepository.reconcilePayment({
        paymentId: actionTarget.payment.id,
        reconciled: actionTarget.reconciled,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: actionTarget.reconciled ? 'Pago conciliado' : 'Conciliación retirada',
        description: `${actionTarget.payment.orderNumber || actionTarget.payment.id} · ${label}`,
      });
      setActionTarget(null);
      setDetailTarget(null);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo conciliar el pago', description: error.message });
    } finally {
      setActionBusy(false);
    }
  };

  const metrics = state.metrics || {};

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operaciones"
        title="Pagos"
        description="Libro interno de movimientos y liquidaciones simuladas. No hay pasarela conectada: desde aquí no se cobra, no se reembolsa y no se transfiere dinero."
        actions={
          <button
            type="button"
            onClick={refresh}
            disabled={state.loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Actualizar
          </button>
        }
      />

      <Alert tone="warning" title="Sin pasarela de pagos">
        {PAYMENT_GATEWAY_NOTICE}
      </Alert>

      {mode === 'demo' ? (
        <Alert tone="warning" title="Pagos de demostración">
          {PAYMENT_SIMULATION_NOTICE}
        </Alert>
      ) : (
        <Alert tone="info" title="Libro interno del servidor">
          Los movimientos provienen de las RPC de InsForge. Mientras no exista una pasarela, el
          estado solo refleja registros internos y conciliaciones manuales.
        </Alert>
      )}

      {state.loading ? <Spinner label="Cargando pagos…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar los pagos">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Cobrado registrado"
              value={formatCurrency(metrics.grossCollected)}
              hint={`${metrics.totalPayments || 0} movimiento(s) en el libro`}
              Icon={Wallet}
              tone="accent"
            />
            <KpiCard
              label="Comisión estimada"
              value={formatCurrency(metrics.commissionRevenue)}
              hint={`Neto a comercios: ${formatCurrency(metrics.netToCommerces)}`}
              Icon={Scale}
            />
            <KpiCard
              label="Reembolsos registrados"
              value={formatCurrency(metrics.refundedAmount)}
              hint={`${metrics.refundedPayments || 0} movimiento(s) con reembolso`}
              Icon={CreditCard}
            />
            <KpiCard
              label="Sin conciliar"
              value={metrics.unreconciledPayments || 0}
              hint={`${metrics.pendingPayouts || 0} liquidación(es) simulada(s) pendiente(s)`}
              Icon={ShieldCheck}
              tone={metrics.unreconciledPayments ? 'warning' : 'default'}
            />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Landmark className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
                Movimientos internos
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
                    placeholder="Buscar pedido, comercio o referencia…"
                    aria-label="Buscar pagos"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filtrar por estado del pago"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
                >
                  <option value="all">Todos los estados</option>
                  {PAYMENT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={reconciliationFilter}
                  onChange={(event) => setReconciliationFilter(event.target.value)}
                  aria-label="Filtrar por conciliación"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
                >
                  <option value="all">Toda conciliación</option>
                  <option value="unreconciled">Sin conciliar</option>
                  <option value="reconciled">Conciliados</option>
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
                      <th scope="col" className="px-5 py-2.5 font-semibold">Método</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Importe</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Comisión</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Conciliación</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Creado</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((payment) => (
                      <tr key={payment.id} className="border-b border-slate-100 align-top last:border-0">
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-slate-800">{payment.orderNumber || '—'}</p>
                          <p className="text-xs text-slate-400">{payment.buyerName || '—'}</p>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700">{payment.commerceName || '—'}</td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-slate-700">{payment.methodLabel}</p>
                          <p className="text-xs text-slate-400">{payment.providerLabel}</p>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={payment.status}>{payment.statusLabel}</StatusBadge>
                          {payment.simulated ? (
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                              Simulado
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-slate-800">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {formatCurrency(payment.commissionAmount)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                              payment.reconciled
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                : 'bg-amber-50 text-amber-700 ring-amber-200'
                            }`}
                          >
                            {payment.reconciled ? 'Conciliado' : 'Sin conciliar'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">
                          {formatDateTime(payment.createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetail(payment)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              Ver
                            </button>
                            {hasPermission('payments.reconcile') && payment.reconcilable ? (
                              <button
                                type="button"
                                onClick={() => startReconcile(payment)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#4B227A]/20 bg-[#4B227A]/5 px-2.5 py-1.5 text-xs font-semibold text-[#4B227A] transition hover:bg-[#4B227A]/10"
                              >
                                {payment.reconciled ? (
                                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                {payment.reconciled ? 'Quitar' : 'Conciliar'}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  Icon={CreditCard}
                  title="Sin movimientos que mostrar"
                  description="Ajusta los filtros o el término de búsqueda para ver otros movimientos internos."
                />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-sm font-semibold text-slate-900">Liquidaciones a comercios</p>
              <p className="text-xs text-slate-500">
                Estimaciones internas simuladas. No representan transferencias reales.
              </p>
            </div>

            {state.payouts.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                      <th scope="col" className="px-5 py-2.5 font-semibold">Comercio</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Periodo</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Bruto</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Comisión</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Neto</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.payouts.map((payout) => (
                      <tr key={payout.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-3 text-sm font-medium text-slate-800">
                          {payout.commerceName || '—'}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {formatDateTime(payout.periodStart)} → {formatDateTime(payout.periodEnd)}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">{formatCurrency(payout.grossAmount)}</td>
                        <td className="px-5 py-3 text-sm text-slate-600">{formatCurrency(payout.commissionAmount)}</td>
                        <td className="px-5 py-3 text-sm font-semibold text-slate-800">
                          {formatCurrency(payout.netAmount)}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={payout.status}>{payout.statusLabel}</StatusBadge>
                          {payout.simulated ? (
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                              Simulada
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  Icon={Landmark}
                  title="Sin liquidaciones"
                  description="No hay liquidaciones registradas en este momento."
                />
              </div>
            )}
          </section>

          {hasPermission('payments.refund') ? (
            <Alert tone="warning" title="Reembolsos no disponibles">
              Tu rol puede solicitar reembolsos en la política, pero esta fase no ejecuta reembolsos
              porque no hay pasarela conectada. {PAYMENT_REFUND_NOTICE}
            </Alert>
          ) : null}
        </>
      ) : null}

      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Detalle del movimiento"
        description="Libro interno de pagos. Sin pasarela conectada."
        size="lg"
        footer={
          actionTarget ? null : (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cerrar
              </button>
              {detailTarget && hasPermission('payments.reconcile') && detailTarget.reconcilable ? (
                <button
                  type="button"
                  onClick={() => startReconcile(detailTarget)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E]"
                >
                  {detailTarget.reconciled ? (
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {detailTarget.reconciled ? 'Quitar conciliación' : 'Conciliar manualmente'}
                </button>
              ) : null}
            </div>
          )
        }
      >
        {detailLoading ? <Spinner label="Cargando detalle…" /> : <PaymentDetail payment={detailTarget} />}
      </Modal>

      <ReasonDialog
        open={Boolean(actionTarget)}
        title={actionTarget?.reconciled ? 'Conciliar pago' : 'Retirar conciliación'}
        description="La conciliación es un registro interno y queda auditada. No mueve dinero ni ejecuta reembolsos."
        reasons={PAYMENT_RECONCILIATION_REASONS}
        confirmLabel={actionTarget?.reconciled ? 'Conciliar' : 'Retirar conciliación'}
        tone="primary"
        busy={actionBusy}
        onConfirm={confirmReconcile}
        onClose={() => setActionTarget(null)}
      />
    </div>
  );
}
