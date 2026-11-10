import { useEffect, useMemo, useState } from 'react';
import { Download, ScrollText, Search, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/useToast';
import { useAdminAuth } from '../auth/useAdminAuth';
import { adminRepository } from '../data';
import { downloadCsv } from '../utils/csv';
import { formatDateTime, truncateId } from '../utils/format';

const ACTION_LABELS = {
  'auth.login': 'Inicio de sesión',
  'auth.logout': 'Cierre de sesión',
  'staff.invite': 'Invitación registrada',
  'staff.suspend': 'Cuenta suspendida',
  'staff.reactivate': 'Cuenta reactivada',
  'buyer.suspend': 'Comprador suspendido',
  'buyer.reactivate': 'Comprador reactivado',
  'buyer.block': 'Comprador bloqueado',
  'buyer.unblock': 'Comprador desbloqueado',
  'buyer.limit': 'Comprador limitado',
  'commerce.review': 'Comercio en revisión',
  'commerce.approve': 'Comercio aprobado',
  'commerce.reject': 'Comercio rechazado',
  'commerce.suspend': 'Comercio suspendido',
  'commerce.reactivate': 'Comercio reactivado',
  'commerce.document.verify': 'Documento verificado',
  'commerce.document.reject': 'Documento rechazado',
  'catalog.create': 'Categoría creada',
  'catalog.update': 'Categoría editada',
  'catalog.activate': 'Categoría activada',
  'catalog.deactivate': 'Categoría desactivada',
  'request.hide': 'Solicitud ocultada',
  'request.restore': 'Solicitud restaurada',
  'request.close': 'Solicitud cerrada',
  'request.cancel': 'Solicitud cancelada',
  'offer.flag': 'Oferta marcada como irregular',
  'offer.unflag': 'Marca de oferta retirada',
  'offer.withdraw_admin': 'Oferta retirada por administración',
  'order.transition': 'Pedido actualizado',
  'order.cancel': 'Pedido cancelado',
  'order.dispute': 'Disputa abierta',
  'order.resolve_dispute': 'Disputa resuelta',
  'delivery.update': 'Entrega actualizada',
  'delivery.confirm': 'Recepción de entrega confirmada',
  'delivery.incident': 'Incidencia de entrega registrada',
  'delivery.incident.resolve': 'Incidencia de entrega resuelta',
  'chat.access.request': 'Acceso a chat solicitado',
  'chat.access.approved': 'Acceso a chat aprobado',
  'chat.access.denied': 'Acceso a chat denegado',
  'chat.access.revoked': 'Acceso a chat revocado',
  'chat.content.read': 'Contenido de chat leído (auditado)',
  'moderation.assign': 'Reporte de moderación asignado',
  'moderation.resolve': 'Reporte de moderación resuelto',
  'moderation.dismiss': 'Reporte de moderación descartado',
  'review.hide': 'Reseña oculta',
  'review.restore': 'Reseña restaurada',
  'review.flag': 'Reseña marcada',
  'review.publish': 'Reseña publicada',
  'support.assign': 'Ticket de soporte asignado',
  'support.reply': 'Ticket de soporte respondido',
  'support.resolve': 'Ticket de soporte resuelto',
  'support.close': 'Ticket de soporte cerrado',
  'support.reopen': 'Ticket de soporte reabierto',
  'support.status': 'Estado de ticket actualizado',
  'communications.template.active': 'Plantilla de comunicación activada',
  'communications.template.archived': 'Plantilla de comunicación archivada',
  'communications.template.draft': 'Plantilla devuelta a borrador',
  'communications.campaign.create': 'Campaña de comunicación creada',
  'communications.campaign.queue': 'Campaña en cola simulada',
  'communications.campaign.send': 'Campaña marcada como enviada (simulada)',
  'communications.campaign.cancel': 'Campaña cancelada',
  'communications.campaign.fail': 'Campaña marcada como fallida',
  'communications.campaign.draft': 'Campaña devuelta a borrador',
  'analytics.export': 'Analítica exportada',
  'payment.reconcile': 'Pago conciliado manualmente',
  'audit.export': 'Auditoría exportada',
};

export default function Audit() {
  const { session, mode, hasPermission } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({ loading: true, error: null, events: [] });
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const events = await adminRepository.listAudit({ limit: 200 });
        if (!cancelled) setState({ loading: false, error: null, events });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, events: [] });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await adminRepository.exportAudit({
        search,
        module: moduleFilter,
        actor: session,
      });
      const downloaded = downloadCsv(result.filename, result.csv);
      notify({
        title: 'Auditoría exportada',
        description: downloaded
          ? `${result.filename} · ${result.count} evento(s)`
          : 'El navegador no permitió descargar el archivo.',
      });
      setReloadToken((token) => token + 1);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo exportar la auditoría', description: error.message });
    } finally {
      setExporting(false);
    }
  };

  const modules = useMemo(
    () => Array.from(new Set(state.events.map((event) => event.module).filter(Boolean))).sort(),
    [state.events]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.events.filter((event) => {
      if (moduleFilter !== 'all' && event.module !== moduleFilter) return false;
      if (!term) return true;
      return [
        event.action,
        event.actor_name,
        event.actorName,
        event.actor_email,
        event.actorEmail,
        event.entity_id,
        event.reason_text,
        event.reason,
        event.module,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.events, moduleFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Auditoría"
        description="Registro de acciones administrativas y accesos, incluidas las transiciones de solicitudes, ofertas, pedidos, entregas, chats, moderación, reseñas, soporte, comunicaciones, analítica y pagos. En producción es append-only y se escribe en el servidor; el cliente solo puede leerlo con permiso."
        actions={
          hasPermission('audit.export') ? (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || state.loading || Boolean(state.error)}
              title="Exporta los eventos visibles y registra la exportación en la auditoría"
              className="inline-flex items-center gap-2 rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {exporting ? 'Exportando…' : 'Exportar CSV'}
            </button>
          ) : null
        }
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Auditoría de demostración">
          Estos eventos se guardan en localStorage y pueden alterarse desde el navegador. No los
          uses como evidencia. La auditoría confiable se escribe en el servidor con las migraciones
          de Fase 1 a 5.
        </Alert>
      ) : (
        <Alert tone="success" title="Auditoría del servidor">
          Los eventos provienen de <code className="font-mono text-xs">admin_audit_logs</code>. La
          tabla no permite escritura ni modificación desde el cliente.
        </Alert>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ScrollText className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
            Eventos registrados
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              {filtered.length}
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar actor, acción o motivo…"
                aria-label="Buscar en auditoría"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
              />
            </div>
            <select
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
              aria-label="Filtrar por módulo"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
            >
              <option value="all">Todos los módulos</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </div>
        </div>

        {state.loading ? <Spinner label="Cargando auditoría…" /> : null}

        {state.error ? (
          <div className="p-5">
            <Alert tone="danger" title="No se pudo cargar la auditoría">
              {state.error}
            </Alert>
          </div>
        ) : null}

        {!state.loading && !state.error ? (
          filtered.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Fecha</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Actor</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Acción</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Módulo</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Entidad</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((event) => {
                    const createdAt = event.created_at || event.createdAt;
                    const actor = event.actor_name || event.actorName || 'Sistema';
                    const actorEmail = event.actor_email || event.actorEmail;
                    const reason = event.reason_text || event.reason;
                    const metadata = event.metadata;

                    return (
                      <tr key={event.id} className="border-b border-slate-100 align-top last:border-0">
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">
                          {formatDateTime(createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-slate-800">{actor}</p>
                          {actorEmail ? <p className="text-xs text-slate-400">{actorEmail}</p> : null}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm font-medium text-slate-800">
                            {ACTION_LABELS[event.action] || event.action}
                          </span>
                          <p className="text-[11px] font-mono text-slate-400">{event.action}</p>
                          {metadata && Object.keys(metadata).length ? (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-[11px] font-semibold text-[#006E7A]">
                                Ver detalle
                              </summary>
                              <pre className="mt-1 max-w-xs overflow-x-auto rounded-lg bg-slate-50 p-2 text-[10px] leading-4 text-slate-600">
                                {JSON.stringify(metadata, null, 2)}
                              </pre>
                            </details>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">{event.module}</td>
                        <td className="px-5 py-3">
                          <p className="text-xs text-slate-600">{event.entity_type}</p>
                          <p className="font-mono text-[11px] text-slate-400">
                            {truncateId(event.entity_id, 10)}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">{reason || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                Icon={ShieldCheck}
                title="Sin eventos para este filtro"
                description="Prueba con otro módulo o limpia la búsqueda."
              />
            </div>
          )
        ) : null}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs leading-6 text-slate-500 shadow-sm">
        <p className="font-semibold text-slate-700">Reglas de la auditoría</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Sin edición ni borrado desde el panel.</li>
          <li>Las acciones sensibles requieren motivo y quedan vinculadas al actor.</li>
          <li>La exportación y la retención se definen en la Fase 5.</li>
        </ul>
      </div>
    </div>
  );
}
