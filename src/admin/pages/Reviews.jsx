import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  Flag,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
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
  REVIEW_ACTION_REASONS,
  REVIEW_STATUS_OPTIONS,
  REVIEW_TRANSITIONS,
  reviewActionKey,
  reviewActionLabel,
  reviewActionPermission,
} from '../constants/phase4';
import { formatDateTime, formatRelative } from '../utils/format';

const ACTION_ICONS = {
  hide: EyeOff,
  restore: RotateCcw,
  flag: Flag,
  publish: Check,
};

function buildActions(review, hasPermission) {
  return (REVIEW_TRANSITIONS[review.status] || [])
    .map((to) => {
      const key = reviewActionKey(review.status, to);
      return {
        key: `${review.status}-${to}`,
        to,
        label: reviewActionLabel(review.status, to),
        permission: reviewActionPermission(),
        tone: key === 'restore' || key === 'publish' ? 'primary' : 'danger',
        reasons: REVIEW_ACTION_REASONS[key] || [],
        title: `${reviewActionLabel(review.status, to)} · ${review.commerceName || review.id}`,
        description: 'La acción exige un motivo y queda registrada en la auditoría.',
        successTitle: 'Reseña actualizada',
        Icon: ACTION_ICONS[key] || Flag,
      };
    })
    .filter((action) => hasPermission(action.permission));
}

function Rating({ value }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600">
      <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
      {value}/5
    </span>
  );
}

function ReviewDetail({ review }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={review.status} />
          <Rating value={review.rating} />
          <span className="text-xs font-semibold text-slate-500">
            {review.orderNumber || 'Sin pedido'}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {review.commerceName || 'Comercio no disponible'}
        </p>
        <p className="mt-1 text-xs text-slate-500">Comprador: {review.buyerName || '—'}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Comentario</p>
        <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
          {review.comment || 'Sin comentario.'}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Creada</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{formatDateTime(review.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Publicada</dt>
          <dd className="mt-0.5 text-sm text-slate-700">
            {review.publishedAt ? formatDateTime(review.publishedAt) : 'No publicada'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Moderada por</dt>
          <dd className="mt-0.5 text-sm text-slate-700">{review.moderatedByName || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Última acción</dt>
          <dd className="mt-0.5 text-sm text-slate-700">
            {review.moderatedAt ? formatRelative(review.moderatedAt) : '—'}
          </dd>
        </div>
      </dl>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Motivo del estado
        </p>
        <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
          {review.statusReason || 'Sin motivo registrado.'}
        </p>
      </div>
    </div>
  );
}

export default function Reviews() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({ loading: true, error: null, reviews: [] });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [detailTarget, setDetailTarget] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const reviews = await adminRepository.listReviews({ actor: session });
      setState({ loading: false, error: null, reviews });
    } catch (error) {
      setState({ loading: false, error: error.message, reviews: [] });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const reviews = await adminRepository.listReviews({ actor: session });
        if (!cancelled) setState({ loading: false, error: null, reviews });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, reviews: [] });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.reviews.filter((review) => {
      if (statusFilter !== 'all' && review.status !== statusFilter) return false;
      if (ratingFilter !== 'all' && Number(review.rating) !== Number(ratingFilter)) return false;
      if (!term) return true;
      return [review.comment, review.buyerName, review.commerceName, review.orderNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.reviews, search, statusFilter, ratingFilter]);

  const openDetail = async (review) => {
    setDetailTarget(review);
    try {
      const detail = await adminRepository.getReview({ reviewId: review.id, actor: session });
      setDetailTarget(detail);
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cargar la reseña', description: error.message });
    }
  };

  const confirmAction = async ({ reason, detail }) => {
    if (!actionTarget) return;

    const label = actionTarget.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setActionBusy(true);
    try {
      await adminRepository.setReviewStatus({
        reviewId: actionTarget.review.id,
        status: actionTarget.to,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: actionTarget.successTitle,
        description: `${actionTarget.review.commerceName || actionTarget.review.id} · ${label}`,
      });
      setActionTarget(null);
      setDetailTarget(null);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo actualizar la reseña', description: error.message });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Confianza"
        title="Reseñas"
        description="Revisa las valoraciones de compradores, marca casos dudosos y oculta o restaura contenido con motivo auditado."
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Reseñas de demostración">
          Las reseñas, comentarios y valoraciones son ejemplos guardados en este navegador. No
          representan opiniones reales ni comercios reales.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando reseñas…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar las reseñas">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Star className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
              Reseñas recibidas
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
                  placeholder="Buscar comentario, comprador o comercio…"
                  aria-label="Buscar reseñas"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filtrar reseñas por estado"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todos los estados</option>
                {REVIEW_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={ratingFilter}
                onChange={(event) => setRatingFilter(event.target.value)}
                aria-label="Filtrar reseñas por valoración"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
              >
                <option value="all">Todas las valoraciones</option>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating} estrella(s)
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
                    <th scope="col" className="px-5 py-2.5 font-semibold">Reseña</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Comprador</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Comercio</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Valoración</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Pedido</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Creada</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((review) => {
                    const actions = buildActions(review, hasPermission);

                    return (
                      <tr key={review.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => openDetail(review)}
                            className="block max-w-xs truncate text-left text-sm font-semibold text-slate-900 hover:text-[#4B227A] hover:underline"
                          >
                            {review.comment || 'Sin comentario'}
                          </button>
                          <p className="truncate text-xs text-slate-500">
                            {review.statusReason || 'Sin motivo de moderación'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {review.buyerName || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {review.commerceName || '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <Rating value={review.rating} />
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={review.status} />
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {review.orderNumber || '—'}
                        </td>
                        <td
                          className="px-5 py-3.5 text-sm text-slate-600"
                          title={formatDateTime(review.createdAt)}
                        >
                          {formatRelative(review.createdAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetail(review)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              Ficha
                            </button>
                            {actions.map((action) => {
                              const Icon = action.Icon;
                              const toneClasses =
                                action.tone === 'danger'
                                  ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100';

                              return (
                                <button
                                  key={action.key}
                                  type="button"
                                  onClick={() => setActionTarget({ ...action, review })}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${toneClasses}`}
                                >
                                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                  {action.label}
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
                Icon={Star}
                title="Sin reseñas para este filtro"
                description="Prueba con otro estado, otra valoración o limpia la búsqueda."
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
          <li>Ver reseñas exige <code className="font-mono">reviews.view</code>.</li>
          <li>Ocultar, restaurar, marcar o publicar exige <code className="font-mono">reviews.moderate</code>.</li>
          <li>Toda acción exige motivo y genera un evento de auditoría.</li>
        </ul>
      </div>

      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Ficha de la reseña"
        description="Contenido, valoración y trazabilidad de moderación."
        size="lg"
      >
        {detailTarget ? <ReviewDetail review={detailTarget} /> : null}
      </Modal>

      <ReasonDialog
        open={Boolean(actionTarget)}
        title={actionTarget?.title || 'Moderar reseña'}
        description={actionTarget ? `${actionTarget.review.comment}. ${actionTarget.description}` : ''}
        reasons={actionTarget?.reasons || []}
        confirmLabel={actionTarget?.label || 'Confirmar'}
        tone={actionTarget?.tone || 'danger'}
        busy={actionBusy}
        onConfirm={confirmAction}
        onClose={() => setActionTarget(null)}
      />
    </div>
  );
}
