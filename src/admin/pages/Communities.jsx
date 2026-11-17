import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Search, Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useToast } from '../components/useToast';
import { useAdminAuth } from '../auth/useAdminAuth';
import { adminRepository } from '../data';
import { formatDateTime } from '../utils/format';

// Panel de clubes de compradores: listado, auditoría de miembros y regla global
// del mínimo de participantes. Solo usa los RPC del módulo de comunidades.
export default function Communities() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const canConfigure = hasPermission('communities.configure');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const [settings, setSettings] = useState({ minMembers: 5, updatedAt: null });
  const [search, setSearch] = useState('');

  const [minDraft, setMinDraft] = useState('5');
  const [configError, setConfigError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [auditGroup, setAuditGroup] = useState(null);
  const [auditMembers, setAuditMembers] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [list, config] = await Promise.all([
        adminRepository.listGroups({ actor: session }),
        adminRepository.getGroupSettings({ actor: session }),
      ]);
      setGroups(Array.isArray(list) ? list : []);
      setSettings(config || { minMembers: 5, updatedAt: null });
      setMinDraft(String(config?.minMembers ?? 5));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((group) =>
      [group.name, group.inviteCode, group.ownerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [groups, search]);

  const handleSaveMinimum = async (event) => {
    event.preventDefault();
    const value = Number(minDraft);
    if (!Number.isInteger(value) || value < 1 || value > 1000) {
      setConfigError('El mínimo debe ser un número entero entre 1 y 1000.');
      return;
    }

    setSaving(true);
    setConfigError(null);
    try {
      const updated = await adminRepository.setGroupMinMembers({
        minMembers: value,
        actor: session,
      });
      setSettings((previous) => ({
        minMembers: updated?.minMembers ?? value,
        updatedAt: updated?.updatedAt ?? previous?.updatedAt ?? null,
      }));
      notify({
        tone: 'success',
        title: 'Mínimo actualizado',
        description: `Ahora un club necesita ${updated?.minMembers ?? value} miembros para considerarse verificado.`,
      });
      await refresh();
    } catch (err) {
      setConfigError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openAudit = async (group) => {
    setAuditGroup(group);
    setAuditMembers([]);
    setAuditError(null);
    setAuditLoading(true);
    try {
      const detail = await adminRepository.getGroup({ groupId: group.id, actor: session });
      setAuditMembers(Array.isArray(detail?.members) ? detail.members : []);
    } catch (err) {
      setAuditError(err.message);
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fase 4 · Confianza"
        title="Comunidades"
        description={
          mode === 'demo'
            ? 'Clubes de demostración: listado, miembros y regla mínima de participantes.'
            : 'Clubes creados por compradores, auditoría de miembros y regla mínima de participantes.'
        }
      />

      {error ? (
        <Alert tone="danger" title="No se pudieron cargar los clubes">
          {error}
        </Alert>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Mínimo de participantes</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Un club se considera verificado cuando alcanza este número de miembros. La regla
              aplica a todos los clubes y a la insignia que ven los comercios.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Última actualización: {formatDateTime(settings.updatedAt)}
            </p>
          </div>

          <form onSubmit={handleSaveMinimum} className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Miembros requeridos</span>
              <input
                type="number"
                min="1"
                max="1000"
                value={minDraft}
                onChange={(event) => setMinDraft(event.target.value)}
                disabled={!canConfigure || saving}
                aria-label="Mínimo de participantes"
                className="mt-1 w-28 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              />
            </label>
            <button
              type="submit"
              disabled={!canConfigure || saving}
              className="rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar regla'}
            </button>
          </form>
        </div>

        {configError ? (
          <div className="mt-3">
            <Alert tone="danger" title="No se pudo guardar">
              {configError}
            </Alert>
          </div>
        ) : null}
        {!canConfigure ? (
          <p className="mt-3 text-xs text-slate-400">
            Tu rol solo tiene permiso de lectura sobre esta regla.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#4B227A]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">Clubes registrados</h2>
          </div>
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Buscar club</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, código o creador"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
            />
          </label>
        </div>

        {loading ? (
          <div className="p-6">
            <Spinner label="Cargando clubes…" />
          </div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              Icon={ClipboardList}
              title="No hay clubes para mostrar"
              description={
                search.trim()
                  ? 'Prueba con otro nombre, código de invitación o creador.'
                  : 'Todavía no se ha creado ningún club de compradores.'
              }
            />
          </div>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Club</th>
                  <th className="px-5 py-3 font-semibold">Código</th>
                  <th className="px-5 py-3 font-semibold">Creador</th>
                  <th className="px-5 py-3 font-semibold">Miembros</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 font-semibold">Creado</th>
                  <th className="px-5 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((group) => (
                  <tr key={group.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-medium text-slate-900">{group.name}</td>
                    <td className="px-5 py-3">
                      <code className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-[#4B227A]">
                        {group.inviteCode}
                      </code>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{group.ownerName || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {group.memberCount} / {group.minMembers}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
                          group.isVerified
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-amber-50 text-amber-700 ring-amber-200'
                        }`}
                      >
                        {group.isVerified ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Verificado
                          </>
                        ) : (
                          'En progreso'
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {formatDateTime(group.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openAudit(group)}
                        className="rounded-lg border border-[#4B227A]/20 px-3 py-1.5 text-xs font-semibold text-[#4B227A] transition hover:bg-[#4B227A]/5"
                      >
                        Auditar miembros
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <Modal
        open={Boolean(auditGroup)}
        onClose={() => setAuditGroup(null)}
        title={auditGroup ? `Miembros de ${auditGroup.name}` : 'Miembros del club'}
        description={auditGroup ? `Código de invitación: ${auditGroup.inviteCode}` : undefined}
        size="lg"
        footer={
          <button
            type="button"
            onClick={() => setAuditGroup(null)}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cerrar
          </button>
        }
      >
        {auditLoading ? <Spinner label="Cargando miembros…" /> : null}
        {!auditLoading && auditError ? (
          <Alert tone="danger" title="No se pudo auditar el club">
            {auditError}
          </Alert>
        ) : null}
        {!auditLoading && !auditError && auditMembers.length === 0 ? (
          <EmptyState Icon={Users} title="Sin miembros" description="Este club no tiene miembros registrados." />
        ) : null}
        {!auditLoading && !auditError && auditMembers.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Miembro</th>
                  <th className="px-4 py-2.5 font-semibold">Correo</th>
                  <th className="px-4 py-2.5 font-semibold">Rol</th>
                  <th className="px-4 py-2.5 font-semibold">Ingreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditMembers.map((member) => (
                  <tr key={member.userId || member.displayName}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {member.displayName || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{member.email || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {member.role === 'owner' ? 'Dueño' : 'Miembro'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {formatDateTime(member.joinedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
