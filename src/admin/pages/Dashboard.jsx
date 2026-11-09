import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BadgeDollarSign,
  ClipboardList,
  FileCheck2,
  LifeBuoy,
  MailPlus,
  Megaphone,
  MessageSquare,
  Package,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Star,
  Store,
  Tags,
  Truck,
  UserCog,
  Users,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import { useAdminAuth } from '../auth/useAdminAuth';
import { adminRepository } from '../data';
import { formatDateTime, formatRelative } from '../utils/format';

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
  'offer.flag': 'Oferta marcada',
  'offer.unflag': 'Marca retirada',
  'offer.withdraw_admin': 'Oferta retirada',
  'order.transition': 'Pedido actualizado',
  'order.cancel': 'Pedido cancelado',
  'order.dispute': 'Disputa abierta',
  'order.resolve_dispute': 'Disputa resuelta',
  'delivery.update': 'Entrega actualizada',
  'delivery.confirm': 'Recepción confirmada',
  'delivery.incident': 'Incidencia registrada',
  'delivery.incident.resolve': 'Incidencia resuelta',
  'chat.access.request': 'Acceso a chat solicitado',
  'chat.access.approved': 'Acceso a chat aprobado',
  'chat.access.denied': 'Acceso a chat denegado',
  'chat.access.revoked': 'Acceso a chat revocado',
  'chat.content.read': 'Contenido de chat leído',
  'moderation.assign': 'Reporte de moderación asignado',
  'moderation.resolve': 'Reporte de moderación resuelto',
  'moderation.dismiss': 'Reporte de moderación descartado',
  'review.hide': 'Reseña oculta',
  'review.restore': 'Reseña restaurada',
  'review.flag': 'Reseña marcada',
  'review.publish': 'Reseña publicada',
  'support.assign': 'Ticket asignado',
  'support.reply': 'Ticket respondido',
  'support.resolve': 'Ticket resuelto',
  'support.close': 'Ticket cerrado',
  'support.reopen': 'Ticket reabierto',
  'support.status': 'Estado de ticket actualizado',
  'communications.template.active': 'Plantilla activada',
  'communications.template.archived': 'Plantilla archivada',
  'communications.template.draft': 'Plantilla devuelta a borrador',
  'communications.campaign.create': 'Campaña creada',
  'communications.campaign.queue': 'Campaña en cola simulada',
  'communications.campaign.send': 'Campaña marcada como enviada (simulada)',
  'communications.campaign.cancel': 'Campaña cancelada',
  'communications.campaign.fail': 'Campaña marcada como fallida',
  'communications.campaign.draft': 'Campaña devuelta a borrador',
};

const ACTION_STYLES = {
  'auth.login': 'bg-sky-50 text-sky-700',
  'auth.logout': 'bg-slate-100 text-slate-600',
  'staff.invite': 'bg-violet-50 text-violet-700',
  'staff.suspend': 'bg-amber-50 text-amber-700',
  'staff.reactivate': 'bg-emerald-50 text-emerald-700',
  'buyer.suspend': 'bg-amber-50 text-amber-700',
  'buyer.reactivate': 'bg-emerald-50 text-emerald-700',
  'buyer.block': 'bg-red-50 text-red-700',
  'buyer.unblock': 'bg-emerald-50 text-emerald-700',
  'buyer.limit': 'bg-orange-50 text-orange-700',
  'commerce.review': 'bg-sky-50 text-sky-700',
  'commerce.approve': 'bg-emerald-50 text-emerald-700',
  'commerce.reject': 'bg-red-50 text-red-700',
  'commerce.suspend': 'bg-amber-50 text-amber-700',
  'commerce.reactivate': 'bg-emerald-50 text-emerald-700',
  'commerce.document.verify': 'bg-emerald-50 text-emerald-700',
  'commerce.document.reject': 'bg-red-50 text-red-700',
  'catalog.create': 'bg-violet-50 text-violet-700',
  'catalog.update': 'bg-sky-50 text-sky-700',
  'catalog.activate': 'bg-emerald-50 text-emerald-700',
  'catalog.deactivate': 'bg-slate-100 text-slate-600',
  'request.hide': 'bg-amber-50 text-amber-700',
  'request.restore': 'bg-emerald-50 text-emerald-700',
  'request.close': 'bg-slate-100 text-slate-600',
  'request.cancel': 'bg-red-50 text-red-700',
  'offer.flag': 'bg-amber-50 text-amber-700',
  'offer.unflag': 'bg-emerald-50 text-emerald-700',
  'offer.withdraw_admin': 'bg-red-50 text-red-700',
  'order.transition': 'bg-sky-50 text-sky-700',
  'order.cancel': 'bg-red-50 text-red-700',
  'order.dispute': 'bg-red-50 text-red-700',
  'order.resolve_dispute': 'bg-emerald-50 text-emerald-700',
  'delivery.update': 'bg-sky-50 text-sky-700',
  'delivery.confirm': 'bg-emerald-50 text-emerald-700',
  'delivery.incident': 'bg-amber-50 text-amber-700',
  'delivery.incident.resolve': 'bg-emerald-50 text-emerald-700',
  'chat.access.request': 'bg-sky-50 text-sky-700',
  'chat.access.approved': 'bg-emerald-50 text-emerald-700',
  'chat.access.denied': 'bg-red-50 text-red-700',
  'chat.access.revoked': 'bg-red-50 text-red-700',
  'chat.content.read': 'bg-amber-50 text-amber-700',
  'moderation.assign': 'bg-sky-50 text-sky-700',
  'moderation.resolve': 'bg-emerald-50 text-emerald-700',
  'moderation.dismiss': 'bg-slate-100 text-slate-600',
  'review.hide': 'bg-amber-50 text-amber-700',
  'review.restore': 'bg-emerald-50 text-emerald-700',
  'review.flag': 'bg-amber-50 text-amber-700',
  'review.publish': 'bg-emerald-50 text-emerald-700',
  'support.assign': 'bg-sky-50 text-sky-700',
  'support.reply': 'bg-sky-50 text-sky-700',
  'support.resolve': 'bg-emerald-50 text-emerald-700',
  'support.close': 'bg-slate-100 text-slate-600',
  'support.reopen': 'bg-amber-50 text-amber-700',
  'support.status': 'bg-sky-50 text-sky-700',
  'communications.template.active': 'bg-emerald-50 text-emerald-700',
  'communications.template.archived': 'bg-slate-100 text-slate-600',
  'communications.template.draft': 'bg-sky-50 text-sky-700',
  'communications.campaign.create': 'bg-violet-50 text-violet-700',
  'communications.campaign.queue': 'bg-indigo-50 text-indigo-700',
  'communications.campaign.send': 'bg-emerald-50 text-emerald-700',
  'communications.campaign.cancel': 'bg-red-50 text-red-700',
  'communications.campaign.fail': 'bg-red-50 text-red-700',
  'communications.campaign.draft': 'bg-sky-50 text-sky-700',
};

function statusTone(tone) {
  if (tone === 'success') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (tone === 'warning') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (tone === 'info') return 'bg-sky-50 text-sky-700 ring-sky-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

export default function Dashboard() {
  const { session, mode, hasPermission } = useAdminAuth();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const canViewStaff = hasPermission('staff.view');
  const canViewAudit = hasPermission('audit.view');
  const canViewBuyers = hasPermission('users.view');
  const canViewCommerce = hasPermission('commerce.view');
  const canViewDocuments = hasPermission('commerce.documents.view');
  const canViewCatalog = hasPermission('catalog.view');
  const canViewRequests = hasPermission('requests.view');
  const canViewOffers = hasPermission('offers.view');
  const canViewOrders = hasPermission('orders.view');
  const canViewDeliveries = hasPermission('deliveries.view');
  const canViewChats = hasPermission('chats.view_metadata');
  const canViewModeration = hasPermission('moderation.view');
  const canViewReviews = hasPermission('reviews.view');
  const canViewSupport = hasPermission('support.view');
  const canViewCommunications = hasPermission('communications.view');
  const hasPeopleMetrics =
    canViewBuyers || canViewCommerce || canViewDocuments || canViewCatalog;
  const hasOperationsMetrics =
    canViewRequests || canViewOffers || canViewOrders || canViewDeliveries;
  const hasTrustMetrics =
    canViewChats ||
    canViewModeration ||
    canViewReviews ||
    canViewSupport ||
    canViewCommunications;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await adminRepository.getMetrics({ actor: session });
        if (!cancelled) setState({ loading: false, error: null, data });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, data: null });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const statusItems =
    mode === 'insforge'
      ? [
          { key: 'backend', label: 'Backend InsForge', detail: 'Configurado por variables de entorno', tone: 'success', value: 'Conectado' },
          { key: 'migrations', label: 'Migraciones de Fase 1 a 4', detail: 'Verifica que estén aplicadas en el proyecto', tone: 'info', value: 'Por verificar' },
          { key: 'permissions', label: 'Permisos', detail: 'Calculados en servidor (RLS + funciones)', tone: 'success', value: 'Servidor' },
          { key: 'audit', label: 'Auditoría', detail: 'Escrita en el servidor y de solo lectura', tone: 'success', value: 'Servidor' },
          { key: 'storage', label: 'Documentos privados', detail: 'Requiere bucket privado y URLs firmadas', tone: 'warning', value: 'Por verificar' },
          { key: 'evidence', label: 'Evidencias de entrega', detail: 'Requiere bucket privado y ruta autorizada', tone: 'warning', value: 'Por verificar' },
          { key: 'chatAccess', label: 'Acceso a chats', detail: 'Autorización aprobada, vigente y auditada por lectura', tone: 'success', value: 'Servidor' },
          { key: 'messaging', label: 'Envío de comunicaciones', detail: 'Requiere proveedor de correo y dominio verificado', tone: 'warning', value: 'Pendiente' },
          { key: 'mfa', label: 'MFA', detail: 'El SDK actual no expone segundo factor', tone: 'warning', value: 'Pendiente' },
          { key: 'email', label: 'Correo de invitaciones', detail: 'Requiere InsForge Messaging y dominio', tone: 'warning', value: 'Pendiente' },
        ]
      : [
          { key: 'backend', label: 'Backend InsForge', detail: 'Sin proyecto conectado', tone: 'warning', value: 'No configurado' },
          { key: 'permissions', label: 'Permisos', detail: 'Simulados en el navegador para esta demo', tone: 'warning', value: 'Locales' },
          { key: 'audit', label: 'Auditoría', detail: 'Guardada en localStorage; no es confiable', tone: 'warning', value: 'Demostración' },
          { key: 'storage', label: 'Documentos privados', detail: 'La demo solo guarda metadatos, sin archivos', tone: 'warning', value: 'Sin archivos' },
          { key: 'evidence', label: 'Evidencias de entrega', detail: 'Solo metadatos de ejemplo; no hay archivos', tone: 'warning', value: 'Sin archivos' },
          { key: 'chatAccess', label: 'Acceso a chats', detail: 'Flujo simulado local con auditoría de cada lectura', tone: 'warning', value: 'Demostración' },
          { key: 'messaging', label: 'Envío de comunicaciones', detail: 'No hay proveedor: los envíos son simulados', tone: 'warning', value: 'Simulado' },
          { key: 'mfa', label: 'MFA', detail: 'El SDK actual no expone segundo factor', tone: 'warning', value: 'Pendiente' },
          { key: 'email', label: 'Correo de invitaciones', detail: 'Requiere InsForge Messaging y dominio', tone: 'warning', value: 'Pendiente' },
        ];

  const metrics = state.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Hola, ${session?.name?.split(' ')[0] || 'equipo'}`}
        title="Panel de control"
        description="Estado de personas, operación, confianza, atención, personal, permisos y auditoría. Analítica y pagos se incorporan en la Fase 5."
        actions={
          <>
            {hasPermission('staff.view') ? (
              <Link
                to="/personal"
                className="inline-flex items-center gap-2 rounded-xl bg-[#3A1A5E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2E144A]"
              >
                <UserCog className="h-4 w-4" aria-hidden="true" />
                Gestionar personal
              </Link>
            ) : null}
            {hasPermission('audit.view') ? (
              <Link
                to="/auditoria"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <ScrollText className="h-4 w-4" aria-hidden="true" />
                Ver auditoría
              </Link>
            ) : null}
          </>
        }
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Estás en modo demostración">
          No hay backend conectado. Las cuentas, invitaciones, compradores, comercios, categorías,
          solicitudes, ofertas, pedidos, entregas, chats, reportes, reseñas, tickets, plantillas,
          campañas y eventos de auditoría son ejemplos guardados en este navegador. Nada de lo que
          veas aquí representa datos reales de la plataforma.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando indicadores…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar los indicadores">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error && metrics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {canViewStaff ? (
              <>
                <KpiCard
                  label="Personal activo"
                  value={metrics.activeMembers}
                  hint={`${metrics.totalMembers} cuenta(s) administrativa(s) en total`}
                  Icon={Users}
                  tone="accent"
                />
                <KpiCard
                  label="Invitaciones pendientes"
                  value={metrics.pendingInvitations}
                  hint="Altas de personal sin aceptar"
                  Icon={MailPlus}
                  tone={metrics.pendingInvitations > 0 ? 'warning' : 'default'}
                />
              </>
            ) : null}
            {canViewAudit ? (
              <KpiCard
                label="Eventos de auditoría hoy"
                value={metrics.auditToday}
                hint={mode === 'demo' ? 'Registro local de demostración' : 'Registro del servidor'}
                Icon={Activity}
              />
            ) : null}
            <KpiCard
              label="Permisos de tu rol"
              value={session?.permissions?.length || 0}
              hint={`Rol: ${session?.roleName || '—'}`}
              Icon={ShieldCheck}
            />
          </div>

          {hasPeopleMetrics ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {canViewBuyers ? (
                <KpiCard
                  label="Compradores activos"
                  value={metrics.activeBuyers}
                  hint={`${metrics.totalBuyers} comprador(es) registrado(s) · ${metrics.suspendedBuyers} suspendido(s)`}
                  Icon={Users}
                />
              ) : null}
              {canViewCommerce ? (
                <KpiCard
                  label="Comercios pendientes"
                  value={metrics.pendingCommerces}
                  hint={`${metrics.inReviewCommerces} en revisión · ${metrics.approvedCommerces} aprobado(s)`}
                  Icon={Store}
                  tone={metrics.pendingCommerces > 0 ? 'warning' : 'default'}
                />
              ) : null}
              {canViewDocuments ? (
                <KpiCard
                  label="Documentos por revisar"
                  value={metrics.pendingDocuments}
                  hint={`${metrics.totalDocuments} documento(s) · ${metrics.rejectedDocuments} rechazado(s)`}
                  Icon={FileCheck2}
                  tone={metrics.pendingDocuments > 0 ? 'warning' : 'default'}
                />
              ) : null}
              {canViewCatalog ? (
                <KpiCard
                  label="Categorías activas"
                  value={metrics.activeCategories}
                  hint={`${metrics.totalCategories} en total · ${metrics.inactiveCategories} inactiva(s)`}
                  Icon={Tags}
                />
              ) : null}
            </div>
          ) : null}

          {hasOperationsMetrics ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {canViewRequests ? (
                <KpiCard
                  label="Solicitudes abiertas"
                  value={metrics.openRequests}
                  hint={`${metrics.totalRequests} en total · ${metrics.hiddenRequests} oculta(s)`}
                  Icon={ClipboardList}
                  tone={metrics.hiddenRequests > 0 ? 'warning' : 'default'}
                />
              ) : null}
              {canViewOffers ? (
                <KpiCard
                  label="Ofertas activas"
                  value={metrics.activeOffers}
                  hint={`${metrics.totalOffers} en total · ${metrics.flaggedOffers} marcada(s)`}
                  Icon={BadgeDollarSign}
                  tone={metrics.flaggedOffers > 0 ? 'warning' : 'default'}
                />
              ) : null}
              {canViewOrders ? (
                <KpiCard
                  label="Pedidos por confirmar"
                  value={metrics.pendingOrders}
                  hint={`${metrics.inProgressOrders} en curso · ${metrics.disputedOrders} en disputa`}
                  Icon={Package}
                  tone={metrics.disputedOrders > 0 ? 'warning' : 'default'}
                />
              ) : null}
              {canViewDeliveries ? (
                <KpiCard
                  label="Entregas en tránsito"
                  value={metrics.inTransitDeliveries}
                  hint={`${metrics.failedDeliveries} con fallo · ${metrics.openIncidents} incidencia(s) abierta(s)`}
                  Icon={Truck}
                  tone={
                    metrics.failedDeliveries > 0 || metrics.openIncidents > 0
                      ? 'warning'
                      : 'default'
                  }
                />
              ) : null}
            </div>
          ) : null}

          {hasTrustMetrics ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {canViewChats ? (
                <KpiCard
                  label="Chats marcados"
                  value={metrics.flaggedChats}
                  hint={`${metrics.totalChats} conversación(es) · ${metrics.pendingChatAccessRequests} acceso(s) pendiente(s)`}
                  Icon={MessageSquare}
                  tone={
                    metrics.flaggedChats > 0 || metrics.pendingChatAccessRequests > 0
                      ? 'warning'
                      : 'default'
                  }
                />
              ) : null}
              {canViewModeration ? (
                <KpiCard
                  label="Reportes de moderación abiertos"
                  value={metrics.openModerationReports}
                  hint={`${metrics.inReviewModerationReports} en revisión · ${metrics.totalModerationReports} en total`}
                  Icon={ShieldAlert}
                  tone={metrics.openModerationReports > 0 ? 'warning' : 'default'}
                />
              ) : null}
              {canViewReviews ? (
                <KpiCard
                  label="Reseñas publicadas"
                  value={metrics.publishedReviews}
                  hint={`${metrics.flaggedReviews} marcada(s) · ${metrics.hiddenReviews} oculta(s) · ${metrics.totalReviews} en total`}
                  Icon={Star}
                  tone={metrics.flaggedReviews > 0 ? 'warning' : 'default'}
                />
              ) : null}
              {canViewSupport ? (
                <KpiCard
                  label="Tickets de soporte abiertos"
                  value={metrics.openSupportTickets}
                  hint={`${metrics.inProgressSupportTickets} en progreso · ${metrics.overdueSupportTickets} fuera de plazo`}
                  Icon={LifeBuoy}
                  tone={
                    metrics.overdueSupportTickets > 0 || metrics.openSupportTickets > 0
                      ? 'warning'
                      : 'default'
                  }
                />
              ) : null}
              {canViewCommunications ? (
                <KpiCard
                  label="Campañas en cola simulada"
                  value={metrics.queuedCampaigns}
                  hint={`${metrics.activeTemplates} plantilla(s) activa(s) · sin proveedor de envío`}
                  Icon={Megaphone}
                  tone={metrics.queuedCampaigns > 0 ? 'warning' : 'default'}
                />
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Requiere atención</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Cola de trabajo de las secciones que puedes ver
                  </p>
                </div>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  {metrics.attention.length} aviso(s)
                </span>
              </div>

              <div className="p-5">
                {metrics.attention.length ? (
                  <ul className="space-y-3">
                    {metrics.attention.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 rounded-lg bg-amber-50 p-1.5 text-amber-600 ring-1 ring-amber-200">
                            <ClipboardList className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <p className="text-sm font-medium text-slate-800">{item.label}</p>
                        </div>
                        {item.path ? (
                          <Link
                            to={item.path}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#006E7A] hover:underline"
                          >
                            Revisar
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    Icon={ShieldCheck}
                    title="Sin avisos pendientes"
                    description="No hay invitaciones, comercios, documentos, solicitudes, ofertas, pedidos, entregas, chats, reportes ni tickets que requieran tu intervención ahora mismo."
                  />
                )}

                <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs leading-5 text-slate-500">
                    La Fase 5 añadirá analítica y pagos a esta cola. Solo se muestran datos
                    registrados en el origen activo, nunca datos inventados. Las campañas de
                    comunicación son simuladas: no existe proveedor de envío real.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">Estado de la plataforma</h2>
                <p className="mt-0.5 text-xs text-slate-500">Qué es real y qué falta conectar</p>
              </div>
              <ul className="divide-y divide-slate-100">
                {statusItems.map((item) => (
                  <li key={item.key} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{item.label}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.detail}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusTone(item.tone)}`}
                    >
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {canViewAudit ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Actividad reciente</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {mode === 'demo' ? 'Eventos de demostración' : 'Últimos eventos auditados'}
                </p>
              </div>
              {hasPermission('audit.view') ? (
                <Link
                  to="/auditoria"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#006E7A] hover:underline"
                >
                  Ver todo
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </div>

            {metrics.recentAudit?.length ? (
              <ul className="divide-y divide-slate-100">
                {metrics.recentAudit.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`mt-0.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${ACTION_STYLES[entry.action] || 'bg-slate-100 text-slate-600'}`}
                      >
                        {ACTION_LABELS[entry.action] || entry.action}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {entry.actor_name || entry.actorName || 'Sistema'}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {entry.reason_text || entry.reason || entry.module}
                        </p>
                      </div>
                    </div>
                    <time
                      className="shrink-0 text-xs text-slate-400"
                      dateTime={entry.created_at || entry.createdAt}
                      title={formatDateTime(entry.created_at || entry.createdAt)}
                    >
                      {formatRelative(entry.created_at || entry.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <EmptyState
                  Icon={Activity}
                  title="Todavía no hay actividad"
                  description="Los inicios de sesión y las acciones administrativas aparecerán aquí."
                />
              </div>
            )}
          </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-slate-50 p-2 text-slate-400 ring-1 ring-slate-200">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Actividad reciente</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Tu rol no incluye el permiso <code className="font-mono text-xs">audit.view</code>,
                    así que este panel no muestra eventos. Un superadministrador puede concederlo.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-[#F0FDFB] p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#006E7A]">Siguiente fase</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">
                  Fase 5 · Analítica y pagos
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Métricas confiables y operación de pagos reales. Requiere una pasarela conectada y
                  aprobación tuya antes de comenzar.
                </p>
              </div>
              <span className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                No iniciada
              </span>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
