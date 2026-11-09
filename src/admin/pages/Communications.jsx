import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Check,
  Megaphone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
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
  CAMPAIGN_ACTION_REASONS,
  CAMPAIGN_STATUS_OPTIONS,
  CAMPAIGN_TRANSITIONS,
  COMMUNICATION_SEGMENTS,
  COMMUNICATION_TEMPLATE_REASONS,
  COMMUNICATION_TEMPLATE_STATUS_OPTIONS,
  COMMUNICATION_TEMPLATE_TRANSITIONS,
  COMMUNICATIONS_SIMULATION_NOTICE,
  campaignActionKey,
  campaignPermission,
} from '../constants/phase4';
import { formatRelative } from '../utils/format';

const TEMPLATE_ACTION_LABELS = {
  active: 'Activar',
  archived: 'Archivar',
  draft: 'Volver a borrador',
};

const CAMPAIGN_ACTION_LABELS = {
  queued: 'Poner en cola (simulada)',
  sent: 'Marcar como enviada (simulada)',
  cancelled: 'Cancelar campaña',
  failed: 'Marcar como fallida',
  draft: 'Volver a borrador',
};

const PROVIDER_LABELS = {
  draft: 'Sin procesar',
  demo_pending: 'Simulado · en cola',
  demo_simulated: 'Simulado · sin entrega real',
  cancelled: 'Cancelada',
  failed: 'Fallida',
};

const TEMPLATE_ACTION_ICONS = {
  active: Check,
  archived: Archive,
  draft: Sparkles,
};

const CAMPAIGN_ACTION_ICONS = {
  queued: Send,
  sent: Check,
  cancelled: Archive,
  failed: Archive,
  draft: Sparkles,
};

function CreateCampaignDialog({ open, templates, segments, busy, onClose, onConfirm }) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [segment, setSegment] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setTemplateId(templates[0]?.id || '');
    setSegment(segments[0]?.value || '');
  }, [open, templates, segments]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva campaña simulada"
      description="La campaña se crea como borrador. No se envía nada: solo se registra un estado local de demostración."
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !name.trim() || !templateId || !segment}
            onClick={() => onConfirm({ name, templateId, segment })}
            className="rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Creando…' : 'Crear borrador'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="campaign-name" className="text-sm font-medium text-slate-700">
            Nombre de la campaña
          </label>
          <input
            id="campaign-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            placeholder="Ej. Recordatorio de pedidos sin confirmar"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          />
        </div>

        <div>
          <label htmlFor="campaign-template" className="text-sm font-medium text-slate-700">
            Plantilla activa
          </label>
          <select
            id="campaign-template"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          >
            <option value="">Selecciona una plantilla…</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="campaign-segment" className="text-sm font-medium text-slate-700">
            Segmento
          </label>
          <select
            id="campaign-segment"
            value={segment}
            onChange={(event) => setSegment(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          >
            <option value="">Selecciona un segmento…</option>
            {segments.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            Los segmentos amplios exigen <code className="font-mono">communications.broadcast</code>.
            Los segmentos dirigidos exigen <code className="font-mono">communications.send</code>.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default function Communications() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({
    loading: true,
    error: null,
    templates: [],
    campaigns: [],
  });
  const [search, setSearch] = useState('');
  const [templateStatus, setTemplateStatus] = useState('all');
  const [campaignStatus, setCampaignStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [templateAction, setTemplateAction] = useState(null);
  const [campaignAction, setCampaignAction] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [templates, campaigns] = await Promise.all([
        adminRepository.listCommunicationTemplates({ actor: session }),
        adminRepository.listCommunicationCampaigns({ actor: session }),
      ]);
      setState({ loading: false, error: null, templates, campaigns });
    } catch (error) {
      setState({ loading: false, error: error.message, templates: [], campaigns: [] });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [templates, campaigns] = await Promise.all([
          adminRepository.listCommunicationTemplates({ actor: session }),
          adminRepository.listCommunicationCampaigns({ actor: session }),
        ]);
        if (!cancelled) setState({ loading: false, error: null, templates, campaigns });
      } catch (error) {
        if (!cancelled) {
          setState({ loading: false, error: error.message, templates: [], campaigns: [] });
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const activeTemplates = useMemo(
    () => state.templates.filter((template) => template.status === 'active'),
    [state.templates]
  );

  const availableSegments = useMemo(
    () => COMMUNICATION_SEGMENTS.filter((segment) => hasPermission(campaignPermission(segment.value))),
    [hasPermission]
  );

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.templates.filter((template) => {
      if (templateStatus !== 'all' && template.status !== templateStatus) return false;
      if (!term) return true;
      return [template.name, template.subject, template.body, template.segmentLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.templates, search, templateStatus]);

  const filteredCampaigns = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.campaigns.filter((campaign) => {
      if (campaignStatus !== 'all' && campaign.status !== campaignStatus) return false;
      if (!term) return true;
      return [campaign.name, campaign.templateName, campaign.segmentLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.campaigns, search, campaignStatus]);

  const createCampaign = async (payload) => {
    setBusy(true);
    try {
      await adminRepository.createCommunicationCampaign({ ...payload, actor: session });
      notify({
        title: 'Campaña creada como borrador',
        description: `${payload.name} · no se ha enviado nada`,
      });
      setCreateOpen(false);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo crear la campaña', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  const confirmTemplateAction = async ({ reason, detail }) => {
    if (!templateAction) return;
    const label = templateAction.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setBusy(true);
    try {
      await adminRepository.setCommunicationTemplateStatus({
        templateId: templateAction.template.id,
        status: templateAction.to,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: 'Plantilla actualizada',
        description: `${templateAction.template.name} · ${TEMPLATE_ACTION_LABELS[templateAction.to]}`,
      });
      setTemplateAction(null);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo actualizar la plantilla', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  const confirmCampaignAction = async ({ reason, detail }) => {
    if (!campaignAction) return;
    const label = campaignAction.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setBusy(true);
    try {
      await adminRepository.setCampaignStatus({
        campaignId: campaignAction.campaign.id,
        status: campaignAction.to,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: 'Campaña actualizada (simulada)',
        description: `${campaignAction.campaign.name} · ${CAMPAIGN_ACTION_LABELS[campaignAction.to]} · sin entrega real`,
      });
      setCampaignAction(null);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo actualizar la campaña', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Atención"
        title="Comunicaciones"
        description="Prepara plantillas y campañas simuladas. No hay proveedor de correo conectado: ningún envío es real."
        actions={
          hasPermission('communications.send') || hasPermission('communications.broadcast') ? (
            <button
              type="button"
              disabled={!activeTemplates.length || !availableSegments.length}
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nueva campaña
            </button>
          ) : null
        }
      />

      <Alert tone="warning" title="Envíos simulados, no reales">
        {COMMUNICATIONS_SIMULATION_NOTICE}
      </Alert>

      {mode === 'demo' ? (
        <Alert tone="info" title="Comunicaciones de demostración">
          Plantillas, campañas y audiencias son ejemplos guardados en este navegador. Los estados
          «en cola» y «enviada» son etiquetas de simulación; no se entrega ningún correo.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando comunicaciones…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar las comunicaciones">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
                Plantillas
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {filteredTemplates.length}
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
                    placeholder="Buscar plantilla, asunto o segmento…"
                    aria-label="Buscar plantillas y campañas"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                  />
                </div>
                <select
                  value={templateStatus}
                  onChange={(event) => setTemplateStatus(event.target.value)}
                  aria-label="Filtrar plantillas por estado"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
                >
                  <option value="all">Todos los estados</option>
                  {COMMUNICATION_TEMPLATE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredTemplates.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                      <th scope="col" className="px-5 py-2.5 font-semibold">Plantilla</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Asunto</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Segmento</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Actualizada</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTemplates.map((template) => {
                      const transitions = COMMUNICATION_TEMPLATE_TRANSITIONS[template.status] || [];
                      return (
                        <tr key={template.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold text-slate-900">{template.name}</p>
                            <p className="line-clamp-1 text-xs text-slate-500">{template.body}</p>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600">{template.subject}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-600">{template.segmentLabel}</td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={template.status} />
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600">
                            {formatRelative(template.updatedAt)}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {hasPermission('communications.template') ? (
                                transitions.map((to) => {
                                  const Icon = TEMPLATE_ACTION_ICONS[to] || Sparkles;
                                  return (
                                    <button
                                      key={to}
                                      type="button"
                                      onClick={() =>
                                        setTemplateAction({
                                          template,
                                          to,
                                          label: TEMPLATE_ACTION_LABELS[to] || to,
                                          reasons: COMMUNICATION_TEMPLATE_REASONS[to] || [],
                                          title: `${TEMPLATE_ACTION_LABELS[to] || to} · ${template.name}`,
                                        })
                                      }
                                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                                        to === 'archived'
                                          ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                      }`}
                                    >
                                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                      {TEMPLATE_ACTION_LABELS[to] || to}
                                    </button>
                                  );
                                })
                              ) : (
                                <span className="text-xs text-slate-400">Solo lectura</span>
                              )}
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
                  Icon={Sparkles}
                  title="Sin plantillas para este filtro"
                  description="Prueba con otro estado o limpia la búsqueda."
                />
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Megaphone className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
                Campañas simuladas
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {filteredCampaigns.length}
                </span>
              </div>
              <select
                value={campaignStatus}
                onChange={(event) => setCampaignStatus(event.target.value)}
                aria-label="Filtrar campañas por estado"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-56"
              >
                <option value="all">Todos los estados</option>
                {CAMPAIGN_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {filteredCampaigns.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                      <th scope="col" className="px-5 py-2.5 font-semibold">Campaña</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Plantilla</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Segmento</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Audiencia</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Proceso</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Actualizada</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((campaign) => {
                      const transitions = CAMPAIGN_TRANSITIONS[campaign.status] || [];
                      return (
                        <tr key={campaign.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold text-slate-900">{campaign.name}</p>
                            <p className="text-xs text-slate-500">
                              Creada por {campaign.createdByName || '—'}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600">
                            {campaign.templateName || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600">
                            {campaign.segmentLabel}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600">
                            {campaign.audienceCount}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={campaign.status} />
                          </td>
                          <td className="px-5 py-3.5 text-xs font-semibold text-amber-700">
                            {PROVIDER_LABELS[campaign.providerStatus] || campaign.providerStatus}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600">
                            {formatRelative(campaign.updatedAt)}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {transitions.map((to) => {
                                const permission = campaignPermission(campaign.segment);
                                if (!hasPermission(permission)) return null;
                                const actionKey = campaignActionKey(campaign.status, to);
                                const Icon = CAMPAIGN_ACTION_ICONS[to] || Send;
                                return (
                                  <button
                                    key={`${campaign.status}-${to}`}
                                    type="button"
                                    onClick={() =>
                                      setCampaignAction({
                                        campaign,
                                        to,
                                        label: CAMPAIGN_ACTION_LABELS[to] || to,
                                        reasons: CAMPAIGN_ACTION_REASONS[actionKey] || [],
                                        title: `${CAMPAIGN_ACTION_LABELS[to] || to} · ${campaign.name}`,
                                      })
                                    }
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                                      to === 'cancelled' || to === 'failed'
                                        ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                                        : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                    }`}
                                  >
                                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                    {CAMPAIGN_ACTION_LABELS[to] || to}
                                  </button>
                                );
                              })}
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
                  Icon={Megaphone}
                  title="Sin campañas para este filtro"
                  description="Crea un borrador o cambia el filtro de estado."
                />
              </div>
            )}
          </section>
        </>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs leading-6 text-slate-500 shadow-sm">
        <p className="flex items-center gap-2 font-semibold text-slate-700">
          <ShieldCheck className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
          Reglas de esta pantalla
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Ver plantillas y campañas exige <code className="font-mono">communications.view</code>.</li>
          <li>Activar o archivar plantillas exige <code className="font-mono">communications.template</code>.</li>
          <li>Enviar a segmentos dirigidos exige <code className="font-mono">communications.send</code>.</li>
          <li>Enviar a audiencias amplias exige <code className="font-mono">communications.broadcast</code>.</li>
          <li>No existe proveedor de correo: «en cola» y «enviada» son estados simulados explícitos.</li>
        </ul>
      </div>

      <CreateCampaignDialog
        open={createOpen}
        templates={activeTemplates}
        segments={availableSegments}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onConfirm={createCampaign}
      />

      <ReasonDialog
        open={Boolean(templateAction)}
        title={templateAction?.title || 'Actualizar plantilla'}
        description="El cambio de estado de la plantilla queda registrado en la auditoría."
        reasons={templateAction?.reasons || []}
        confirmLabel={templateAction?.label || 'Confirmar'}
        tone={templateAction?.to === 'archived' ? 'danger' : 'primary'}
        busy={busy}
        onConfirm={confirmTemplateAction}
        onClose={() => setTemplateAction(null)}
      />

      <ReasonDialog
        open={Boolean(campaignAction)}
        title={campaignAction?.title || 'Actualizar campaña'}
        description="Esta campaña es simulada: no se entregará ningún mensaje real."
        reasons={campaignAction?.reasons || []}
        confirmLabel={campaignAction?.label || 'Confirmar'}
        tone={
          campaignAction?.to === 'cancelled' || campaignAction?.to === 'failed'
            ? 'danger'
            : 'primary'
        }
        busy={busy}
        onConfirm={confirmCampaignAction}
        onClose={() => setCampaignAction(null)}
      />
    </div>
  );
}
