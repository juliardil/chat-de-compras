import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Eye,
  KeyRound,
  LockKeyhole,
  MessageSquare,
  Search,
  ShieldCheck,
  X,
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
  CHAT_ACCESS_REASONS,
  CHAT_STATUS_OPTIONS,
} from '../constants/phase4';
import { formatDateTime, formatRelative } from '../utils/format';

const ACCESS_LABELS = {
  pending: 'Solicitud pendiente',
  approved: 'Lectura autorizada',
  denied: 'Solicitud denegada',
  expired: 'Acceso vencido',
  revoked: 'Acceso revocado',
};

const DECISION_CONFIG = {
  approved: {
    label: 'Aprobar acceso',
    title: 'Aprobar acceso al chat',
    reasons: CHAT_ACCESS_REASONS.approve,
    tone: 'primary',
  },
  denied: {
    label: 'Denegar acceso',
    title: 'Denegar acceso al chat',
    reasons: CHAT_ACCESS_REASONS.deny,
    tone: 'danger',
  },
  revoked: {
    label: 'Revocar acceso',
    title: 'Revocar acceso al chat',
    reasons: CHAT_ACCESS_REASONS.revoke,
    tone: 'danger',
  },
};

function AccessBadge({ chat }) {
  const request = chat.myAccessRequest;
  if (!request) {
    return <span className="text-xs text-slate-500">Sin solicitud</span>;
  }
  return (
    <StatusBadge status={request.effectiveStatus}>
      {ACCESS_LABELS[request.effectiveStatus] || request.effectiveStatus}
    </StatusBadge>
  );
}

function ChatDetail({ chat, canGrantAccess, hasPermission, onDecide, onRead, busy }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={chat.status} />
          <AccessBadge chat={chat} />
          <span className="text-xs font-semibold text-slate-500">
            {chat.messageCount} mensaje(s)
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">{chat.subject}</p>
        <p className="mt-1 text-xs text-slate-500">
          {chat.buyerName || 'Comprador no disponible'} · {chat.commerceName || 'Comercio no disponible'}
          {chat.orderNumber ? ` · ${chat.orderNumber}` : ''}
        </p>
      </div>

      {chat.flaggedReason ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
          Marcada el {formatDateTime(chat.flaggedAt)}: {chat.flaggedReason}
        </div>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Inicio</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(chat.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Último mensaje</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatRelative(chat.lastMessageAt)}</dd>
        </div>
      </dl>

      <div className="rounded-xl border border-slate-200 px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Vista previa (metadatos)
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {chat.lastMessagePreview || 'Sin mensajes registrados.'}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Solicitudes de acceso
          </p>
          {chat.canReadContent && hasPermission('chats.access_content') ? (
            <button
              type="button"
              onClick={() => onRead(chat)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Leer contenido auditado
            </button>
          ) : null}
        </div>

        {chat.accessRequests?.length ? (
          <ul className="mt-2 space-y-2">
            {chat.accessRequests.map((request) => {
              const decisions = [];
              if (canGrantAccess && request.status === 'pending') {
                decisions.push('approved', 'denied');
              }
              if (canGrantAccess && request.effectiveStatus === 'approved') {
                decisions.push('revoked');
              }

              return (
                <li key={request.id} className="rounded-xl border border-slate-200 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={request.effectiveStatus}>
                      {ACCESS_LABELS[request.effectiveStatus] || request.effectiveStatus}
                    </StatusBadge>
                    <span className="text-xs font-semibold text-slate-600">
                      {request.requestedByName} · {formatRelative(request.requestedAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-slate-700">{request.reason}</p>
                  {request.expiresAt ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      Vigencia: {formatDateTime(request.expiresAt)}
                    </p>
                  ) : null}
                  {request.reviewReason ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Revisión: {request.reviewReason}
                    </p>
                  ) : null}

                  {decisions.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {decisions.map((decision) => {
                        const config = DECISION_CONFIG[decision];
                        return (
                          <button
                            key={decision}
                            type="button"
                            disabled={busy}
                            onClick={() => onDecide(chat, request, decision)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                              config.tone === 'danger'
                                ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                          >
                            {decision === 'approved' ? (
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {config.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
            No hay solicitudes de acceso registradas para ti en esta conversación.
          </p>
        )}
      </div>
    </div>
  );
}

export default function Chats() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({ loading: true, error: null, chats: [] });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailTarget, setDetailTarget] = useState(null);
  const [contentTarget, setContentTarget] = useState(null);
  const [requestTarget, setRequestTarget] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const chats = await adminRepository.listChats({ actor: session });
      setState({ loading: false, error: null, chats });
    } catch (error) {
      setState({ loading: false, error: error.message, chats: [] });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const chats = await adminRepository.listChats({ actor: session });
        if (!cancelled) setState({ loading: false, error: null, chats });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, chats: [] });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.chats.filter((chat) => {
      if (statusFilter !== 'all' && chat.status !== statusFilter) return false;
      if (!term) return true;
      return [chat.subject, chat.buyerName, chat.commerceName, chat.orderNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.chats, search, statusFilter]);

  const openDetail = async (chat) => {
    setDetailTarget(chat);
    try {
      const detail = await adminRepository.getChat({ chatId: chat.id, actor: session });
      setDetailTarget(detail);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cargar el chat', description: error.message });
    }
  };

  const openContent = async (chat) => {
    try {
      const content = await adminRepository.readChatContent({ chatId: chat.id, actor: session });
      setContentTarget(content);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo leer el contenido', description: error.message });
    }
  };

  const confirmRequest = async ({ reason, detail }) => {
    if (!requestTarget) return;
    const label = CHAT_ACCESS_REASONS.request.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setBusy(true);
    try {
      await adminRepository.requestChatAccess({
        chatId: requestTarget.id,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: 'Solicitud de acceso registrada',
        description: `${requestTarget.subject} · pendiente de aprobación`,
      });
      setRequestTarget(null);
      await refresh();
      if (detailTarget?.id === requestTarget.id) await openDetail(requestTarget);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo solicitar el acceso', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  const confirmDecision = async ({ reason, detail }) => {
    if (!actionTarget) return;
    const config = DECISION_CONFIG[actionTarget.decision];
    const label = config.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setBusy(true);
    try {
      await adminRepository.decideChatAccess({
        accessRequestId: actionTarget.request.id,
        decision: actionTarget.decision,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: config.label,
        description: `${actionTarget.chat.subject} · ${label}`,
      });
      setActionTarget(null);
      await refresh();
      await openDetail(actionTarget.chat);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo actualizar el acceso', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Confianza"
        title="Chats"
        description="Consulta los metadatos de las conversaciones. El contenido solo se lee con una autorización aprobada, vigente y auditada."
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Chats de demostración">
          Las conversaciones, mensajes y solicitudes de acceso son ejemplos guardados en este
          navegador. Cada lectura de contenido exige una autorización vigente y genera auditoría
          local, pero no hay backend real.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando chats…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar los chats">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageSquare className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
              Conversaciones
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
                  placeholder="Buscar asunto, comprador o comercio…"
                  aria-label="Buscar chats"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filtrar chats por estado"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todos los estados</option>
                {CHAT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Conversación</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Pedido</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Mensajes</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Mi acceso</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Último mensaje</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((chat) => {
                    const canRequest =
                      hasPermission('chats.request_access') &&
                      chat.myAccessRequest?.effectiveStatus !== 'pending' &&
                      chat.myAccessRequest?.effectiveStatus !== 'approved';

                    return (
                      <tr key={chat.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => openDetail(chat)}
                            className="block max-w-xs truncate text-left text-sm font-semibold text-slate-900 hover:text-[#4B227A] hover:underline"
                          >
                            {chat.subject}
                          </button>
                          <p className="truncate text-xs text-slate-500">
                            {chat.buyerName || 'Comprador no disponible'} ·{' '}
                            {chat.commerceName || 'Comercio no disponible'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {chat.orderNumber || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{chat.messageCount}</td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={chat.status} />
                        </td>
                        <td className="px-5 py-3.5">
                          <AccessBadge chat={chat} />
                        </td>
                        <td
                          className="px-5 py-3.5 text-sm text-slate-600"
                          title={formatDateTime(chat.lastMessageAt)}
                        >
                          {formatRelative(chat.lastMessageAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetail(chat)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              Ficha
                            </button>
                            {chat.canReadContent && hasPermission('chats.access_content') ? (
                              <button
                                type="button"
                                onClick={() => openContent(chat)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                              >
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                Leer
                              </button>
                            ) : null}
                            {canRequest ? (
                              <button
                                type="button"
                                onClick={() => setRequestTarget(chat)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
                              >
                                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                                Solicitar acceso
                              </button>
                            ) : null}
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
                Icon={MessageSquare}
                title="Sin chats para este filtro"
                description="Prueba con otro estado o limpia la búsqueda."
              />
            </div>
          )}
        </section>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs leading-6 text-slate-500 shadow-sm">
        <p className="flex items-center gap-2 font-semibold text-slate-700">
          <ShieldCheck className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
          Reglas de privacidad de esta pantalla
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Los metadatos exigen <code className="font-mono">chats.view_metadata</code>.</li>
          <li>Solicitar acceso exige <code className="font-mono">chats.request_access</code>.</li>
          <li>Aprobar, denegar o revocar exige <code className="font-mono">chats.grant_access</code>.</li>
          <li>Leer contenido exige <code className="font-mono">chats.access_content</code> y una autorización aprobada y vigente del propio actor.</li>
          <li>Cada lectura de contenido se registra en la auditoría.</li>
        </ul>
      </div>

      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Ficha del chat"
        description="Metadatos, estado y solicitudes de acceso. El contenido no se muestra aquí."
        size="lg"
      >
        {detailTarget ? (
          <ChatDetail
            chat={detailTarget}
            canGrantAccess={detailTarget.canGrantAccess}
            hasPermission={hasPermission}
            busy={busy}
            onRead={openContent}
            onDecide={(chat, request, decision) => {
              const config = DECISION_CONFIG[decision];
              setActionTarget({
                chat,
                request,
                decision,
                label: config.label,
                title: `${config.title} · ${chat.subject}`,
                reasons: config.reasons,
              });
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(contentTarget)}
        onClose={() => setContentTarget(null)}
        title={contentTarget?.subject ? `Contenido · ${contentTarget.subject}` : 'Contenido del chat'}
        description="Lectura excepcional autorizada y auditada. No compartas estos mensajes fuera del proceso."
        size="lg"
      >
        {contentTarget ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
              Acceso concedido hasta {formatDateTime(contentTarget.accessExpiresAt)}. Esta lectura
              quedó registrada en la auditoría con tu usuario.
            </div>
            {contentTarget.messages.length ? (
              <ul className="space-y-3">
                {contentTarget.messages.map((message) => (
                  <li
                    key={message.id}
                    className={`rounded-xl border px-3 py-2.5 ${
                      message.senderType === 'system'
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {message.senderName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{message.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                Icon={LockKeyhole}
                title="Conversación sin mensajes"
                description="La autorización existe, pero esta conversación no contiene mensajes."
              />
            )}
          </div>
        ) : null}
      </Modal>

      <ReasonDialog
        open={Boolean(requestTarget)}
        title={requestTarget ? `Solicitar acceso · ${requestTarget.subject}` : 'Solicitar acceso'}
        description="La solicitud se revisa por una persona con permiso de concesión. El acceso tiene vencimiento."
        reasons={CHAT_ACCESS_REASONS.request}
        confirmLabel="Enviar solicitud"
        tone="primary"
        busy={busy}
        onConfirm={confirmRequest}
        onClose={() => setRequestTarget(null)}
      />

      <ReasonDialog
        open={Boolean(actionTarget)}
        title={actionTarget?.title || 'Decidir acceso'}
        description={
          actionTarget
            ? `${actionTarget.request.requestedByName} solicitó acceso. La decisión queda auditada.`
            : ''
        }
        reasons={actionTarget?.reasons || []}
        confirmLabel={actionTarget?.label || 'Confirmar'}
        tone={actionTarget?.label?.startsWith('Denegar') || actionTarget?.label?.startsWith('Revocar') ? 'danger' : 'primary'}
        busy={busy}
        onConfirm={confirmDecision}
        onClose={() => setActionTarget(null)}
      />
    </div>
  );
}
