import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck } from 'lucide-react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { NAVIGATION_ITEMS } from '../constants/navigation';
import { GLOBAL_SEARCH_MIN_LENGTH } from '../constants/phase5';
import { adminRepository } from '../data';
import { initials } from '../utils/format';

function GlobalSearch({ collapsed }) {
  const navigate = useNavigate();
  const { session, hasPermission } = useAdminAuth();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [entityState, setEntityState] = useState({
    searching: false,
    results: [],
    total: 0,
    truncated: false,
    searchError: null,
  });
  const containerRef = useRef(null);

  const items = useMemo(
    () => NAVIGATION_ITEMS.filter((item) => hasPermission(item.permission)),
    [hasPermission]
  );

  const navResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.label.toLowerCase().includes(term));
  }, [items, query]);

  const term = query.trim();
  const searchingEntities = term.length >= GLOBAL_SEARCH_MIN_LENGTH;

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!searchingEntities) {
      setEntityState({ searching: false, results: [], total: 0, truncated: false, searchError: null });
      return undefined;
    }

    let cancelled = false;
    setEntityState((current) => ({ ...current, searching: true, searchError: null }));

    const timer = window.setTimeout(async () => {
      try {
        const response = await adminRepository.globalSearch({ query: term, actor: session });
        if (cancelled) return;
        setEntityState({
          searching: false,
          results: response.results || [],
          total: response.total || 0,
          truncated: Boolean(response.truncated),
          searchError: null,
        });
      } catch (error) {
        if (cancelled) return;
        setEntityState({
          searching: false,
          results: [],
          total: 0,
          truncated: false,
          searchError: error.message,
        });
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term, searchingEntities, session]);

  const go = (path) => {
    navigate(path);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${collapsed ? 'max-w-xs' : 'w-full max-w-xl'}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter') {
              if (entityState.results[0]) go(entityState.results[0].path);
              else if (navResults[0]) go(navResults[0].path);
            }
          }}
          placeholder="Buscar secciones, pedidos, comercios…"
          aria-label="Buscar en el panel"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
        />
      </div>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Navegación · Fase 5
          </p>
          {navResults.length ? (
            <ul className="max-h-48 overflow-y-auto py-1">
              {navResults.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => go(item.path)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <span>{item.label}</span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      Fase {item.phase}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {searchingEntities ? (
            <>
              <p className="border-y border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Resultados · metadatos
              </p>
              {entityState.searching ? (
                <p className="px-3 py-3 text-sm text-slate-500">Buscando…</p>
              ) : null}
              {!entityState.searching && entityState.searchError ? (
                <p className="px-3 py-3 text-sm text-red-600">{entityState.searchError}</p>
              ) : null}
              {!entityState.searching && !entityState.searchError && entityState.results.length ? (
                <ul className="max-h-64 overflow-y-auto py-1">
                  {entityState.results.map((result) => (
                    <li key={`${result.type}-${result.id}`}>
                      <button
                        type="button"
                        onClick={() => go(result.path)}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800">
                            {result.title}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {result.subtitle || '—'}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-md bg-[#006E7A]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#006E7A]">
                          {result.typeLabel}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!entityState.searching &&
              !entityState.searchError &&
              !entityState.results.length ? (
                <p className="px-3 py-3 text-sm text-slate-500">
                  Sin coincidencias de metadatos para «{term}».
                </p>
              ) : null}
              {entityState.truncated ? (
                <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
                  Mostrando 20 de {entityState.total} resultados. Afina la búsqueda.
                </p>
              ) : null}
            </>
          ) : (
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
              Escribe al menos {GLOBAL_SEARCH_MIN_LENGTH} caracteres para buscar compradores,
              comercios, solicitudes, ofertas, pedidos, entregas, chats y tickets.
            </p>
          )}

          <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-400">
            La búsqueda global devuelve solo metadatos y respeta tus permisos. Nunca incluye el
            contenido de los chats.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function Topbar({ onToggleCollapsed, collapsed, onOpenMobile }) {
  const { session, logout, mode } = useAdminAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMobile}
        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onToggleCollapsed}
        className="hidden rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 lg:inline-flex"
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
        ) : (
          <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      <div className="hidden flex-1 sm:block">
        <GlobalSearch collapsed={collapsed} />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <span
          className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset sm:inline-flex ${
            mode === 'insforge'
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-amber-50 text-amber-700 ring-amber-200'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {mode === 'insforge' ? 'InsForge' : 'Demostración'}
        </span>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-100"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4B227A] text-xs font-bold text-white">
              {initials(session?.name)}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm font-semibold text-slate-800">{session?.name}</span>
              <span className="block truncate text-xs text-slate-500">{session?.roleName}</span>
            </span>
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-900">{session?.name}</p>
                <p className="truncate text-xs text-slate-500">{session?.email}</p>
                <p className="mt-2 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {session?.roleName}
                </p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
