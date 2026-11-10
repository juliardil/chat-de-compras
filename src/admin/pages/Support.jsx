import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Check,
  Clock,
  Eye,
  LifeBuoy,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  UserCheck,
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
  SUPPORT_PRIORITIES,
  SUPPORT_STATUS_OPTIONS,
  SUPPORT_STATUS_REASONS,
  SUPPORT_TRANSITIONS,
  supportActionKey,
  supportStatusLabel,
  supportStatusPermission,
} from '../constants/phase4';
import { formatDateTime, formatRelative } from '../utils/format';

const ACTION_ICONS = {
  'support.resolve': Check,
  'support.close': Check,
  'support.reopen': Clock,
  'support.status': MessageSquare,
};

function buildActions(ticket, hasPermission) {
  return (SUPPORT_TRANSITIONS[ticket.status] || [])
    .map((to) => {
      const key = supportActionKey(ticket.status, to);
      return {
        key: `${ticket.status}-${to}`,
        to,
        label: supportStatusLabel(to),
        permission: supportStatusPermission(to),
        tone: to === 'resolved' || to === 'closed' ? 'primary' : 'danger',
        reasons: SUPPORT_STATUS_REASONS[to] || [],
        title: `${supportStatusLabel(to)} · ${ticket.ticketNumber}`,
        description: 'La acción exige un motivo y queda registrada en la auditoría.',
        successTitle: 'Ticket actualizado',
        Icon: ACTION_ICONS[key] || MessageSquare,
      };
    })
    .filter((action) => hasPermission(action.permission));
}

function TicketDetail({ ticket, session, hasPermission, busy, onAction, onReply, onAssign }) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);

  useEffect(() => {
    setBody('');
    setInternal(false);
  }, [ticket.id]);

  const canReply = hasPermission('support.reply') && ticket.status !== 'closed';
  const canAssign =
    hasPermission('support.assign') &&
    ticket.status !== 'closed' &&
    ticket.assignedToId !== session?.memberId;
  const actions = buildActions(ticket, hasPermission);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
            {ticket.priorityLabel}
          </span>
          {ticket.isOverdue ? (
            <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
              Fuera de plazo
            </span>
          ) : null}
          <span className="text-xs font-semibold text-slate-500">{ticket.categoryLabel}</span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">{ticket.subject}</p>
        <p className="mt-1 text-xs text-slate-500">
          {ticket.ticketNumber} · {ticket.requesterName} ({ticket.requesterType})
          {ticket.orderNumber ? ` · ${ticket.orderNumber}` : ''}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Descripción</p>
        <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
          {ticket.description}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Asignado a</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{ticket.assignedToName || 'Sin asignar'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vence</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(ticket.dueAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Creado</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(ticket.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Actualizado</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatRelative(ticket.updatedAt)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        {canAssign ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAssign(ticket)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
          >
            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Asignarme el ticket
          </button>
        ) : null}
        {actions.map((action) => {
          const Icon = action.Icon;
          return (
            <button
              key={action.key}
              type="button"
              disabled={busy}
              onClick={() => onAction(ticket, action)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                action.tone === 'danger'
                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {action.label}
            </button>
          );
        })}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Conversación ({ticket.messageCount})
        </p>
        <ul className="mt-2 space-y-2">
          {(ticket.messages || []).map((message) => (
            <li
              key={message.id}
              className={`rounded-xl border px-3 py-2.5 ${
                message.internal
                  ? 'border-amber-200 bg-amber-50'
                  : message.authorType === 'support'
                    ? 'border-sky-100 bg-sky-50'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  {message.authorName}
                  {message.internal ? ' · nota interna' : ''}
                </span>
                <span className="text-[11px] text-slate-400">
                  {formatDateTime(message.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-700">{message.body}</p>
            </li>
          ))}
        </ul>
      </div>

      {canReply ? (
        <div className="rounded-xl border border-slate-200 p-3">
          <label htmlFor="support-reply" className="text-sm font-medium text-slate-700">
            Responder
          </label>
          <textarea
            id="support-reply"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Respuesta pública o nota interna para el equipo"
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={internal}
                onChange={(event) => setInternal(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#4B227A] focus:ring-[#4B227A]/30"
              />
              Nota interna (no visible para el usuario)
            </label>
            <button
              type="button"
              disabled={busy || !body.trim()}
              onClick={() => onReply(ticket, { body, internal })}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4B227A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3A1A5E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {busy ? 'Enviando…' : 'Enviar respuesta'}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            La respuesta queda registrada en la auditoría. No existe proveedor de correo: el mensaje
            solo se guarda en esta conversación de demostración.
          </p>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Motivo del estado
        </p>
        <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
          {ticket.statusReason || 'Sin motivo registrado.'}
        </p>
      </div>
    </div>
  );
}

export default function Support() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({ loading: true, error: null, tickets: [] });
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [detailTarget, setDetailTarget] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const tickets = await adminRepository.listSupportTickets({ actor: session });
      setState({ loading: false, error: null, tickets });
    } catch (error) {
      setState({ loading: false, error: error.message, tickets: [] });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const tickets = await adminRepository.listSupportTickets({ actor: session });
        if (!cancelled) setState({ loading: false, error: null, tickets });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, tickets: [] });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.tickets.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
      if (!term) return true;
      return [ticket.ticketNumber, ticket.subject, ticket.requesterName, ticket.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.tickets, search, statusFilter, priorityFilter]);

  const openDetail = async (ticket) => {
    setDetailTarget(ticket);
    try {
      const detail = await adminRepository.getSupportTicket({ ticketId: ticket.id, actor: session });
      setDetailTarget(detail);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cargar el ticket', description: error.message });
    }
  };

  const confirmAction = async ({ reason, detail }) => {
    if (!actionTarget) return;

    const label = actionTarget.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setBusy(true);
    try {
      await adminRepository.updateSupportStatus({
        ticketId: actionTarget.ticket.id,
        status: actionTarget.to,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: actionTarget.successTitle,
        description: `${actionTarget.ticket.ticketNumber} · ${label}`,
      });
      setActionTarget(null);
      await refresh();
      await openDetail(actionTarget.ticket);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo actualizar el ticket', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  const assignToMe = async (ticket) => {
    setBusy(true);
    try {
      await adminRepository.assignSupportTicket({
        ticketId: ticket.id,
        reason: 'Asignación manual desde la bandeja de soporte',
        actor: session,
      });
      notify({
        title: 'Ticket asignado',
        description: `${ticket.ticketNumber} · ${session?.name || 'tu usuario'}`,
      });
      await refresh();
      if (detailTarget?.id === ticket.id) await openDetail(ticket);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo asignar el ticket', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  const reply = async (ticket, payload) => {
    setBusy(true);
    try {
      await adminRepository.replySupportTicket({
        ticketId: ticket.id,
        body: payload.body,
        internal: payload.internal,
        actor: session,
      });
      notify({
        title: payload.internal ? 'Nota interna registrada' : 'Respuesta registrada',
        description: `${ticket.ticketNumber} · guardada en la conversación de demostración`,
      });
      await refresh();
      await openDetail(ticket);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo responder', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Atención"
        title="Soporte"
        description="Atiende tickets de compradores y comercios, asigna responsables, responde y cierra casos con trazabilidad."
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Soporte de demostración">
          Los tickets, mensajes y respuestas son ejemplos guardados en este navegador. No hay envío
          real de correo ni integración con una mesa de ayuda externa.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando tickets…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar los tickets">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <LifeBuoy className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
              Bandeja de soporte
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
                  placeholder="Buscar ticket, asunto o solicitante…"
                  aria-label="Buscar tickets"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filtrar tickets por estado"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todos los estados</option>
                {SUPPORT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                aria-label="Filtrar tickets por prioridad"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todas las prioridades</option>
                {SUPPORT_PRIORITIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Ticket</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Solicitante</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Categoría</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Prioridad</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Asignado</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Actualizado</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => openDetail(ticket)}
                          className="block max-w-xs truncate text-left text-sm font-semibold text-slate-900 hover:text-[#4B227A] hover:underline"
                        >
                          {ticket.subject}
                        </button>
                        <p className="truncate text-xs text-slate-500">
                          {ticket.ticketNumber} · {ticket.messageCount} mensaje(s)
                          {ticket.orderNumber ? ` · ${ticket.orderNumber}` : ''}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {ticket.requesterName}
                        <p className="text-xs text-slate-500">{ticket.requesterType}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{ticket.categoryLabel}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{ticket.priorityLabel}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={ticket.status} />
                          {ticket.isOverdue ? (
                            <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
                              Fuera de plazo
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {ticket.assignedToName || 'Sin asignar'}
                      </td>
                      <td
                        className="px-5 py-3.5 text-sm text-slate-600"
                        title={formatDateTime(ticket.updatedAt)}
                      >
                        {formatRelative(ticket.updatedAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openDetail(ticket)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            Ficha
                          </button>
                          {hasPermission('support.assign') &&
                          ticket.status !== 'closed' &&
                          ticket.assignedToId !== session?.memberId ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => assignToMe(ticket)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
                            >
                              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              Asignarme
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
                Icon={LifeBuoy}
                title="Sin tickets para este filtro"
                description="Prueba con otro estado, otra prioridad o limpia la búsqueda."
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
          <li>Ver tickets exige <code className="font-mono">support.view</code>.</li>
          <li>Asignar exige <code className="font-mono">support.assign</code>.</li>
          <li>Responder o cambiar el estado operativo exige <code className="font-mono">support.reply</code>.</li>
          <li>Resolver o cerrar exige <code className="font-mono">support.close</code>.</li>
          <li>Las respuestas y notas internas se guardan en la conversación; no hay envío de correo real.</li>
        </ul>
      </div>

      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Ficha del ticket"
        description="Solicitud, conversación, asignación y estado."
        size="lg"
      >
        {detailTarget ? (
          <TicketDetail
            ticket={detailTarget}
            session={session}
            hasPermission={hasPermission}
            busy={busy}
            onAction={(ticket, action) => setActionTarget({ ...action, ticket })}
            onReply={reply}
            onAssign={assignToMe}
          />
        ) : null}
      </Modal>

      <ReasonDialog
        open={Boolean(actionTarget)}
        title={actionTarget?.title || 'Actualizar ticket'}
        description={actionTarget ? `${actionTarget.ticket.ticketNumber}. ${actionTarget.description}` : ''}
        reasons={actionTarget?.reasons || []}
        confirmLabel={actionTarget?.label || 'Confirmar'}
        tone={actionTarget?.tone || 'danger'}
        busy={busy}
        onConfirm={confirmAction}
        onClose={() => setActionTarget(null)}
      />
    </div>
  );
}
