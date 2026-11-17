import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  ClipboardList,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useToast } from '../components/useToast';
import { useAdminAuth } from '../auth/useAdminAuth';
import { adminRepository } from '../data';
import { formatDateTime } from '../utils/format';

// Panel de Talleres Verificados. Solo consume las RPC seguras del módulo:
// admin_list_workshops y admin_set_workshop_verification (que audita el cambio).
export default function Workshops() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const canVerify = hasPermission('workshops.verify');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workshops, setWorkshops] = useState([]);
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const list = await adminRepository.listWorkshops({
        search: '',
        actor: session,
      });
      setWorkshops(Array.isArray(list) ? list : []);
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
    if (!term) return workshops;
    return workshops.filter((workshop) =>
      [
        workshop.workshopName,
        workshop.nitOrId,
        workshop.address,
        workshop.phone,
        workshop.ownerName,
        ...(Array.isArray(workshop.specialties) ? workshop.specialties : []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [workshops, search]);

  const verifiedCount = workshops.filter((workshop) => workshop.isVerified).length;

  const confirmVerification = async () => {
    if (!confirming || saving) return;
    const target = confirming;
    const nextValue = !target.isVerified;

    setSaving(true);
    setActionError(null);
    try {
      const updated = await adminRepository.setWorkshopVerification({
        workshopId: target.id,
        isVerified: nextValue,
        actor: session,
      });
      setWorkshops((current) =>
        current.map((workshop) =>
          workshop.id === target.id
            ? { ...workshop, ...updated, isVerified: Boolean(updated?.isVerified ?? nextValue) }
            : workshop
        )
      );
      notify({
        tone: 'success',
        title: nextValue ? 'Taller activado' : 'Verificación revocada',
        description: `${updated?.workshopName || target.workshopName} ${nextValue ? 'ya aparece como Taller Verificado.' : 'ya no aparece como Taller Verificado.'}`,
      });
      setConfirming(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fase 4 · Talleres"
        title="Talleres Verificados"
        description={
          mode === 'demo'
            ? 'Registros de demostración: revisa la credencial y activa o revoca talleres de ejemplo.'
            : 'Revisa los talleres registrados y gestiona su credencial verificada de forma auditada.'
        }
      />

      {error ? (
        <Alert tone="danger" title="No se pudieron cargar los talleres">
          {error}
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Talleres registrados</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{workshops.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Verificados</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800">{verifiedCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pendientes de verificación</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{workshops.length - verifiedCount}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-[#4B227A]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">Registro de talleres</h2>
          </div>
          <label className="relative block w-full sm:w-80">
            <span className="sr-only">Buscar taller</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, NIT, dirección o especialidad"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
            />
          </label>
        </div>

        {loading ? (
          <div className="p-6">
            <Spinner label="Cargando talleres…" />
          </div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              Icon={ClipboardList}
              title="No hay talleres para mostrar"
              description={
                search.trim()
                  ? 'Prueba con otro nombre, NIT/Cédula, dirección o especialidad.'
                  : 'Todavía no hay talleres registrados en el sistema.'
              }
            />
          </div>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1024px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Taller</th>
                  <th className="px-5 py-3 font-semibold">NIT / Cédula</th>
                  <th className="px-5 py-3 font-semibold">Dirección</th>
                  <th className="px-5 py-3 font-semibold">Teléfono</th>
                  <th className="px-5 py-3 font-semibold">Especialidades</th>
                  <th className="px-5 py-3 font-semibold">Verificación</th>
                  <th className="px-5 py-3 font-semibold">Fecha</th>
                  <th className="px-5 py-3 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((workshop) => (
                  <tr key={workshop.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{workshop.workshopName}</p>
                      <p className="text-xs text-slate-500">{workshop.ownerName || '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <code className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-[#4B227A]">
                        {workshop.nitOrId || '—'}
                      </code>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      <span className="inline-flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        {workshop.address || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        {workshop.phone || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(workshop.specialties) ? workshop.specialties : []).length ? (
                          workshop.specialties.map((specialty) => (
                            <span
                              key={specialty}
                              className="rounded-full bg-[#4B227A]/10 px-2 py-0.5 text-[11px] font-medium text-[#4B227A]"
                            >
                              {specialty}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
                          workshop.isVerified
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-amber-50 text-amber-700 ring-amber-200'
                        }`}
                      >
                        {workshop.isVerified ? (
                          <>
                            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verificado
                          </>
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {workshop.isVerified ? '' : ' Sin verificar'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {formatDateTime(workshop.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        disabled={!canVerify || saving}
                        onClick={() => {
                          setActionError(null);
                          setConfirming(workshop);
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          workshop.isVerified
                            ? 'border border-red-200 text-red-700 hover:bg-red-50'
                            : 'bg-[#4B227A] text-white hover:bg-[#3A1A5E]'
                        }`}
                      >
                        {workshop.isVerified ? 'Revocar verificación' : 'Activar verificación'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {actionError ? (
        <Alert tone="danger" title="No se pudo actualizar el taller">
          {actionError}
        </Alert>
      ) : null}

      <Modal
        open={Boolean(confirming)}
        onClose={() => (saving ? null : setConfirming(null))}
        title={confirming?.isVerified ? 'Revocar verificación' : 'Activar verificación'}
        description="Esta acción se registra en la auditoría administrativa."
        footer={
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirming(null)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={confirmVerification}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${
                confirming?.isVerified ? 'bg-red-600 hover:bg-red-700' : 'bg-[#4B227A] hover:bg-[#3A1A5E]'
              }`}
            >
              {saving
                ? 'Guardando…'
                : confirming?.isVerified
                  ? 'Sí, revocar'
                  : 'Sí, activar'}
            </button>
          </>
        }
      >
        {confirming ? (
          <p className="text-sm leading-6 text-slate-600">
            {confirming.isVerified
              ? `El taller «${confirming.workshopName}» dejará de aparecer como Taller Verificado. Sus propuestas activas no se eliminarán.`
              : `El taller «${confirming.workshopName}» podrá consultar trabajos disponibles, enviar propuestas y mostrar su credencial a los vendedores.`}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
