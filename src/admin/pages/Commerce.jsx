import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  UploadCloud,
  XCircle,
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
  COMMERCE_ACTION_REASONS,
  COMMERCE_STATUS_OPTIONS,
  DOCUMENT_ACTION_REASONS,
  documentTypeLabel,
} from '../constants/phase2';
import { formatDate, formatDateTime, formatRelative } from '../utils/format';

const STATUS_ACTIONS = {
  pending: [
    {
      key: 'review',
      label: 'Iniciar revisión',
      nextStatus: 'in_review',
      permission: 'commerce.approve',
      tone: 'primary',
      reasons: COMMERCE_ACTION_REASONS.review,
      title: 'Iniciar revisión del comercio',
      description: 'El comercio pasará a revisión. La acción requiere motivo y queda auditada.',
      successTitle: 'Revisión iniciada',
    },
    {
      key: 'reject',
      label: 'Rechazar',
      nextStatus: 'rejected',
      permission: 'commerce.reject',
      tone: 'danger',
      reasons: COMMERCE_ACTION_REASONS.reject,
      title: 'Rechazar comercio',
      description: 'El comercio quedará rechazado. La acción requiere motivo y queda auditada.',
      successTitle: 'Comercio rechazado',
    },
  ],
  in_review: [
    {
      key: 'approve',
      label: 'Aprobar',
      nextStatus: 'approved',
      permission: 'commerce.approve',
      tone: 'primary',
      reasons: COMMERCE_ACTION_REASONS.approve,
      title: 'Aprobar comercio',
      description: 'El comercio podrá operar en la plataforma. La acción requiere motivo y queda auditada.',
      successTitle: 'Comercio aprobado',
    },
    {
      key: 'reject',
      label: 'Rechazar',
      nextStatus: 'rejected',
      permission: 'commerce.reject',
      tone: 'danger',
      reasons: COMMERCE_ACTION_REASONS.reject,
      title: 'Rechazar comercio',
      description: 'El comercio quedará rechazado. La acción requiere motivo y queda auditada.',
      successTitle: 'Comercio rechazado',
    },
  ],
  approved: [
    {
      key: 'suspend',
      label: 'Suspender',
      nextStatus: 'suspended',
      permission: 'commerce.suspend',
      tone: 'danger',
      reasons: COMMERCE_ACTION_REASONS.suspend,
      title: 'Suspender comercio',
      description: 'El comercio dejará de operar temporalmente. La acción requiere motivo y queda auditada.',
      successTitle: 'Comercio suspendido',
    },
  ],
  suspended: [
    {
      key: 'reactivate',
      label: 'Reactivar',
      nextStatus: 'approved',
      permission: 'commerce.approve',
      tone: 'primary',
      reasons: COMMERCE_ACTION_REASONS.reactivate,
      title: 'Reactivar comercio',
      description: 'El comercio volverá a estar aprobado. La acción requiere motivo y queda auditada.',
      successTitle: 'Comercio reactivado',
    },
  ],
  rejected: [
    {
      key: 'reopen',
      label: 'Reabrir revisión',
      nextStatus: 'in_review',
      permission: 'commerce.approve',
      tone: 'primary',
      reasons: COMMERCE_ACTION_REASONS.review,
      title: 'Reabrir revisión del comercio',
      description: 'El comercio volverá a revisión. La acción requiere motivo y queda auditada.',
      successTitle: 'Revisión reabierta',
    },
  ],
};

function actionsForCommerce(commerce, hasPermission) {
  return (STATUS_ACTIONS[commerce.status] || []).filter((action) => hasPermission(action.permission));
}

function DocumentSummary({ summary }) {
  if (!summary) return null;

  const items = [
    { key: 'pending', label: 'pendientes', className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
    { key: 'verified', label: 'verificados', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    { key: 'rejected', label: 'rechazados', className: 'bg-red-50 text-red-700 ring-red-200' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
        <FileText className="h-3 w-3" aria-hidden="true" />
        {summary.total || 0} documento(s)
      </span>
      {items
        .filter((item) => summary[item.key] > 0)
        .map((item) => (
          <span
            key={item.key}
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${item.className}`}
          >
            {summary[item.key]} {item.label}
          </span>
        ))}
    </div>
  );
}

function CommerceDocuments({
  commerce,
  canApprove,
  mode,
  previewBusy,
  onPreview,
  onReview,
}) {
  if (commerce.documentsRestricted) {
    return (
      <Alert tone="warning" title="Documentos restringidos">
        Tu rol no incluye <code className="font-mono text-xs">commerce.documents.view</code>. Puedes
        ver el estado del comercio y los resúmenes, pero no los documentos ni sus archivos.
      </Alert>
    );
  }

  if (!commerce.documents?.length) {
    return (
      <EmptyState
        Icon={UploadCloud}
        title="Sin documentos cargados"
        description="El comercio todavía no ha subido documentos. Puedes aprobarlo igualmente, dejando constancia del motivo."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {commerce.documents.map((document) => {
        const label = document.typeLabel || documentTypeLabel(document.type);

        return (
          <li key={document.id} className="rounded-xl border border-slate-200 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 rounded-lg bg-slate-50 p-2 text-slate-500 ring-1 ring-slate-200">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{label}</p>
                  <p className="truncate text-xs text-slate-500">{document.fileName}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <StatusBadge status={document.status} />
                    <span>Subido {formatDate(document.uploadedAt)}</span>
                    {document.reviewedAt ? <span>· Revisado {formatRelative(document.reviewedAt)}</span> : null}
                    {document.reviewedByName ? <span>· {document.reviewedByName}</span> : null}
                  </div>
                  {document.reviewReason ? (
                    <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs leading-5 text-slate-600">
                      {document.reviewReason}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => onPreview(document)}
                  disabled={mode === 'demo' || !document.hasFile || previewBusy === document.id}
                  title={
                    mode === 'demo'
                      ? 'La demostración no incluye archivos reales'
                      : !document.hasFile
                        ? 'El documento no tiene archivo asociado'
                        : 'Abrir vista previa con URL firmada'
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  {previewBusy === document.id ? 'Abriendo…' : 'Vista previa'}
                </button>

                {canApprove ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onReview(document, commerce, 'verified')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Verificar
                    </button>
                    <button
                      type="button"
                      onClick={() => onReview(document, commerce, 'rejected')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-100"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Rechazar
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function Commerce() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({ loading: true, error: null, commerces: [] });
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailState, setDetailState] = useState({ open: false, loading: false, error: null, commerce: null });
  const [statusAction, setStatusAction] = useState(null);
  const [documentAction, setDocumentAction] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(null);

  const canApprove = hasPermission('commerce.approve');
  const canViewDocuments = hasPermission('commerce.documents.view');

  const refresh = useCallback(async () => {
    try {
      const commerces = await adminRepository.listCommerces({ actor: session });
      setState({ loading: false, error: null, commerces });
    } catch (error) {
      setState({ loading: false, error: error.message, commerces: [] });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const commerces = await adminRepository.listCommerces({ actor: session });
        if (!cancelled) setState({ loading: false, error: null, commerces });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, commerces: [] });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.commerces.filter((commerce) => {
      if (statusFilter !== 'all' && commerce.status !== statusFilter) return false;
      if (!term) return true;
      return [
        commerce.tradeName,
        commerce.legalName,
        commerce.taxId,
        commerce.contactName,
        commerce.email,
        commerce.city,
        commerce.categoryName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.commerces, search, statusFilter]);

  const openDetail = async (commerce) => {
    setDetailState({ open: true, loading: true, error: null, commerce });
    try {
      const detail = await adminRepository.getCommerce({ commerceId: commerce.id, actor: session });
      setDetailState({ open: true, loading: false, error: null, commerce: detail });
    } catch (error) {
      setDetailState({ open: true, loading: false, error: error.message, commerce });
    }
  };

  const refreshDetail = async (commerceId) => {
    const detail = await adminRepository.getCommerce({ commerceId, actor: session });
    setDetailState({ open: true, loading: false, error: null, commerce: detail });
  };

  const confirmStatusAction = async ({ reason, detail }) => {
    if (!statusAction) return;

    const label = statusAction.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setActionBusy(true);
    try {
      await adminRepository.setCommerceStatus({
        commerceId: statusAction.commerce.id,
        status: statusAction.nextStatus,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: statusAction.successTitle,
        description: statusAction.commerce.tradeName,
      });
      setStatusAction(null);
      await refresh();
      if (detailState.open) await refreshDetail(statusAction.commerce.id);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cambiar el estado', description: error.message });
    } finally {
      setActionBusy(false);
    }
  };

  const confirmDocumentAction = async ({ reason, detail }) => {
    if (!documentAction) return;

    const label = documentAction.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setActionBusy(true);
    try {
      await adminRepository.reviewCommerceDocument({
        documentId: documentAction.document.id,
        status: documentAction.nextStatus,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: documentAction.nextStatus === 'verified' ? 'Documento verificado' : 'Documento rechazado',
        description: `${documentTypeLabel(documentAction.document.type)} · ${documentAction.commerce.tradeName}`,
      });
      setDocumentAction(null);
      await refresh();
      if (detailState.open) await refreshDetail(documentAction.commerce.id);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo revisar el documento', description: error.message });
    } finally {
      setActionBusy(false);
    }
  };

  const handlePreview = async (document) => {
    if (mode === 'demo') {
      notify({
        tone: 'info',
        title: 'Sin archivo en demostración',
        description: 'La demo solo guarda metadatos. La vista previa se habilita con un bucket privado real.',
      });
      return;
    }

    setPreviewBusy(document.id);
    try {
      const { url } = await adminRepository.getDocumentSignedUrl({ documentId: document.id });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo abrir el documento', description: error.message });
    } finally {
      setPreviewBusy(null);
    }
  };

  const detailCommerce = detailState.commerce;
  const detailActions = detailCommerce ? actionsForCommerce(detailCommerce, hasPermission) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Personas"
        title="Comercios"
        description="Bandeja de verificación: datos del comercio, documentos y decisiones de aprobación. Las reglas de documentos se aplican en el servidor y cada decisión queda auditada."
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Comercios de demostración">
          Comercios, documentos y decisiones son ejemplos guardados en este navegador. No hay
          archivos reales: la vista previa está deshabilitada y los documentos solo tienen metadatos.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando comercios…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar los comercios">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Store className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
              Bandeja de verificación
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
                  placeholder="Buscar comercio, RIF, categoría…"
                  aria-label="Buscar comercios"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filtrar comercios por estado"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todos los estados</option>
                {COMMERCE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Comercio</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Categoría</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Documentos</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Enviado</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((commerce) => (
                    <tr key={commerce.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4B227A]/10 text-[#4B227A]">
                            <Building2 className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openDetail(commerce)}
                              className="truncate text-left text-sm font-semibold text-slate-900 hover:text-[#4B227A] hover:underline"
                            >
                              {commerce.tradeName}
                            </button>
                            <p className="truncate text-xs text-slate-500">{commerce.legalName}</p>
                            <p className="truncate text-[11px] text-slate-400">
                              {commerce.taxId || 'Sin identificación fiscal'} · {commerce.city || 'Sin ciudad'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {commerce.categoryName || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={commerce.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <DocumentSummary summary={commerce.documentSummary} />
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {formatDate(commerce.submittedAt || commerce.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => openDetail(commerce)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Revisar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                Icon={Store}
                title="Sin comercios para este filtro"
                description="Prueba con otro estado o limpia la búsqueda."
              />
            </div>
          )}
        </section>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs leading-6 text-slate-500 shadow-sm">
        <p className="flex items-center gap-2 font-semibold text-slate-700">
          <ShieldCheck className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
          Reglas de verificación
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>La revisión y aprobación exigen <code className="font-mono">commerce.approve</code>.</li>
          <li>Rechazar exige <code className="font-mono">commerce.reject</code>; suspender exige <code className="font-mono">commerce.suspend</code>.</li>
          <li>Ver documentos exige <code className="font-mono">commerce.documents.view</code>.</li>
          <li>Los documentos pendientes se avisan, pero no bloquean la aprobación: la decisión y el motivo quedan auditados.</li>
          <li>Los archivos viven en un bucket privado y se abren con URLs firmadas temporales.</li>
        </ul>
      </div>

      <Modal
        open={detailState.open}
        onClose={() => setDetailState({ open: false, loading: false, error: null, commerce: null })}
        title={detailCommerce?.tradeName || 'Comercio'}
        description="Datos de verificación, documentos y decisiones."
        size="lg"
      >
        {detailState.loading ? <Spinner label="Cargando ficha del comercio…" /> : null}

        {detailState.error ? (
          <Alert tone="danger" title="No se pudo cargar la ficha">
            {detailState.error}
          </Alert>
        ) : null}

        {!detailState.loading && !detailState.error && detailCommerce ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detailCommerce.status} />
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                {detailCommerce.categoryName || 'Sin categoría'}
              </span>
              <span className="text-xs text-slate-400">
                Enviado {formatDate(detailCommerce.submittedAt || detailCommerce.createdAt)}
              </span>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Razón social</dt>
                <dd className="mt-0.5 text-sm text-slate-700">{detailCommerce.legalName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Identificación fiscal</dt>
                <dd className="mt-0.5 text-sm text-slate-700">{detailCommerce.taxId || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contacto</dt>
                <dd className="mt-0.5 text-sm text-slate-700">{detailCommerce.contactName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Correo y teléfono</dt>
                <dd className="mt-0.5 text-sm text-slate-700">
                  {detailCommerce.email || '—'} · {detailCommerce.phone || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dirección</dt>
                <dd className="mt-0.5 text-sm text-slate-700">
                  {detailCommerce.address || '—'} · {detailCommerce.city || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Revisión</dt>
                <dd className="mt-0.5 text-sm text-slate-700">
                  {detailCommerce.reviewedAt
                    ? `${formatDateTime(detailCommerce.reviewedAt)} · ${detailCommerce.reviewedByName || 'Sistema'}`
                    : 'Sin revisión registrada'}
                </dd>
              </div>
            </dl>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Motivo del estado</p>
              <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                {detailCommerce.statusReason || 'Sin motivo registrado.'}
              </p>
            </div>

            {detailCommerce.documentSummary?.pending > 0 ? (
              <Alert tone="warning" title="Documentos pendientes">
                Hay {detailCommerce.documentSummary.pending} documento(s) sin revisar. Puedes aprobar
                igualmente si la decisión está justificada; el sistema dejará constancia del motivo.
              </Alert>
            ) : null}

            {detailActions.length ? (
              <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="w-full text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Decisiones disponibles
                </p>
                {detailActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => setStatusAction({ ...action, commerce: detailCommerce })}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      action.tone === 'danger'
                        ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                        : 'border-[#4B227A]/20 bg-white text-[#4B227A] hover:bg-[#4B227A]/5'
                    }`}
                  >
                    {action.tone === 'danger' ? (
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}

            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Documentos
                  {!canViewDocuments ? (
                    <span className="ml-2 text-[11px] font-medium text-slate-400">restringidos</span>
                  ) : null}
                </h3>
                <DocumentSummary summary={detailCommerce.documentSummary} />
              </div>

              {mode === 'demo' ? (
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  Modo demostración: solo hay metadatos. No existen archivos que previsualizar.
                </p>
              ) : null}

              <CommerceDocuments
                commerce={detailCommerce}
                canApprove={canApprove}
                mode={mode}
                previewBusy={previewBusy}
                onPreview={handlePreview}
                onReview={(document, commerce, nextStatus) => {
                  const isVerified = nextStatus === 'verified';
                  setDocumentAction({
                    document,
                    commerce,
                    nextStatus,
                    reasons: isVerified
                      ? DOCUMENT_ACTION_REASONS.verified
                      : DOCUMENT_ACTION_REASONS.rejected,
                    title: isVerified ? 'Verificar documento' : 'Rechazar documento',
                    label: isVerified ? 'Verificar documento' : 'Rechazar documento',
                    tone: isVerified ? 'primary' : 'danger',
                    description: `${documentTypeLabel(document.type)} de ${commerce.tradeName}. La decisión requiere motivo y queda auditada.`,
                  });
                }}
              />
            </section>
          </div>
        ) : null}
      </Modal>

      <ReasonDialog
        open={Boolean(statusAction)}
        title={statusAction?.title || 'Cambiar estado'}
        description={
          statusAction
            ? `${statusAction.commerce.tradeName}. ${statusAction.description}`
            : ''
        }
        reasons={statusAction?.reasons || []}
        confirmLabel={statusAction?.label || 'Confirmar'}
        tone={statusAction?.tone || 'danger'}
        busy={actionBusy}
        onConfirm={confirmStatusAction}
        onClose={() => setStatusAction(null)}
      />

      <ReasonDialog
        open={Boolean(documentAction)}
        title={documentAction?.title || 'Revisar documento'}
        description={documentAction?.description || ''}
        reasons={documentAction?.reasons || []}
        confirmLabel={documentAction?.label || 'Confirmar'}
        tone={documentAction?.tone || 'danger'}
        busy={actionBusy}
        onConfirm={confirmDocumentAction}
        onClose={() => setDocumentAction(null)}
      />
    </div>
  );
}
