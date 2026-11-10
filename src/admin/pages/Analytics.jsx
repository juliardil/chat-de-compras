import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CreditCard,
  Download,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import KpiCard from '../components/KpiCard';
import { useToast } from '../components/useToast';
import { useAdminAuth } from '../auth/useAdminAuth';
import { adminRepository } from '../data';
import {
  ANALYTICS_EXPORT_NOTICE,
  ANALYTICS_RANGES,
  DEFAULT_ANALYTICS_RANGE,
  analyticsRangeLabel,
} from '../constants/phase5';
import { downloadCsv } from '../utils/csv';
import { formatCurrency, formatDate, formatDateTime, formatPercent } from '../utils/format';

function DailySeries({ series }) {
  const max = Math.max(...series.map((day) => Number(day.gmv) || 0), 0);

  if (!max) {
    return (
      <EmptyState
        Icon={BarChart3}
        title="Sin cobros en este periodo"
        description="La serie diaria se llenará cuando existan pagos cobrados dentro del rango seleccionado."
      />
    );
  }

  return (
    <div className="flex h-48 items-end gap-1 overflow-x-auto pb-1">
      {series.map((day) => {
        const height = Math.max((Number(day.gmv) || 0) / max, 0.02) * 100;
        return (
          <div
            key={day.date}
            className="flex h-full min-w-[14px] flex-1 flex-col items-center justify-end gap-1"
            title={`${formatDate(day.date)} · ${formatCurrency(day.gmv)} · ${day.payments} pago(s)`}
          >
            <span
              className={`w-full rounded-t-md ${day.gmv ? 'bg-[#006E7A]' : 'bg-slate-100'}`}
              style={{ height: `${height}%` }}
              aria-hidden="true"
            />
            <span className="text-[9px] tabular-nums text-slate-400">{day.date.slice(8, 10)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Analytics() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [range, setRange] = useState(DEFAULT_ANALYTICS_RANGE);
  const [state, setState] = useState({ loading: true, error: null, analytics: null });
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(
    async (nextRange = range) => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const analytics = await adminRepository.getAnalytics({ range: nextRange, actor: session });
        setState({ loading: false, error: null, analytics });
      } catch (error) {
        setState({ loading: false, error: error.message, analytics: null });
      }
    },
    [range, session]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const analytics = await adminRepository.getAnalytics({ range, actor: session });
        if (!cancelled) setState({ loading: false, error: null, analytics });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, analytics: null });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [range, session]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await adminRepository.exportAnalytics({ range, actor: session });
      const downloaded = downloadCsv(result.filename, result.csv);
      notify({
        title: 'Exportación generada',
        description: downloaded
          ? `${result.filename} · ${result.rangeLabel}`
          : 'El navegador no permitió descargar el archivo. Copia los datos desde la tabla.',
      });
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo exportar la analítica', description: error.message });
    } finally {
      setExporting(false);
    }
  };

  const analytics = state.analytics;
  const summary = analytics?.summary || {};
  const series = useMemo(() => analytics?.series || [], [analytics]);
  const topCommerces = analytics?.topCommerces || [];
  const methodMix = analytics?.methodMix || [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Crecimiento"
        title="Analítica"
        description="Métricas agregadas de pedidos, cobros y comisiones. Los informes no incluyen datos personales y cada exportación queda registrada en la auditoría."
        actions={
          <>
            <label className="sr-only" htmlFor="analytics-range">
              Periodo de analítica
            </label>
            <select
              id="analytics-range"
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
            >
              {ANALYTICS_RANGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => refresh()}
              disabled={state.loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Actualizar
            </button>
            {hasPermission('analytics.export') ? (
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || state.loading || Boolean(state.error)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {exporting ? 'Exportando…' : 'Exportar CSV'}
              </button>
            ) : null}
          </>
        }
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Analítica de demostración">
          Los números se calculan sobre pedidos y pagos simulados guardados en este navegador. No
          representan ingresos reales ni sustituyen los rollups del servidor.
        </Alert>
      ) : (
        <Alert tone="info" title="Analítica del servidor">
          Los datos provienen de las RPC de agregación de InsForge. Las exportaciones y los datos
          personales siguen sujetos a permisos del servidor.
        </Alert>
      )}

      <Alert tone="info" title="Informes sin datos personales">
        {ANALYTICS_EXPORT_NOTICE}
      </Alert>

      {state.loading ? <Spinner label="Calculando analítica…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudo cargar la analítica">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error && analytics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="GMV cobrado"
              value={formatCurrency(summary.gmv)}
              hint={`${summary.collectedPayments} pago(s) cobrado(s) de ${summary.payments} registrado(s)`}
              Icon={Wallet}
              tone="accent"
            />
            <KpiCard
              label="Comisión estimada"
              value={formatCurrency(summary.commissionRevenue)}
              hint={`Neto a comercios: ${formatCurrency(summary.netToCommerces)}`}
              Icon={TrendingUp}
            />
            <KpiCard
              label="Pedidos"
              value={summary.orders}
              hint={`Ticket promedio: ${formatCurrency(summary.averageOrderValue)}`}
              Icon={ShoppingCart}
            />
            <KpiCard
              label="Reembolsos registrados"
              value={formatCurrency(summary.refundedAmount)}
              hint={`${summary.unreconciledPayments} pago(s) sin conciliar`}
              Icon={CreditCard}
              tone={summary.unreconciledPayments ? 'warning' : 'default'}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Pedidos completados" value={summary.completedOrders} hint="Dentro del periodo" />
            <KpiCard label="Pedidos en disputa" value={summary.disputedOrders} hint="Dentro del periodo" />
            <KpiCard label="Pedidos cancelados" value={summary.cancelledOrders} hint="Dentro del periodo" />
            <KpiCard
              label="Periodo"
              value={`${analytics.rangeDays} días`}
              hint={`${formatDate(analytics.periodStart)} → ${formatDate(analytics.periodEnd)}`}
            />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Serie diaria de cobros</p>
                <p className="text-xs text-slate-500">
                  {analyticsRangeLabel(range)} · barras relativas al máximo del periodo
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Actualizado {formatDateTime(analytics.generatedAt)}
              </p>
            </div>
            <div className="px-5 py-5">
              <DailySeries series={series} />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-sm font-semibold text-slate-900">Comercios con más cobros</p>
                <p className="text-xs text-slate-500">Solo datos agregados por comercio.</p>
              </div>

              {topCommerces.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                        <th scope="col" className="px-5 py-2.5 font-semibold">Comercio</th>
                        <th scope="col" className="px-5 py-2.5 font-semibold">GMV</th>
                        <th scope="col" className="px-5 py-2.5 font-semibold">Participación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCommerces.map((commerce) => (
                        <tr key={commerce.commerceId} className="border-b border-slate-100 last:border-0">
                          <td className="px-5 py-3">
                            <p className="text-sm font-medium text-slate-800">{commerce.commerceName}</p>
                            <p className="text-xs text-slate-400">{commerce.payments} pago(s)</p>
                          </td>
                          <td className="px-5 py-3 text-sm font-semibold text-slate-700">
                            {formatCurrency(commerce.gmv)}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-[#006E7A]"
                                  style={{ width: `${Math.min(commerce.share, 100)}%` }}
                                  aria-hidden="true"
                                />
                              </div>
                              <span className="text-xs tabular-nums text-slate-500">
                                {formatPercent(commerce.share)}
                              </span>
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
                    Icon={BarChart3}
                    title="Sin cobros por comercio"
                    description="No hay pagos cobrados dentro del periodo seleccionado."
                  />
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-sm font-semibold text-slate-900">Métodos de pago</p>
                <p className="text-xs text-slate-500">Distribución del GMV cobrado registrado.</p>
              </div>

              {methodMix.length ? (
                <ul className="divide-y divide-slate-100">
                  {methodMix.map((method) => (
                    <li key={method.method} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{method.label}</p>
                        <p className="text-xs text-slate-400">{formatCurrency(method.amount)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#4B227A]"
                            style={{ width: `${Math.min(method.share, 100)}%` }}
                            aria-hidden="true"
                          />
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-slate-500">
                          {formatPercent(method.share)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-5">
                  <EmptyState
                    Icon={CreditCard}
                    title="Sin métodos de pago"
                    description="Aún no hay cobros registrados en el periodo."
                  />
                </div>
              )}
            </section>
          </div>

          {analytics.piiIncluded ? (
            <Alert tone="warning" title="El informe incluye datos personales">
              Este informe incorpora información personal y debe tratarse según la política de
              privacidad.
            </Alert>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
