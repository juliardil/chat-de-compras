import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  CalendarDays,
  Handshake,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import KpiCard from '../components/KpiCard';
import { useToast } from '../components/useToast';
import { useAdminAuth } from '../auth/useAdminAuth';
import { adminRepository } from '../data';
import { formatDate } from '../utils/format';
import {
  BILLING_CYCLE_LABELS,
  SPONSORSHIP_FILTERS,
  formatSponsorAmount,
  lifecycleLabel,
  lifecycleStyle,
} from '../constants/sponsorships';

const EMPTY_RATE = {
  id: null,
  code: '',
  name: '',
  amount: '',
  currency: 'MXN',
  billingCycle: 'monthly',
  description: '',
  isActive: true,
};

const EMPTY_SPONSOR = {
  id: null,
  groupId: '',
  brandName: '',
  logoUrl: '',
  benefit: '',
  discountPercent: 0,
  contactEmail: '',
  commerceId: '',
  workshopId: '',
  rateId: '',
  amount: '',
  currency: 'MXN',
  billingCycle: 'monthly',
  startsOn: '',
  endsOn: '',
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15';

const labelClass = 'block text-xs font-semibold text-slate-600';

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${lifecycleStyle(status)}`}
    >
      {lifecycleLabel(status)}
    </span>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`${labelClass} ${className}`}>
      <span>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// Panel integral de patrocinios: tarifas, vigencia, aprobación y rendimiento.
// Todas las escrituras pasan por RPCs auditadas en servidor (o por el
// repositorio demo, que también registra auditoría local).
export default function Sponsorships() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const canManage = hasPermission('sponsorships.manage');
  const canFinance = hasPermission('sponsorships.finance');

  const [tab, setTab] = useState('brands');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [rates, setRates] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [overview, setOverview] = useState(null);
  const [impact, setImpact] = useState([]);
  const [groups, setGroups] = useState([]);
  const [commerces, setCommerces] = useState([]);
  const [workshops, setWorkshops] = useState([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rateForm, setRateForm] = useState(EMPTY_RATE);
  const [sponsorForm, setSponsorForm] = useState(EMPTY_SPONSOR);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [sponsorModalOpen, setSponsorModalOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const confirmModalOpen = Boolean(confirming);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ratesData, sponsorsData, overviewData, impactData] = await Promise.all([
        adminRepository.listSponsorshipRates({ actor: session }),
        adminRepository.listClubSponsors({ actor: session }),
        canFinance
          ? adminRepository.getSponsorshipOverview({ actor: session })
          : Promise.resolve(null),
        canFinance
          ? adminRepository.getSponsorImpactReport({ actor: session })
          : Promise.resolve([]),
      ]);

      setRates(Array.isArray(ratesData) ? ratesData : []);
      setSponsors(Array.isArray(sponsorsData) ? sponsorsData : []);
      setOverview(overviewData || null);
      setImpact(Array.isArray(impactData) ? impactData : []);

      const safeList = (request) => request.catch(() => []);
      const [groupsData, commercesData, workshopsData] = await Promise.all([
        safeList(adminRepository.listGroups({ actor: session })),
        safeList(adminRepository.listCommerces({ actor: session })),
        safeList(adminRepository.listWorkshops({ actor: session })),
      ]);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setCommerces(Array.isArray(commercesData) ? commercesData : []);
      setWorkshops(Array.isArray(workshopsData) ? workshopsData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, canFinance]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredSponsors = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sponsors.filter((sponsor) => {
      const matchesStatus =
        statusFilter === 'all'
          || sponsor.moderationStatus === statusFilter
          || sponsor.lifecycleStatus === statusFilter;
      if (!matchesStatus) return false;
      if (!term) return true;
      return [sponsor.brandName, sponsor.groupName, sponsor.contactEmail, sponsor.benefit]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [sponsors, search, statusFilter]);

  const closeRateForm = () => {
    setRateForm(EMPTY_RATE);
    setRateModalOpen(false);
  };

  const closeSponsorForm = () => {
    setSponsorForm(EMPTY_SPONSOR);
    setSponsorModalOpen(false);
  };

  const openRateForm = (rate) => {
    setActionError(null);
    setRateForm(rate ? { ...rate, amount: String(rate.amount ?? '') } : EMPTY_RATE);
    setRateModalOpen(true);
  };

  const openSponsorForm = (sponsor) => {
    setActionError(null);
    if (!sponsor) {
      setSponsorForm(EMPTY_SPONSOR);
      setSponsorModalOpen(true);
      return;
    }
    setSponsorForm({
      id: sponsor.id,
      groupId: sponsor.groupId || '',
      brandName: sponsor.brandName || '',
      logoUrl: sponsor.logoUrl || '',
      benefit: sponsor.benefit || '',
      discountPercent: Number(sponsor.discountPercent || 0),
      contactEmail: sponsor.contactEmail || '',
      commerceId: sponsor.commerceId || '',
      workshopId: sponsor.workshopId || '',
      rateId: sponsor.rateId || '',
      amount: String(sponsor.amount ?? ''),
      currency: sponsor.currency || 'MXN',
      billingCycle: sponsor.billingCycle || 'monthly',
      startsOn: sponsor.startsOn || '',
      endsOn: sponsor.endsOn || '',
    });
    setSponsorModalOpen(true);
  };

  const saveRate = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setActionError(null);
    try {
      await adminRepository.saveSponsorshipRate({
        ...rateForm,
        amount: Number(rateForm.amount),
        actor: session,
      });
      notify({
        tone: 'success',
        title: rateForm.id ? 'Tarifa actualizada' : 'Tarifa creada',
        description: `${rateForm.name} quedó guardada en el catálogo de patrocinios.`,
      });
      closeRateForm();
      await refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveSponsor = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setActionError(null);
    try {
      await adminRepository.saveClubSponsor({
        ...sponsorForm,
        amount: Number(sponsorForm.amount),
        discountPercent: Number(sponsorForm.discountPercent),
        actor: session,
      });
      notify({
        tone: 'success',
        title: sponsorForm.id ? 'Patrocinio actualizado' : 'Marca registrada',
        description: `${sponsorForm.brandName} queda pendiente de aprobación si es una marca nueva.`,
      });
      closeSponsorForm();
      await refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmStatus = async () => {
    if (!confirming || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      const updated = await adminRepository.setClubSponsorStatus({
        id: confirming.sponsor.id,
        status: confirming.status,
        reason: confirming.reason || '',
        actor: session,
      });
      notify({
        tone: confirming.status === 'rejected' ? 'warning' : 'success',
        title: confirming.status === 'approved' ? 'Marca aprobada' : 'Marca rechazada',
        description: `${updated?.brandName || confirming.sponsor.brandName} ahora aparece como ${lifecycleLabel(updated?.lifecycleStatus || confirming.status).toLowerCase()}.`,
      });
      setConfirming(null);
      await refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: 'brands', label: 'Marcas y vigencias', Icon: Handshake },
    { key: 'rates', label: 'Tarifas', Icon: BadgeDollarSign },
    ...(canFinance ? [{ key: 'impact', label: 'Finanzas e impacto', Icon: TrendingUp }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fase 5 · Crecimiento"
        title="Patrocinios de clubes"
        description={
          mode === 'demo'
            ? 'Datos de demostración: configura tarifas, aprueba marcas y revisa el impacto comercial simulado.'
            : 'Define tarifas, controla vigencias, aprueba marcas y supervisa los ingresos y su impacto en los clubes.'
        }
      />

      {error ? (
        <Alert tone="danger" title="No se pudo cargar el módulo de patrocinios">
          {error}
        </Alert>
      ) : null}

      {actionError && !rateModalOpen && !sponsorModalOpen && !confirmModalOpen ? (
        <Alert tone="danger" title="No se pudo completar la operación">
          {actionError}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones de patrocinios">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setActionError(null);
              setTab(key);
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              tab === key
                ? 'bg-[#4B227A] text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <Spinner label="Cargando patrocinios…" />
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Marcas y vigencias                                                  */}
      {/* ------------------------------------------------------------------ */}
      {!loading && tab === 'brands' ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Marcas patrocinadoras</h2>
              <p className="mt-1 text-xs text-slate-500">
                Aprobación, beneficios y vigencia de los patrocinios publicados en los clubes.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block sm:w-64">
                <span className="sr-only">Buscar marca</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar marca o club"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
                />
              </label>
              <select
                aria-label="Filtrar por estado"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#4B227A]"
              >
                {SPONSORSHIP_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => openSponsorForm(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Nueva marca
                </button>
              ) : null}
            </div>
          </div>

          {filteredSponsors.length === 0 ? (
            <div className="p-5">
              <EmptyState
                Icon={Handshake}
                title="No hay patrocinios para mostrar"
                description={
                  search || statusFilter !== 'all'
                    ? 'Prueba con otra búsqueda o cambia el filtro de estado.'
                    : 'Todavía no se registraron marcas patrocinadoras.'
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Marca</th>
                    <th className="px-5 py-3 font-semibold">Club</th>
                    <th className="px-5 py-3 font-semibold">Beneficio</th>
                    <th className="px-5 py-3 font-semibold">Costo</th>
                    <th className="px-5 py-3 font-semibold">Vigencia</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                    <th className="px-5 py-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSponsors.map((sponsor) => (
                    <tr key={sponsor.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#4B227A]/10 text-xs font-bold text-[#4B227A]">
                            {sponsor.logoUrl ? (
                              <img
                                src={sponsor.logoUrl}
                                alt={`Logo de ${sponsor.brandName}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              sponsor.brandName.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{sponsor.brandName}</p>
                            <p className="text-xs text-slate-500">
                              {sponsor.contactEmail || 'Sin contacto registrado'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{sponsor.groupName}</td>
                      <td className="px-5 py-3">
                        <p className="max-w-xs text-slate-600">{sponsor.benefit || '—'}</p>
                        {Number(sponsor.discountPercent) > 0 ? (
                          <p className="mt-0.5 text-[11px] font-semibold text-[#006E7A]">
                            {sponsor.discountPercent}% para miembros
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">
                          {formatSponsorAmount(sponsor.amount, sponsor.currency)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {BILLING_CYCLE_LABELS[sponsor.billingCycle] || sponsor.billingCycle}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                          {formatDate(sponsor.startsOn)} — {formatDate(sponsor.endsOn)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill status={sponsor.lifecycleStatus} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {canManage ? (
                            <>
                              {sponsor.moderationStatus !== 'approved' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionError(null);
                                    setConfirming({ sponsor, status: 'approved' });
                                  }}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                                >
                                  Aprobar
                                </button>
                              ) : null}
                              {sponsor.moderationStatus !== 'rejected' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionError(null);
                                    setConfirming({ sponsor, status: 'rejected' });
                                  }}
                                  className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                                >
                                  Rechazar
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openSponsorForm(sponsor)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                Editar
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">Solo lectura</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Tarifas                                                             */}
      {/* ------------------------------------------------------------------ */}
      {!loading && tab === 'rates' ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Tarifas de patrocinio</h2>
              <p className="mt-1 text-xs text-slate-500">
                Costos oficiales que se usan al registrar una marca en un club.
              </p>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={() => openRateForm(null)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Nueva tarifa
              </button>
            ) : null}
          </div>

          {rates.length === 0 ? (
            <div className="p-5">
              <EmptyState
                Icon={BadgeDollarSign}
                title="No hay tarifas configuradas"
                description="Crea la primera tarifa para empezar a gestionar patrocinios."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Tarifa</th>
                    <th className="px-5 py-3 font-semibold">Costo</th>
                    <th className="px-5 py-3 font-semibold">Ciclo</th>
                    <th className="px-5 py-3 font-semibold">Descripción</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                    <th className="px-5 py-3 font-semibold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{rate.name}</p>
                        <code className="text-xs text-slate-500">{rate.code}</code>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        {formatSponsorAmount(rate.amount, rate.currency)}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {BILLING_CYCLE_LABELS[rate.billingCycle] || rate.billingCycle}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{rate.description || '—'}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                            rate.isActive
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-slate-100 text-slate-600 ring-slate-200'
                          }`}
                        >
                          {rate.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => openRateForm(rate)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Editar
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Solo lectura</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Finanzas e impacto                                                  */}
      {/* ------------------------------------------------------------------ */}
      {!loading && tab === 'impact' && canFinance ? (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Ingresos mensuales"
              value={formatSponsorAmount(overview?.monthlyRevenue || 0)}
              hint="Patrocinios vigentes con ciclo mensual"
              Icon={BadgeDollarSign}
              tone="accent"
            />
            <KpiCard
              label="Ingresos por evento"
              value={formatSponsorAmount(overview?.oneTimeRevenue || 0)}
              hint="Rodadas y patrocinios de pago único"
              Icon={CalendarDays}
            />
            <KpiCard
              label="Total facturado"
              value={formatSponsorAmount(overview?.totalRevenue || 0)}
              hint="Incluye vigencias activas, Programadas y expiradas"
              Icon={TrendingUp}
            />
            <KpiCard
              label="Compras atribuidas"
              value={formatSponsorAmount(overview?.purchaseAmount || 0)}
              hint={`${overview?.ordersAttributed || 0} pedidos de ${overview?.buyersReached || 0} miembros`}
              Icon={Users}
              tone="accent"
            />
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Activas</p>
              <p className="mt-2 text-2xl font-bold text-emerald-800">{overview?.activeBrands || 0}</p>
            </div>
            <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-orange-700">Por vencer</p>
              <p className="mt-2 text-2xl font-bold text-orange-800">{overview?.expiringBrands || 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Clubes con patrocinio</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{overview?.groupsReached || 0}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-base font-semibold text-slate-900">Impacto comercial por marca</h2>
              <p className="mt-1 text-xs text-slate-500">
                Personas del club que compraron repuestos o contrataron servicios, y monto atribuido.
              </p>
            </div>
            {impact.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  Icon={TrendingUp}
                  title="Todavía no hay impacto registrado"
                  description="El impacto aparece cuando los miembros del club realizan compras con las marcas aprobadas."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Marca</th>
                      <th className="px-5 py-3 font-semibold">Club</th>
                      <th className="px-5 py-3 font-semibold">Miembros compradores</th>
                      <th className="px-5 py-3 font-semibold">Repuestos</th>
                      <th className="px-5 py-3 font-semibold">Servicios</th>
                      <th className="px-5 py-3 font-semibold">Compras</th>
                      <th className="px-5 py-3 font-semibold">Ingreso patrocinio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {impact.map((row) => (
                      <tr key={row.sponsorId} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">{row.brandName}</p>
                          <StatusPill status={row.lifecycleStatus} />
                        </td>
                        <td className="px-5 py-3 text-slate-600">{row.groupName}</td>
                        <td className="px-5 py-3 font-semibold text-slate-900">{row.clubBuyers}</td>
                        <td className="px-5 py-3 text-slate-600">{row.partsOrders}</td>
                        <td className="px-5 py-3 text-slate-600">{row.serviceOrders}</td>
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          {formatSponsorAmount(row.purchaseAmount)}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {formatSponsorAmount(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {/* Modal de tarifa */}
      <Modal
        open={rateModalOpen}
        onClose={() => (saving ? null : closeRateForm())}
        title={rateForm.id ? 'Editar tarifa' : 'Nueva tarifa de patrocinio'}
        description="Los cambios quedan registrados en la auditoría administrativa."
        footer={
          <>
            <button
              type="button"
              onClick={closeRateForm}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="sponsorship-rate-form"
              disabled={saving}
              className="rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E] disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar tarifa'}
            </button>
          </>
        }
      >
        <form id="sponsorship-rate-form" className="space-y-3" onSubmit={saveRate}>
          {actionError ? (
            <Alert tone="danger" title="No se pudo guardar">
              {actionError}
            </Alert>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código">
              <input
                className={inputClass}
                value={rateForm.code}
                onChange={(event) =>
                  setRateForm((form) => ({ ...form, code: event.target.value.toLowerCase() }))
                }
                placeholder="club_pro"
                required
                disabled={saving}
              />
            </Field>
            <Field label="Nombre">
              <input
                className={inputClass}
                value={rateForm.name}
                onChange={(event) => setRateForm((form) => ({ ...form, name: event.target.value }))}
                placeholder="Patrocinio Pro"
                required
                disabled={saving}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Costo">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={rateForm.amount}
                onChange={(event) => setRateForm((form) => ({ ...form, amount: event.target.value }))}
                required
                disabled={saving}
              />
            </Field>
            <Field label="Moneda">
              <select
                className={inputClass}
                value={rateForm.currency}
                onChange={(event) => setRateForm((form) => ({ ...form, currency: event.target.value }))}
                disabled={saving}
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </Field>
            <Field label="Ciclo">
              <select
                className={inputClass}
                value={rateForm.billingCycle}
                onChange={(event) =>
                  setRateForm((form) => ({ ...form, billingCycle: event.target.value }))
                }
                disabled={saving}
              >
                <option value="monthly">Mensual</option>
                <option value="one_time">Pago único</option>
              </select>
            </Field>
          </div>
          <Field label="Descripción">
            <textarea
              className={inputClass}
              rows={2}
              value={rateForm.description}
              onChange={(event) =>
                setRateForm((form) => ({ ...form, description: event.target.value }))
              }
              disabled={saving}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(rateForm.isActive)}
              onChange={(event) =>
                setRateForm((form) => ({ ...form, isActive: event.target.checked }))
              }
              disabled={saving}
            />
            Tarifa activa
          </label>
        </form>
      </Modal>

      {/* Modal de marca / vigencia */}
      <Modal
        open={sponsorModalOpen}
        onClose={() => (saving ? null : closeSponsorForm())}
        title={sponsorForm.id ? 'Editar patrocinio' : 'Registrar marca patrocinadora'}
        description="Define el beneficio, el costo y la vigencia. La aprobación es una acción separada."
        footer={
          <>
            <button
              type="button"
              onClick={closeSponsorForm}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="sponsorship-brand-form"
              disabled={saving}
              className="rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E] disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar patrocinio'}
            </button>
          </>
        }
      >
        <form id="sponsorship-brand-form" className="space-y-3" onSubmit={saveSponsor}>
          {actionError ? (
            <Alert tone="danger" title="No se pudo guardar">
              {actionError}
            </Alert>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre de la marca">
              <input
                className={inputClass}
                value={sponsorForm.brandName}
                onChange={(event) =>
                  setSponsorForm((form) => ({ ...form, brandName: event.target.value }))
                }
                placeholder="Refacciones Express"
                required
                disabled={saving}
              />
            </Field>
            <Field label="Club (opcional: todos los clubes)">
              <select
                className={inputClass}
                value={sponsorForm.groupId}
                onChange={(event) => setSponsorForm((form) => ({ ...form, groupId: event.target.value }))}
                disabled={saving}
              >
                <option value="">Todos los clubes</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Beneficio para miembros">
            <input
              className={inputClass}
              value={sponsorForm.benefit}
              onChange={(event) => setSponsorForm((form) => ({ ...form, benefit: event.target.value }))}
              placeholder="10% de descuento en refacciones"
              disabled={saving}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Descuento (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                className={inputClass}
                value={sponsorForm.discountPercent}
                onChange={(event) =>
                  setSponsorForm((form) => ({ ...form, discountPercent: event.target.value }))
                }
                disabled={saving}
              />
            </Field>
            <Field label="Costo del patrocinio">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={sponsorForm.amount}
                onChange={(event) => setSponsorForm((form) => ({ ...form, amount: event.target.value }))}
                required
                disabled={saving}
              />
            </Field>
            <Field label="Ciclo">
              <select
                className={inputClass}
                value={sponsorForm.billingCycle}
                onChange={(event) =>
                  setSponsorForm((form) => ({ ...form, billingCycle: event.target.value }))
                }
                disabled={saving}
              >
                <option value="monthly">Mensual</option>
                <option value="one_time">Pago único</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha de inicio">
              <input
                type="date"
                className={inputClass}
                value={sponsorForm.startsOn}
                onChange={(event) => setSponsorForm((form) => ({ ...form, startsOn: event.target.value }))}
                disabled={saving}
              />
            </Field>
            <Field label="Fecha de fin">
              <input
                type="date"
                className={inputClass}
                value={sponsorForm.endsOn}
                onChange={(event) => setSponsorForm((form) => ({ ...form, endsOn: event.target.value }))}
                disabled={saving}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tarifa aplicada">
              <select
                className={inputClass}
                value={sponsorForm.rateId}
                onChange={(event) => setSponsorForm((form) => ({ ...form, rateId: event.target.value }))}
                disabled={saving}
              >
                <option value="">Sin tarifa asignada</option>
                {rates.map((rate) => (
                  <option key={rate.id} value={rate.id}>
                    {rate.name} — {formatSponsorAmount(rate.amount, rate.currency)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Correo de contacto">
              <input
                type="email"
                className={inputClass}
                value={sponsorForm.contactEmail}
                onChange={(event) =>
                  setSponsorForm((form) => ({ ...form, contactEmail: event.target.value }))
                }
                disabled={saving}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Comercio vinculado">
              <select
                className={inputClass}
                value={sponsorForm.commerceId}
                onChange={(event) =>
                  setSponsorForm((form) => ({ ...form, commerceId: event.target.value }))
                }
                disabled={saving}
              >
                <option value="">Ninguno</option>
                {commerces.map((commerce) => (
                  <option key={commerce.id} value={commerce.id}>
                    {commerce.businessName || commerce.name || commerce.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Taller vinculado">
              <select
                className={inputClass}
                value={sponsorForm.workshopId}
                onChange={(event) =>
                  setSponsorForm((form) => ({ ...form, workshopId: event.target.value }))
                }
                disabled={saving}
              >
                <option value="">Ninguno</option>
                {workshops.map((workshop) => (
                  <option key={workshop.id} value={workshop.id}>
                    {workshop.workshopName}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="URL del logo">
            <input
              className={inputClass}
              value={sponsorForm.logoUrl}
              onChange={(event) => setSponsorForm((form) => ({ ...form, logoUrl: event.target.value }))}
              placeholder="https://…"
              disabled={saving}
            />
          </Field>
        </form>
      </Modal>

      {/* Confirmación de aprobación / rechazo */}
      <Modal
        open={confirmModalOpen}
        onClose={() => (saving ? null : setConfirming(null))}
        title={confirming?.status === 'approved' ? 'Aprobar marca' : 'Rechazar marca'}
        description="Esta decisión se registra en la auditoría y cambia lo que ven los miembros del club."
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmStatus}
              disabled={saving}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${
                confirming?.status === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {saving
                ? 'Guardando…'
                : confirming?.status === 'approved'
                  ? 'Sí, aprobar'
                  : 'Sí, rechazar'}
            </button>
          </>
        }
      >
        {confirming ? (
          <div className="space-y-3">
            {actionError ? (
              <Alert tone="danger" title="No se pudo actualizar la marca">
                {actionError}
              </Alert>
            ) : null}
            <p className="text-sm leading-6 text-slate-600">
              {confirming.status === 'approved'
                ? `«${confirming.sponsor.brandName}» aparecerá en la tarjeta del club con sus beneficios y descuentos aprobados.`
                : `«${confirming.sponsor.brandName}» dejará de mostrarse en los clubes hasta que sea aprobada de nuevo.`}
            </p>
            <Field label="Motivo (opcional)">
              <textarea
                className={inputClass}
                rows={2}
                value={confirming.reason || ''}
                onChange={(event) =>
                  setConfirming((current) => ({ ...current, reason: event.target.value }))
                }
                disabled={saving}
              />
            </Field>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-[#4B227A]" aria-hidden="true" />
              La decisión queda asociada a tu sesión administrativa.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
