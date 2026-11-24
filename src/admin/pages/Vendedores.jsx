import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  MessageSquare,
  Search,
  ShoppingBag,
  UserRound,
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
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelative,
  initials,
} from '../utils/format';

const SELLER_REASONS = {
  deactivate: [
    { value: 'performance', label: 'Bajo desempeño' },
    { value: 'policy', label: 'Incumplimiento de políticas' },
    { value: 'commerce_request', label: 'Solicitud del comercio' },
    { value: 'security', label: 'Motivo de seguridad' },
  ],
  activate: [
    { value: 'review_complete', label: 'Revisión completada' },
    { value: 'commerce_request', label: 'Solicitud del comercio' },
    { value: 'new_cycle', label: 'Nuevo ciclo de ventas' },
  ],
};

function SellerAvatar({ seller, compact = false }) {
  const size = compact ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';

  return seller.avatarUrl ? (
    <img
      src={seller.avatarUrl}
      alt=""
      className={`${size} shrink-0 rounded-full object-cover ring-2 ring-white`}
    />
  ) : (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-[#4B227A]/10 font-bold text-[#4B227A]`}
    >
      {initials(seller.fullName)}
    </span>
  );
}

function SellerStatus({ seller }) {
  return (
    <StatusBadge status={seller.isActive ? 'active' : 'inactive'}>
      {seller.isActive ? 'Activo' : 'Inactivo'}
    </StatusBadge>
  );
}

function SellerDetail({ detail }) {
  const { seller, sales, chats, contentUnlocked } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 px-4 py-4 sm:flex-row sm:items-center">
        <SellerAvatar seller={seller} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{seller.fullName}</p>
          <p className="truncate text-xs text-slate-500">{seller.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SellerStatus seller={seller} />
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
              {seller.role === 'owner' ? 'Dueño del comercio' : 'Vendedor afiliado'}
            </span>
            <span className="text-xs text-slate-500">{seller.commerceName}</span>
          </div>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Ofertas enviadas', seller.offersSent],
          ['Ventas cerradas', seller.salesClosed],
          ['Monto vendido', formatCurrency(seller.salesAmount)],
          ['Calificación', seller.rating == null ? '—' : Number(seller.rating).toFixed(1)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-white px-3.5 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {label}
            </dt>
            <dd className="mt-1 text-base font-bold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-slate-900">Ventas cerradas</h3>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
            {sales.length}
          </span>
        </div>
        {sales.length ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
            {sales.map((sale) => (
              <li key={sale.orderId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {sale.orderNumber || 'Pedido'} · {sale.buyerName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(sale.placedAt)} · {formatDate(sale.completedAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {formatCurrency(sale.totalAmount)} {sale.currency}
                  </p>
                  <StatusBadge status={sale.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Este vendedor todavía no tiene ventas atribuidas.
          </p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-slate-900">Conversaciones atendidas</h3>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
            {chats.length}
          </span>
        </div>
        {!contentUnlocked ? (
          <div className="mb-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Tu rol ve metadatos de los chats. El contenido de los mensajes requiere{' '}
            <code className="font-mono">chats.access_content</code>.
          </div>
        ) : null}
        {chats.length ? (
          <ul className="space-y-3">
            {chats.map((chat) => (
              <li key={chat.chatId} className="rounded-xl border border-slate-100 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {chat.subject || 'Conversación'} · {chat.buyerName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {chat.messageCount} mensajes · Último {formatRelative(chat.lastMessageAt)}
                      {chat.rating != null ? ` · Calificación ${Number(chat.rating).toFixed(1)}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={chat.status} />
                </div>
                {contentUnlocked && chat.messages.length ? (
                  <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    {chat.messages.map((message) => (
                      <li key={message.id} className="text-xs leading-5 text-slate-600">
                        <span className="font-semibold text-slate-800">
                          {message.senderName || message.senderType}:
                        </span>{' '}
                        {message.body}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Este vendedor todavía no tiene conversaciones atribuidas.
          </p>
        )}
      </section>

      <p className="text-xs text-slate-400">Alta en la plataforma: {formatDate(seller.joinedAt)}</p>
    </div>
  );
}

export default function Vendedores() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const canManage = hasPermission('sellers.manage');

  const [state, setState] = useState({ loading: true, error: null, sellers: [] });
  const [search, setSearch] = useState('');
  const [detailTarget, setDetailTarget] = useState(null);
  const [detail, setDetail] = useState({ loading: false, error: null, data: null });
  const [actionTarget, setActionTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(async () => {
    try {
      const sellers = await adminRepository.listAdminSellers({ actor: session });
      setState({ loading: false, error: null, sellers: Array.isArray(sellers) ? sellers : [] });
    } catch (error) {
      setState({ loading: false, error: error.message, sellers: [] });
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return state.sellers;

    return state.sellers.filter((seller) =>
      [seller.fullName, seller.email, seller.commerceName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [state.sellers, search]);

  const activeCount = state.sellers.filter((seller) => seller.isActive).length;
  const totalSales = state.sellers.reduce(
    (sum, seller) => sum + Number(seller.salesClosed || 0),
    0
  );
  const totalAmount = state.sellers.reduce(
    (sum, seller) => sum + Number(seller.salesAmount || 0),
    0
  );
  const totalChats = state.sellers.reduce((sum, seller) => sum + Number(seller.chatCount || 0), 0);

  const openDetail = async (seller) => {
    setDetailTarget(seller);
    setDetail({ loading: true, error: null, data: null });
    try {
      const data = await adminRepository.getAdminSellerDetail({
        sellerId: seller.id,
        actor: session,
      });
      setDetail({ loading: false, error: null, data });
    } catch (error) {
      setDetail({ loading: false, error: error.message, data: null });
    }
  };

  const closeDetail = () => {
    setDetailTarget(null);
    setDetail({ loading: false, error: null, data: null });
  };

  const confirmAction = async ({ reason, detail: detailText }) => {
    if (!actionTarget || actionBusy) return;

    const reasons = actionTarget.nextIsActive ? SELLER_REASONS.activate : SELLER_REASONS.deactivate;
    const reasonLabel = reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detailText ? `${reasonLabel}: ${detailText}` : reasonLabel;
    const target = actionTarget;

    setActionBusy(true);
    setActionError(null);
    try {
      await adminRepository.setSellerActive({
        sellerId: target.seller.id,
        isActive: target.nextIsActive,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: target.nextIsActive ? 'Vendedor activado' : 'Vendedor desactivado',
        description: `${target.seller.fullName} · ${target.seller.commerceName}`,
      });
      setActionTarget(null);
      closeDetail();
      await load();
    } catch (error) {
      setActionError(error.message);
      notify({
        tone: 'error',
        title: 'No se pudo cambiar el estado',
        description: error.message,
      });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Personas"
        title="Vendedores"
        description="Directorio global de vendedores afiliados, sus ventas atribuidas y conversaciones. Los cambios de estado requieren motivo y quedan auditados."
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Vendedores de demostración">
          Los vendedores, métricas y cambios de esta pantalla son ejemplos guardados en este
          navegador. No representan datos reales de la plataforma.
        </Alert>
      ) : null}

      {actionError ? (
        <Alert tone="danger" title="No se pudo actualizar el vendedor">
          {actionError}
        </Alert>
      ) : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar los vendedores">
          {state.error}
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Vendedores activos',
            value: `${activeCount} / ${state.sellers.length}`,
            className: 'border-emerald-100 bg-emerald-50/60',
            labelClass: 'text-emerald-700',
            valueClass: 'text-emerald-800',
          },
          { label: 'Ventas cerradas', value: totalSales },
          { label: 'Monto en ventas', value: formatCurrency(totalAmount) },
          { label: 'Chats atendidos', value: totalChats },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-4 shadow-sm ${card.className || 'border-slate-200 bg-white'}`}
          >
            <p
              className={`text-xs font-medium uppercase tracking-wide text-slate-500 ${card.labelClass || ''}`}
            >
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-bold text-slate-900 ${card.valueClass || ''}`}>
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Users className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
            Directorio de vendedores
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              {filtered.length}
            </span>
          </div>

          <label className="relative block w-full sm:w-80">
            <span className="sr-only">Buscar vendedores</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por vendedor, correo o comercio…"
              aria-label="Buscar vendedores"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
            />
          </label>
        </div>

        {state.loading ? (
          <div className="p-6">
            <Spinner label="Cargando vendedores…" />
          </div>
        ) : null}

        {!state.loading && !state.error && filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              Icon={UserRound}
              title="No hay vendedores para mostrar"
              description={
                search.trim()
                  ? 'Prueba con otro nombre, correo o comercio.'
                  : 'Todavía no hay vendedores afiliados en la plataforma.'
              }
            />
          </div>
        ) : null}

        {!state.loading && !state.error && filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Vendedor</th>
                  <th className="px-5 py-3 font-semibold">Comercio</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 font-semibold">Ventas</th>
                  <th className="px-5 py-3 font-semibold">Monto</th>
                  <th className="px-5 py-3 font-semibold">Calificación</th>
                  <th className="px-5 py-3 font-semibold">Chats</th>
                  <th className="px-5 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((seller) => (
                  <tr key={seller.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <SellerAvatar seller={seller} compact />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => openDetail(seller)}
                            className="truncate text-left font-semibold text-slate-900 hover:text-[#4B227A] hover:underline"
                          >
                            {seller.fullName}
                          </button>
                          <p className="truncate text-xs text-slate-500">{seller.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-700">{seller.commerceName}</p>
                      <p className="text-xs text-slate-400">
                        {seller.role === 'owner' ? 'Dueño' : 'Vendedor'}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <SellerStatus seller={seller} />
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-700">{seller.salesClosed}</td>
                    <td className="px-5 py-3 text-slate-700">
                      {formatCurrency(seller.salesAmount)}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {seller.rating == null ? '—' : Number(seller.rating).toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{seller.chatCount}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openDetail(seller)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                          Ficha
                        </button>
                        {seller.role === 'seller' && canManage ? (
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => {
                              setActionError(null);
                              setActionTarget({ seller, nextIsActive: !seller.isActive });
                            }}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              seller.isActive
                                ? 'border border-red-200 text-red-700 hover:bg-red-50'
                                : 'bg-[#4B227A] text-white hover:bg-[#3A1A5E]'
                            }`}
                          >
                            {seller.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <Modal
        open={Boolean(detailTarget)}
        onClose={closeDetail}
        title="Detalle del vendedor"
        description={detailTarget ? `${detailTarget.fullName} · ${detailTarget.commerceName}` : ''}
        size="lg"
      >
        {detail.loading ? <Spinner label="Cargando detalle…" /> : null}
        {!detail.loading && detail.error ? (
          <Alert tone="danger" title="No se pudo cargar el detalle">
            {detail.error}
          </Alert>
        ) : null}
        {!detail.loading && !detail.error && detail.data ? (
          <SellerDetail detail={detail.data} />
        ) : null}
      </Modal>

      <ReasonDialog
        open={Boolean(actionTarget)}
        title={
          actionTarget?.nextIsActive ? 'Activar vendedor afiliado' : 'Desactivar vendedor afiliado'
        }
        description={
          actionTarget
            ? `${actionTarget.seller.fullName} · ${actionTarget.seller.commerceName}. La acción queda auditada con el motivo indicado.`
            : ''
        }
        reasons={
          actionTarget?.nextIsActive ? SELLER_REASONS.activate : SELLER_REASONS.deactivate
        }
        confirmLabel={actionTarget?.nextIsActive ? 'Activar' : 'Desactivar'}
        tone={actionTarget?.nextIsActive ? 'primary' : 'danger'}
        busy={actionBusy}
        onConfirm={confirmAction}
        onClose={() => setActionTarget(null)}
      />
    </div>
  );
}
