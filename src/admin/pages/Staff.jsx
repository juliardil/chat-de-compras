import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MailPlus,
  ShieldCheck,
  UserCheck,
  UserPlus,
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
import {
  getPermissionsForRole,
  groupPermissionsByModule,
  ROLE_BY_KEY,
  ROLES,
} from '../auth/permissions';
import { formatDate, formatRelative, initials } from '../utils/format';

const SUSPEND_REASONS = [
  { value: 'security', label: 'Motivo de seguridad' },
  { value: 'policy', label: 'Incumplimiento de políticas internas' },
  { value: 'role_change', label: 'Cambio de rol o responsabilidades' },
  { value: 'request', label: 'Solicitud del propio miembro' },
  { value: 'other', label: 'Otro motivo' },
];

const REACTIVATE_REASONS = [
  { value: 'reviewed', label: 'Revisión completada' },
  { value: 'error', label: 'Suspensión por error' },
  { value: 'request', label: 'Solicitud del propio miembro' },
  { value: 'other', label: 'Otro motivo' },
];

function MemberRow({ member, canUpdate, isSelf, onSuspend, onReactivate }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4B227A]/10 text-xs font-bold text-[#4B227A]">
            {initials(member.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {member.name}
              {isSelf ? <span className="ml-2 text-[11px] font-medium text-slate-400">(tú)</span> : null}
            </p>
            <p className="truncate text-xs text-slate-500">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="text-sm text-slate-700">{member.roleName}</div>
        <div className="text-xs text-slate-400">
          {member.permissionsCount ? `${member.permissionsCount} permisos` : 'Permisos en servidor'}
        </div>
      </td>
      <td className="px-5 py-3.5">
        <StatusBadge status={member.status} />
      </td>
      <td className="px-5 py-3.5">
        <span className="text-sm text-slate-600" title={formatDate(member.lastLoginAt)}>
          {formatRelative(member.lastLoginAt)}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right">
        {canUpdate && !isSelf ? (
          member.status === 'active' ? (
            <button
              type="button"
              onClick={() => onSuspend(member)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              <UserX className="h-3.5 w-3.5" aria-hidden="true" />
              Suspender
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onReactivate(member)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Reactivar
            </button>
          )
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}

export default function Staff() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [tab, setTab] = useState('members');
  const [state, setState] = useState({ loading: true, error: null, members: [], invitations: [] });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', roleKey: 'analyst' });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [selectedRole, setSelectedRole] = useState('superadmin');

  const canInvite = hasPermission('staff.invite');
  const canUpdate = hasPermission('staff.update');

  const fetchData = useCallback(async () => {
    const [members, invitations] = await Promise.all([
      adminRepository.listMembers(),
      adminRepository.listInvitations(),
    ]);
    return { members, invitations };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const data = await fetchData();
        if (!cancelled) setState({ loading: false, error: null, ...data });
      } catch (error) {
        if (!cancelled) {
          setState({ loading: false, error: error.message, members: [], invitations: [] });
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const refresh = async () => {
    try {
      const data = await fetchData();
      setState({ loading: false, error: null, ...data });
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    }
  };

  const assignableRoles = useMemo(
    () => ROLES.filter((role) => role.key !== 'superadmin' || session?.roleKey === 'superadmin'),
    [session]
  );

  const roleGroups = useMemo(
    () => groupPermissionsByModule(getPermissionsForRole(selectedRole)),
    [selectedRole]
  );

  const submitInvite = async (event) => {
    event.preventDefault();
    setInviteError(null);
    setInviteBusy(true);
    try {
      await adminRepository.inviteMember({ ...inviteForm, actor: session });
      notify({
        title: 'Invitación registrada',
        description:
          mode === 'demo'
            ? 'En demostración se guarda en este navegador. El envío de correo se habilitará con InsForge Messaging.'
            : 'La invitación quedó registrada. El envío de correo requiere configurar Messaging.',
      });
      setInviteOpen(false);
      setInviteForm({ email: '', name: '', roleKey: 'analyst' });
      refresh();
    } catch (error) {
      setInviteError(error.message);
    } finally {
      setInviteBusy(false);
    }
  };

  const confirmStatusChange = async ({ reason, detail }) => {
    if (!actionTarget) return;
    const nextStatus = actionTarget.status === 'active' ? 'suspended' : 'active';
    setActionBusy(true);
    try {
      await adminRepository.setMemberStatus({
        memberId: actionTarget.id,
        status: nextStatus,
        reason: detail ? `${reason}: ${detail}` : reason,
        actor: session,
      });
      notify({
        title: nextStatus === 'suspended' ? 'Cuenta suspendida' : 'Cuenta reactivada',
        description: `${actionTarget.name} · ${actionTarget.email}`,
      });
      setActionTarget(null);
      refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cambiar el estado', description: error.message });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Personal y permisos"
        description="Administra quién entra al panel, con qué rol y en qué estado. Los permisos se validan en el servidor; esta pantalla solo refleja la política."
        actions={
          canInvite ? (
            <button
              type="button"
              onClick={() => {
                setInviteError(null);
                setInviteOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#3A1A5E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2E144A]"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invitar miembro
            </button>
          ) : null
        }
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Datos de demostración">
          Los miembros, invitaciones y cambios de estado viven en este navegador. La política de
          roles es la misma que se aplicará en el servidor, pero aquí no protege datos reales.
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('members')}
          className={`border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
            tab === 'members'
              ? 'border-[#4B227A] text-[#4B227A]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Miembros{state.members.length ? ` (${state.members.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setTab('roles')}
          className={`border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
            tab === 'roles'
              ? 'border-[#4B227A] text-[#4B227A]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Roles y permisos
        </button>
      </div>

      {state.loading ? <Spinner label="Cargando personal…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudo cargar el personal">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error && tab === 'members' ? (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Equipo administrativo</h2>
                <p className="mt-0.5 text-xs text-slate-500">Altas, roles y estado de las cuentas</p>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {state.members.filter((member) => member.status === 'active').length} activos
              </span>
            </div>

            {state.members.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                      <th scope="col" className="px-5 py-2.5 font-semibold">Persona</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Rol</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Último acceso</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.members.map((member) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        canUpdate={canUpdate}
                        isSelf={member.email === session?.email}
                        onSuspend={setActionTarget}
                        onReactivate={setActionTarget}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  Icon={Users}
                  title="No hay miembros administrativos"
                  description="Invita al primer miembro del equipo para comenzar."
                />
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Invitaciones</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Registro de altas pendientes. La aceptación y MFA se completan al conectar InsForge.
              </p>
            </div>

            {state.invitations.length ? (
              <ul className="divide-y divide-slate-100">
                {state.invitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <MailPlus className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{invitation.name}</p>
                        <p className="truncate text-xs text-slate-500">{invitation.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-medium text-slate-600">
                        {ROLE_BY_KEY[invitation.roleKey]?.name || invitation.roleKey}
                      </span>
                      <StatusBadge status={invitation.status} />
                      <span className="text-xs text-slate-400">{formatDate(invitation.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <EmptyState
                  Icon={MailPlus}
                  title="Sin invitaciones registradas"
                  description="Las invitaciones que crees aparecerán aquí con su estado."
                />
              </div>
            )}
          </section>
        </div>
      ) : null}

      {!state.loading && !state.error && tab === 'roles' ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Roles del sistema
            </p>
            <ul className="space-y-1">
              {ROLES.map((role) => (
                <li key={role.key}>
                  <button
                    type="button"
                    onClick={() => setSelectedRole(role.key)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                      selectedRole === role.key
                        ? 'bg-[#4B227A] text-white'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{role.name}</span>
                    <span
                      className={`mt-0.5 block text-[11px] ${
                        selectedRole === role.key ? 'text-white/70' : 'text-slate-500'
                      }`}
                    >
                      {getPermissionsForRole(role.key).length} permisos
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  {ROLE_BY_KEY[selectedRole]?.name}
                </h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  Rol del sistema
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {ROLE_BY_KEY[selectedRole]?.description}
              </p>
            </div>

            <div className="space-y-5 p-5">
              {roleGroups.map((group) => (
                <div key={group.module}>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-slate-800">{group.module}</h3>
                    <span className="text-xs text-slate-400">{group.permissions.length}</span>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {group.permissions.map((permission) => (
                      <li
                        key={permission.key}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                          permission.sensitive
                            ? 'bg-amber-50 text-amber-800 ring-amber-200'
                            : 'bg-slate-50 text-slate-700 ring-slate-200'
                        }`}
                        title={permission.key}
                      >
                        {permission.label}
                        {permission.sensitive ? ' · sensible' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                Los roles son fijos en la Fase 1. La edición de permisos por rol y los overrides
                individuales se incorporan en la Fase 5, con auditoría y aprobación.
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invitar a un miembro"
        description="La invitación queda registrada y auditada. El correo de aceptación requiere InsForge Messaging."
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="invite-form"
              disabled={inviteBusy}
              className="rounded-xl bg-[#3A1A5E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2E144A] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inviteBusy ? 'Registrando…' : 'Registrar invitación'}
            </button>
          </div>
        }
      >
        <form id="invite-form" className="space-y-4" onSubmit={submitInvite}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="invite-name" className="text-sm font-medium text-slate-700">
                Nombre
              </label>
              <input
                id="invite-name"
                value={inviteForm.name}
                onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nombre y apellidos"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              />
            </div>
            <div>
              <label htmlFor="invite-email" className="text-sm font-medium text-slate-700">
                Correo electrónico
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={inviteForm.email}
                onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="persona@empresa.com"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              />
            </div>
          </div>

          <div>
            <label htmlFor="invite-role" className="text-sm font-medium text-slate-700">
              Rol
            </label>
            <select
              id="invite-role"
              value={inviteForm.roleKey}
              onChange={(event) => setInviteForm((current) => ({ ...current, roleKey: event.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
            >
              {assignableRoles.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.name} · {getPermissionsForRole(role.key).length} permisos
                </option>
              ))}
            </select>
            {session?.roleKey !== 'superadmin' ? (
              <p className="mt-1.5 text-xs text-slate-500">
                Solo un superadministrador puede asignar el rol de superadministrador.
              </p>
            ) : null}
          </div>

          {inviteError ? (
            <Alert tone="danger" title="No se pudo registrar la invitación">
              {inviteError}
            </Alert>
          ) : null}
        </form>
      </Modal>

      <ReasonDialog
        open={Boolean(actionTarget)}
        title={actionTarget?.status === 'active' ? 'Suspender cuenta' : 'Reactivar cuenta'}
        description={
          actionTarget
            ? `${actionTarget.name} · ${actionTarget.email}. La acción requiere motivo y queda auditada.`
            : ''
        }
        reasons={actionTarget?.status === 'active' ? SUSPEND_REASONS : REACTIVATE_REASONS}
        confirmLabel={actionTarget?.status === 'active' ? 'Suspender cuenta' : 'Reactivar cuenta'}
        tone={actionTarget?.status === 'active' ? 'danger' : 'primary'}
        busy={actionBusy}
        onConfirm={confirmStatusChange}
        onClose={() => setActionTarget(null)}
      />
    </div>
  );
}
