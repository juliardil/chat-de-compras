import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CornerDownRight,
  FolderTree,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Tags,
  ToggleLeft,
  ToggleRight,
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
import { CATEGORY_ACTION_REASONS, CATEGORY_STATUSES } from '../constants/phase2';
import { slugify } from '../utils/mask';

const sortCategories = (a, b) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);

function matchesSearch(category, term) {
  if (!term) return true;
  return [category.name, category.slug, category.description, category.parentName]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

function CategoryForm({
  form,
  parents,
  busy,
  error,
  onChange,
  onSubmit,
  onClose,
}) {
  const isEdit = form.mode === 'edit';
  const parentLocked = isEdit && form.hasChildren;

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={isEdit ? 'Editar categoría' : 'Nueva categoría'}
      description={
        isEdit
          ? 'Los cambios de nombre, jerarquía y orden quedan auditados.'
          : 'Las categorías se crean activas y nunca se eliminan: se desactivan.'
      }
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="category-form"
            disabled={busy || !form.name.trim()}
            className="rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear categoría'}
          </button>
        </div>
      }
    >
      <form id="category-form" className="space-y-4" onSubmit={onSubmit}>
        {error ? (
          <Alert tone="danger" title="No se pudo guardar">
            {error}
          </Alert>
        ) : null}

        <div>
          <label htmlFor="category-name" className="text-sm font-medium text-slate-700">
            Nombre
          </label>
          <input
            id="category-name"
            type="text"
            value={form.name}
            onChange={(event) => onChange({ name: event.target.value })}
            maxLength={80}
            autoFocus
            placeholder="Ej. Frenos"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          />
          <p className="mt-1 text-xs text-slate-400">
            Identificador: <code className="font-mono">{slugify(form.name) || '—'}</code>
          </p>
        </div>

        <div>
          <label htmlFor="category-parent" className="text-sm font-medium text-slate-700">
            Categoría padre
          </label>
          <select
            id="category-parent"
            value={form.parentId}
            onChange={(event) => onChange({ parentId: event.target.value })}
            disabled={parentLocked}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">Sin categoría padre (nivel principal)</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            {parentLocked
              ? 'Esta categoría tiene subcategorías: no se puede mover de nivel.'
              : 'Solo se admiten dos niveles. Una subcategoría no puede tener hijas.'}
          </p>
        </div>

        <div>
          <label htmlFor="category-description" className="text-sm font-medium text-slate-700">
            Descripción (opcional)
          </label>
          <textarea
            id="category-description"
            value={form.description}
            onChange={(event) => onChange({ description: event.target.value })}
            rows={3}
            maxLength={280}
            placeholder="Qué agrupa esta categoría"
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          />
        </div>

        <div>
          <label htmlFor="category-order" className="text-sm font-medium text-slate-700">
            Orden
          </label>
          <input
            id="category-order"
            type="number"
            value={form.sortOrder}
            onChange={(event) => onChange({ sortOrder: event.target.value })}
            step={1}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          />
          <p className="mt-1 text-xs text-slate-400">
            Menor número aparece primero. Las subcategorías se ordenan dentro de su padre.
          </p>
        </div>

        <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-500">
          Crear y editar categorías queda registrado en la auditoría con tu usuario y la fecha. No
          existe borrado de categorías en esta fase.
        </p>
      </form>
    </Modal>
  );
}

export default function Categories() {
  const { session, hasPermission, mode } = useAdminAuth();
  const { notify } = useToast();
  const [state, setState] = useState({ loading: true, error: null, categories: [] });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [statusAction, setStatusAction] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const canCreate = hasPermission('catalog.create');
  const canUpdate = hasPermission('catalog.update');
  const canDeactivate = hasPermission('catalog.deactivate');

  const refresh = useCallback(async () => {
    try {
      const categories = await adminRepository.listCategories({ actor: session });
      setState({ loading: false, error: null, categories });
    } catch (error) {
      setState({ loading: false, error: error.message, categories: [] });
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const categories = await adminRepository.listCategories({ actor: session });
        if (!cancelled) setState({ loading: false, error: null, categories });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, categories: [] });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = state.categories.filter((category) => {
      if (statusFilter !== 'all' && category.status !== statusFilter) return false;
      return matchesSearch(category, term);
    });

    // Mantiene el contexto del padre cuando coincide una subcategoría.
    const visibleIds = new Set(matches.map((category) => category.id));
    matches.forEach((category) => {
      if (category.parentId) visibleIds.add(category.parentId);
    });

    return state.categories.filter((category) => visibleIds.has(category.id));
  }, [state.categories, search, statusFilter]);

  const rows = useMemo(() => {
    const byId = new Map(filtered.map((category) => [category.id, category]));
    const roots = filtered
      .filter((category) => !category.parentId || !byId.has(category.parentId))
      .slice()
      .sort(sortCategories);

    const result = [];
    const seen = new Set();

    roots.forEach((root) => {
      if (seen.has(root.id)) return;
      seen.add(root.id);
      result.push({ category: root, depth: 0 });

      filtered
        .filter((category) => category.parentId === root.id)
        .slice()
        .sort(sortCategories)
        .forEach((child) => {
          if (seen.has(child.id)) return;
          seen.add(child.id);
          result.push({ category: child, depth: 1 });
        });
    });

    filtered.forEach((category) => {
      if (seen.has(category.id)) return;
      seen.add(category.id);
      result.push({ category, depth: category.parentId ? 1 : 0 });
    });

    return result;
  }, [filtered]);

  const activeCount = state.categories.filter((category) => category.status === 'active').length;
  const inactiveCount = state.categories.length - activeCount;

  const openCreate = (parentId = '') => {
    setFormError(null);
    setForm({
      mode: 'create',
      categoryId: null,
      hasChildren: false,
      name: '',
      parentId,
      description: '',
      sortOrder: 0,
    });
  };

  const openEdit = (category) => {
    setFormError(null);
    setForm({
      mode: 'edit',
      categoryId: category.id,
      hasChildren: category.childCount > 0,
      name: category.name,
      parentId: category.parentId || '',
      description: category.description || '',
      sortOrder: category.sortOrder ?? 0,
    });
  };

  const parentOptions = useMemo(() => {
    if (!form) return [];
    return state.categories
      .filter((category) => !category.parentId && category.id !== form.categoryId)
      .slice()
      .sort(sortCategories);
  }, [state.categories, form]);

  const submitForm = async (event) => {
    event.preventDefault();
    if (!form) return;

    setFormBusy(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      parentId: form.parentId || null,
      description: form.description.trim(),
      sortOrder: Number(form.sortOrder) || 0,
      actor: session,
    };

    try {
      if (form.mode === 'create') {
        await adminRepository.createCategory(payload);
        notify({
          title: 'Categoría creada',
          description: payload.parentId ? 'Subcategoría añadida al catálogo.' : 'Categoría principal añadida.',
        });
      } else {
        await adminRepository.updateCategory({ categoryId: form.categoryId, ...payload });
        notify({ title: 'Categoría actualizada', description: payload.name });
      }
      setForm(null);
      await refresh();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setFormBusy(false);
    }
  };

  const openStatusAction = (category) => {
    const nextStatus = category.status === 'active' ? 'inactive' : 'active';
    const isDeactivate = nextStatus === 'inactive';

    setStatusAction({
      category,
      nextStatus,
      reasons: isDeactivate
        ? CATEGORY_ACTION_REASONS.deactivate
        : CATEGORY_ACTION_REASONS.activate,
      title: isDeactivate ? 'Desactivar categoría' : 'Activar categoría',
      label: isDeactivate ? 'Desactivar' : 'Activar',
      tone: isDeactivate ? 'danger' : 'primary',
      description: isDeactivate
        ? 'La categoría dejará de ofrecerse, pero se conserva y puede reactivarse. Requiere motivo y queda auditada.'
        : 'La categoría volverá a estar disponible. Requiere motivo y queda auditada.',
      successTitle: isDeactivate ? 'Categoría desactivada' : 'Categoría activada',
    });
  };

  const confirmStatusAction = async ({ reason, detail }) => {
    if (!statusAction) return;

    const label = statusAction.reasons.find((item) => item.value === reason)?.label || reason;
    const reasonText = detail ? `${label}: ${detail}` : label;

    setActionBusy(true);
    try {
      await adminRepository.setCategoryStatus({
        categoryId: statusAction.category.id,
        status: statusAction.nextStatus,
        reason: reasonText,
        reasonCode: reason,
        actor: session,
      });
      notify({
        title: statusAction.successTitle,
        description: statusAction.category.name,
      });
      setStatusAction(null);
      await refresh();
    } catch (error) {
      notify({ tone: 'error', title: 'No se pudo cambiar el estado', description: error.message });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mercado"
        title="Categorías y datos"
        description="Catálogo de dos niveles para clasificar comercios. Las categorías se activan o desactivan; nunca se eliminan, para no perder el historial asociado."
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={() => openCreate()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#3A1A5E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2E144A]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nueva categoría
            </button>
          ) : null
        }
      />

      {mode === 'demo' ? (
        <Alert tone="warning" title="Catálogo de demostración">
          Estas categorías y sus cambios son ejemplos guardados en este navegador. No representan
          el catálogo real de la plataforma.
        </Alert>
      ) : null}

      {!canDeactivate ? (
        <Alert tone="info" title="Activación y desactivación restringidas">
          Puedes consultar el catálogo, pero activar o desactivar categorías requiere{' '}
          <code className="font-mono text-xs">catalog.deactivate</code>.
        </Alert>
      ) : null}

      {state.loading ? <Spinner label="Cargando categorías…" /> : null}

      {state.error ? (
        <Alert tone="danger" title="No se pudieron cargar las categorías">
          {state.error}
        </Alert>
      ) : null}

      {!state.loading && !state.error ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Categorías</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{state.categories.length}</p>
              <p className="mt-1 text-xs text-slate-500">Dos niveles como máximo</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Activas</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{activeCount}</p>
              <p className="mt-1 text-xs text-emerald-700">Disponibles para clasificar comercios</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inactivas</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{inactiveCount}</p>
              <p className="mt-1 text-xs text-slate-500">Conservadas, no eliminadas</p>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FolderTree className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
                Árbol de categorías
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
                    placeholder="Buscar nombre, slug o descripción…"
                    aria-label="Buscar categorías"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15 sm:w-72"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filtrar categorías por estado"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
                >
                  <option value="all">Todos los estados</option>
                  <option value={CATEGORY_STATUSES[0]}>Activas</option>
                  <option value={CATEGORY_STATUSES[1]}>Inactivas</option>
                </select>
              </div>
            </div>

            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                      <th scope="col" className="px-5 py-2.5 font-semibold">Categoría</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Nivel</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Subcategorías</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Comercios</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Estado</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ category, depth }) => {
                      const isParent = depth === 0;
                      const blockedByChildren =
                        category.status === 'active' && (category.activeChildCount || 0) > 0;

                      return (
                        <tr
                          key={category.id}
                          className={`border-b border-slate-100 last:border-0 ${
                            isParent ? 'bg-white' : 'bg-slate-50/40'
                          }`}
                        >
                          <td className="px-5 py-3">
                            <div className={`flex items-start gap-2.5 ${depth ? 'pl-6' : ''}`}>
                              <span
                                className={`mt-0.5 rounded-lg p-1.5 ring-1 ${
                                  isParent
                                    ? 'bg-[#4B227A]/10 text-[#4B227A] ring-[#4B227A]/10'
                                    : 'bg-white text-slate-400 ring-slate-200'
                                }`}
                              >
                                {depth ? (
                                  <CornerDownRight className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <Tags className="h-4 w-4" aria-hidden="true" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {category.name}
                                </p>
                                <p className="font-mono text-[11px] text-slate-400">{category.slug}</p>
                                {category.description ? (
                                  <p className="mt-0.5 max-w-md truncate text-xs text-slate-500">
                                    {category.description}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">
                            {depth ? 'Subcategoría' : 'Principal'}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">
                            {category.childCount || 0}
                            {category.activeChildCount ? (
                              <span className="ml-1 text-xs text-slate-400">
                                ({category.activeChildCount} activa(s))
                              </span>
                            ) : null}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">
                            {category.commerceCount || 0}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={category.status} />
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {canCreate && isParent ? (
                                <button
                                  type="button"
                                  onClick={() => openCreate(category.id)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                  Subcategoría
                                </button>
                              ) : null}

                              {canUpdate ? (
                                <button
                                  type="button"
                                  onClick={() => openEdit(category)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                  Editar
                                </button>
                              ) : null}

                              {canDeactivate ? (
                                <button
                                  type="button"
                                  onClick={() => openStatusAction(category)}
                                  disabled={blockedByChildren}
                                  title={
                                    blockedByChildren
                                      ? 'Desactiva primero las subcategorías activas'
                                      : undefined
                                  }
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    category.status === 'active'
                                      ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  }`}
                                >
                                  {category.status === 'active' ? (
                                    <ToggleLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                  ) : (
                                    <ToggleRight className="h-3.5 w-3.5" aria-hidden="true" />
                                  )}
                                  {category.status === 'active' ? 'Desactivar' : 'Activar'}
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
                  Icon={FolderTree}
                  title="Sin categorías para este filtro"
                  description="Prueba con otro estado, limpia la búsqueda o crea la primera categoría."
                  action={
                    canCreate ? (
                      <button
                        type="button"
                        onClick={() => openCreate()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#4B227A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A1A5E]"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Nueva categoría
                      </button>
                    ) : null
                  }
                />
              </div>
            )}
          </section>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs leading-6 text-slate-500 shadow-sm">
            <p className="flex items-center gap-2 font-semibold text-slate-700">
              <ShieldCheck className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
              Reglas del catálogo
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>Máximo dos niveles: las subcategorías no pueden tener hijas.</li>
              <li>Una categoría con subcategorías no se puede mover de nivel.</li>
              <li>No se puede desactivar un padre mientras tenga subcategorías activas.</li>
              <li>Las categorías no se eliminan: se desactivan y conservan sus comercios asociados.</li>
              <li>Crear y editar requiere <code className="font-mono">catalog.create</code> / <code className="font-mono">catalog.update</code>; activar y desactivar requiere <code className="font-mono">catalog.deactivate</code>.</li>
            </ul>
          </div>
        </>
      ) : null}

      {form ? (
        <CategoryForm
          form={form}
          parents={parentOptions}
          busy={formBusy}
          error={formError}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          onSubmit={submitForm}
          onClose={() => setForm(null)}
        />
      ) : null}

      <ReasonDialog
        open={Boolean(statusAction)}
        title={statusAction?.title || 'Cambiar estado'}
        description={
          statusAction
            ? `${statusAction.category.name}. ${statusAction.description}`
            : ''
        }
        reasons={statusAction?.reasons || []}
        confirmLabel={statusAction?.label || 'Confirmar'}
        tone={statusAction?.tone || 'danger'}
        busy={actionBusy}
        onConfirm={confirmStatusAction}
        onClose={() => setStatusAction(null)}
      />
    </div>
  );
}
