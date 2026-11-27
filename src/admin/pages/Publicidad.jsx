import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Eye,
  Megaphone,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  Search,
  TrendingUp,
  UploadCloud,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import ReasonDialog from '../components/ReasonDialog';
import KpiCard from '../components/KpiCard';
import { useToast } from '../components/useToast';
import { useAdminAuth } from '../auth/useAdminAuth';
import { adminRepository } from '../data';
import { uploadAdBanner } from '../../data/appData';
import SafeImage from '../../components/ui/SafeImage';
import { formatDate } from '../utils/format';

const EMPTY_CAMPAIGN = {
  id: null,
  name: '',
  headline: '',
  description: '',
  imageUrl: '',
  ctaLabel: 'Ver más',
  targetPath: '/request',
  startsAt: '',
  endsAt: '',
  impressionLimit: '',
  sortOrder: 0,
  isActive: true,
};

const STATUS_LABELS = {
  active: 'Vigente',
  paused: 'Pausada',
  scheduled: 'Programada',
  expired: 'Vencida',
  exhausted: 'Agotada',
};

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  paused: 'bg-slate-100 text-slate-600 ring-slate-200',
  scheduled: 'bg-sky-50 text-sky-700 ring-sky-200',
  expired: 'bg-orange-50 text-orange-700 ring-orange-200',
  exhausted: 'bg-[#4B227A]/10 text-[#4B227A] ring-[#4B227A]/20',
};

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Vigentes' },
  { value: 'paused', label: 'Pausadas' },
  { value: 'scheduled', label: 'Programadas' },
  { value: 'expired', label: 'Vencidas' },
  { value: 'exhausted', label: 'Agotadas' },
];

const STATUS_REASONS = [
  { value: 'schedule', label: 'Cambio de programación' },
  { value: 'budget', label: 'Presupuesto agotado' },
  { value: 'content', label: 'Contenido a revisar' },
  { value: 'other', label: 'Otro motivo' },
];

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15';

const labelClass = 'block text-xs font-semibold text-slate-600';

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function StatusPill({ status }) {
  const key = STATUS_LABELS[status] ? status : 'paused';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${STATUS_STYLES[key]}`}
    >
      {STATUS_LABELS[key]}
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

// Panel de publicidad: campañas del carrusel de /categories, vigencia,
// impresiones y clics. Todas las escrituras pasan por RPC auditadas en
// servidor (o por el repositorio demo, que también deja auditoría local).
export default function Publicidad() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const canManage = hasPermission('ads.manage');

  const [tab, setTab] = useState('campaigns');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [campaigns, setCampaigns] = useState([]);
  const [overview, setOverview] = useState(null);
  const [performance, setPerformance] = useState([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(EMPTY_CAMPAIGN);
  const [formOpen, setFormOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState(null);
  const bannerInputRef = useRef(null);

  const statusDialogOpen = Boolean(statusTarget);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignsData, overviewData, performanceData] = await Promise.all([
        adminRepository.listAdCampaigns({ actor: session }),
        adminRepository.getAdsOverview({ actor: session }),
        adminRepository.getAdPerformanceReport({ actor: session }),
      ]);
      setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
      setOverview(overviewData || null);
      setPerformance(Array.isArray(performanceData) ? performanceData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredCampaigns = useMemo(() => {
    const term = search.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (statusFilter !== 'all' && campaign.lifecycleStatus !== statusFilter) return false;
      if (!term) return true;
      return [campaign.name, campaign.headline, campaign.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [campaigns, search, statusFilter]);

  const closeForm = () => {
    setForm(EMPTY_CAMPAIGN);
    setBannerError(null);
    setBannerUploading(false);
    setFormOpen(false);
  };

  const openForm = (campaign) => {
    setActionError(null);
    setBannerError(null);
    setBannerUploading(false);
    if (!campaign) {
      setForm(EMPTY_CAMPAIGN);
      setFormOpen(true);
      return;
    }
    setForm({
      id: campaign.id,
      name: campaign.name || '',
      headline: campaign.headline || '',
      description: campaign.description || '',
      imageUrl: campaign.imageUrl || '',
      ctaLabel: campaign.ctaLabel || 'Ver más',
      targetPath: campaign.targetPath || '/request',
      startsAt: toDateTimeLocal(campaign.startsAt),
      endsAt: toDateTimeLocal(campaign.endsAt),
      impressionLimit: campaign.impressionLimit == null ? '' : String(campaign.impressionLimit),
      sortOrder: Number(campaign.sortOrder || 0),
      isActive: Boolean(campaign.isActive),
    });
    setFormOpen(true);
  };

  const handleBannerChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || bannerUploading) return;

    setBannerUploading(true);
    setBannerError(null);
    try {
      const result = await uploadAdBanner({
        userId: session?.memberId || session?.email || 'admin',
        file,
      });
      if (result.error) {
        setBannerError(result.error);
        return;
      }
      setForm((current) => ({ ...current, imageUrl: result.url }));
    } catch (err) {
      setBannerError(err?.message || 'No se pudo subir el banner.');
    } finally {
      setBannerUploading(false);
    }
  };

  const saveCampaign = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setActionError(null);
    try {
      await adminRepository.saveAdCampaign({
        ...form,
        startsAt: toIsoOrNull(form.startsAt),
        endsAt: toIsoOrNull(form.endsAt),
        impressionLimit: form.impressionLimit === '' ? null : Number(form.impressionLimit),
        sortOrder: Number(form.sortOrder || 0),
        actor: session,
      });
      notify({
        tone: 'success',
        title: form.id ? 'Campaña actualizada' : 'Campaña creada',
        description: `${form.name} quedó guardada y aparecerá en /categories según su vigencia.`,
      });
      closeForm();
      await refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmStatus = async ({ reason, detail }) => {
    if (!statusTarget || saving) return;
    setSaving(true);
    setActionError(null);
    const reasonLabel = STATUS_REASONS.find((item) => item.value === reason)?.label || reason;
    try {
      const updated = await adminRepository.setAdCampaignStatus({
        id: statusTarget.campaign.id,
        isActive: statusTarget.isActive,
        reason: detail ? `${reasonLabel}: ${detail}` : reasonLabel,
        actor: session,
      });
      notify({
        tone: statusTarget.isActive ? 'success' : 'warning',
        title: statusTarget.isActive ? 'Campaña reactivada' : 'Campaña pausada',
        description: `${updated?.name || statusTarget.campaign.name} ahora figura como ${
          STATUS_LABELS[updated?.lifecycleStatus] || (statusTarget.isActive ? 'vigente' : 'pausada')
        }.`,
      });
      setStatusTarget(null);
      await refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: 'campaigns', label: 'Campañas', Icon: Megaphone },
    { key: 'metrics', label: 'Métricas', Icon: TrendingUp },
  ];

  const ctr = overview?.totalImpressions
    ? ((Number(overview.totalClicks) / Number(overview.totalImpressions)) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fase 5 · Crecimiento"
        title="Publicidad"
        description={
          mode === 'demo'
            ? 'Datos de demostración: crea campañas, controla su vigencia y revisa impresiones y clics simulados.'
            : 'Administra los anuncios del carrusel de /categories con vigencia, límite de impresiones y métricas reales.'
        }
      />

      {error ? (
        <Alert tone="danger" title="No se pudo cargar el módulo de publicidad">
          {error}
        </Alert>
      ) : null}

      {actionError && !formOpen && !statusDialogOpen ? (
        <Alert tone="danger" title="No se pudo completar la operación">
          {actionError}
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Campañas vigentes"
          value={String(overview?.activeCampaigns || 0)}
          hint={`${overview?.totalCampaigns || 0} campañas en total`}
          Icon={Megaphone}
          tone="accent"
        />
        <KpiCard
          label="Impresiones"
          value={Number(overview?.totalImpressions || 0).toLocaleString('es-MX')}
          hint={`${overview?.activeImpressionsRemaining || 0} impresiones disponibles`}
          Icon={Eye}
        />
        <KpiCard
          label="Clics"
          value={Number(overview?.totalClicks || 0).toLocaleString('es-MX')}
          hint="Registrados sin duplicados por visitante"
          Icon={MousePointerClick}
        />
        <KpiCard
          label="CTR global"
          value={`${ctr}%`}
          hint="Clics entre impresiones"
          Icon={TrendingUp}
          tone="accent"
        />
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones de publicidad">
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
          <Spinner label="Cargando publicidad…" />
        </div>
      ) : null}

      {!loading && tab === 'campaigns' ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Campañas del carrusel</h2>
              <p className="mt-1 text-xs text-slate-500">
                Solo las campañas vigentes y con impresiones disponibles se muestran en /categories.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block sm:w-64">
                <span className="sr-only">Buscar campaña</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar campaña"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
                />
              </label>
              <select
                aria-label="Filtrar por estado"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#4B227A]"
              >
                {STATUS_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => openForm(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Nueva campaña
                </button>
              ) : null}
            </div>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="p-5">
              <EmptyState
                Icon={Megaphone}
                title="No hay campañas para mostrar"
                description={
                  search || statusFilter !== 'all'
                    ? 'Prueba con otra búsqueda o cambia el filtro de estado.'
                    : 'Todavía no se crearon campañas de publicidad.'
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Campaña</th>
                    <th className="px-5 py-3 font-semibold">Vigencia</th>
                    <th className="px-5 py-3 font-semibold">Impresiones</th>
                    <th className="px-5 py-3 font-semibold">Clics</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                    <th className="px-5 py-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCampaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#00EED0]/20">
                            {campaign.imageUrl ? (
                              <SafeImage
                                src={campaign.imageUrl}
                                alt={`Banner de ${campaign.name}`}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{campaign.name}</p>
                            <p className="text-xs text-slate-500">{campaign.headline}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                          {formatDate(campaign.startsAt)} — {formatDate(campaign.endsAt)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">
                          {Number(campaign.impressionsCount || 0).toLocaleString('es-MX')}
                        </p>
                        <p className="text-xs text-slate-500">
                          {campaign.impressionLimit == null
                            ? 'Sin límite'
                            : `${Number(campaign.remainingImpressions || 0).toLocaleString('es-MX')} disponibles`}
                        </p>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        {Number(campaign.clicksCount || 0).toLocaleString('es-MX')}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill status={campaign.lifecycleStatus} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {canManage ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openForm(campaign)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setStatusTarget({ campaign, isActive: !campaign.isActive });
                                }}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                  campaign.isActive
                                    ? 'border border-orange-200 text-orange-700 hover:bg-orange-50'
                                    : 'bg-[#00EED0] text-black hover:bg-[#00EED0]/90'
                                }`}
                              >
                                {campaign.isActive ? (
                                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                                ) : (
                                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                {campaign.isActive ? 'Pausar' : 'Reactivar'}
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

      {!loading && tab === 'metrics' ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-base font-semibold text-slate-900">Rendimiento por campaña</h2>
            <p className="mt-1 text-xs text-slate-500">
              Impresiones y clics reales, deduplicados por campaña y visitante.
            </p>
          </div>
          {performance.length === 0 ? (
            <div className="p-5">
              <EmptyState
                Icon={TrendingUp}
                title="Todavía no hay métricas"
                description="Las campañas empezarán a mostrar datos cuando se publiquen en /categories."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Campaña</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                    <th className="px-5 py-3 font-semibold">Impresiones</th>
                    <th className="px-5 py-3 font-semibold">Clics</th>
                    <th className="px-5 py-3 font-semibold">CTR</th>
                    <th className="px-5 py-3 font-semibold">Disponibles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {performance.map((row) => (
                    <tr key={row.campaignId} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-medium text-slate-900">{row.name}</td>
                      <td className="px-5 py-3">
                        <StatusPill status={row.lifecycleStatus} />
                      </td>
                      <td className="px-5 py-3">
                        {Number(row.impressionsCount || 0).toLocaleString('es-MX')}
                      </td>
                      <td className="px-5 py-3">{Number(row.clicksCount || 0).toLocaleString('es-MX')}</td>
                      <td className="px-5 py-3 font-semibold text-[#006E7A]">
                        {Number(row.ctr || 0).toFixed(2)}%
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {row.remainingImpressions == null
                          ? 'Sin límite'
                          : Number(row.remainingImpressions).toLocaleString('es-MX')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {/* Modal de campaña */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        size="lg"
        title={form.id ? 'Editar campaña' : 'Nueva campaña'}
        description="La campaña aparecerá en el carrusel solo durante su vigencia y mientras tenga impresiones disponibles."
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="ad-campaign-form"
              disabled={saving}
              className="rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar campaña'}
            </button>
          </div>
        }
      >
        {actionError ? (
          <Alert tone="danger" title="Revisa los datos">
            {actionError}
          </Alert>
        ) : null}

        <form id="ad-campaign-form" onSubmit={saveCampaign} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre interno" className="sm:col-span-2">
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              maxLength={120}
              required
            />
          </Field>

          <Field label="Titular del anuncio" className="sm:col-span-2">
            <input
              className={inputClass}
              value={form.headline}
              onChange={(event) => setForm({ ...form, headline: event.target.value })}
              maxLength={120}
              required
            />
          </Field>

          <Field label="Descripción" className="sm:col-span-2">
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              maxLength={240}
            />
          </Field>

          <Field label="Banner de la campaña" className="sm:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-[#00EED0]/10">
                {form.imageUrl ? (
                  <SafeImage
                    src={form.imageUrl}
                    alt="Vista previa del banner"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  className={inputClass}
                  value={form.imageUrl}
                  onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
                  placeholder="https://… o sube una imagen"
                  required
                />
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleBannerChange}
                />
                <button
                  type="button"
                  disabled={bannerUploading}
                  onClick={() => bannerInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#00EED0] px-3 py-1.5 text-xs font-semibold text-[#006E7A] transition hover:bg-[#00EED0]/10 disabled:opacity-50"
                >
                  <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                  {bannerUploading ? 'Subiendo…' : 'Subir banner'}
                </button>
                {bannerError ? <p className="text-xs text-red-600">{bannerError}</p> : null}
              </div>
            </div>
          </Field>

          <Field label="Texto del botón">
            <input
              className={inputClass}
              value={form.ctaLabel}
              onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })}
              maxLength={60}
            />
          </Field>

          <Field label="Destino (ruta interna)">
            <input
              className={inputClass}
              value={form.targetPath}
              onChange={(event) => setForm({ ...form, targetPath: event.target.value })}
              placeholder="/request"
            />
          </Field>

          <Field label="Inicia">
            <input
              type="datetime-local"
              className={inputClass}
              value={form.startsAt}
              onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
            />
          </Field>

          <Field label="Termina">
            <input
              type="datetime-local"
              className={inputClass}
              value={form.endsAt}
              onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
            />
          </Field>

          <Field label="Límite de impresiones">
            <input
              type="number"
              min="1"
              className={inputClass}
              value={form.impressionLimit}
              onChange={(event) => setForm({ ...form, impressionLimit: event.target.value })}
              placeholder="Vacío = sin límite"
            />
          </Field>

          <Field label="Orden de aparición">
            <input
              type="number"
              className={inputClass}
              value={form.sortOrder}
              onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-[#4B227A] focus:ring-[#4B227A]"
            />
            Campaña activa (si está pausada no se publica)
          </label>
        </form>
      </Modal>

      <ReasonDialog
        open={statusDialogOpen}
        title={statusTarget?.isActive ? 'Reactivar campaña' : 'Pausar campaña'}
        description={`La acción sobre «${statusTarget?.campaign.name || ''}» quedará registrada en la auditoría.`}
        reasons={STATUS_REASONS}
        confirmLabel={statusTarget?.isActive ? 'Reactivar' : 'Pausar'}
        tone={statusTarget?.isActive ? 'primary' : 'danger'}
        busy={saving}
        onConfirm={confirmStatus}
        onClose={() => setStatusTarget(null)}
      />
    </div>
  );
}
