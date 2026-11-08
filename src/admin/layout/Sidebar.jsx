import { NavLink } from 'react-router-dom';
import {
  BadgeDollarSign,
  BarChart3,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  Package,
  ScrollText,
  Settings,
  ShieldAlert,
  Star,
  Store,
  Tags,
  Truck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { NAVIGATION_GROUPS } from '../constants/navigation';
import { useAdminAuth } from '../auth/useAdminAuth';

const ICONS = {
  LayoutDashboard,
  Users,
  Store,
  ClipboardList,
  BadgeDollarSign,
  Tags,
  Package,
  Truck,
  CreditCard,
  MessagesSquare,
  ShieldAlert,
  Star,
  LifeBuoy,
  Megaphone,
  BarChart3,
  UserCog,
  ScrollText,
  Settings,
};

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile }) {
  const { hasPermission, mode } = useAdminAuth();

  const groups = NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermission(item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#3A1A5E] text-white transition-all duration-200 lg:static lg:z-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'w-20' : 'w-72'}`}
        aria-label="Menú administrativo"
      >
        <div className={`flex items-center gap-3 border-b border-white/10 px-4 py-5 ${collapsed ? 'justify-center' : ''}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#00EED0] text-[#3A1A5E] shadow-[0_0_20px_rgba(0,238,208,0.35)]">
            <MessagesSquare className="h-5 w-5" aria-hidden="true" />
          </span>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">Chat de Compras</p>
              <p className="truncate text-xs text-white/60">Administración</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto rounded-lg p-2 text-white/70 hover:bg-white/10 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.key}>
              {group.label && !collapsed ? (
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  {group.label}
                </p>
              ) : null}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = ICONS[item.icon] || LayoutDashboard;
                  return (
                    <li key={item.key}>
                      <NavLink
                        to={item.path}
                        end={item.path === '/'}
                        onClick={onCloseMobile}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            isActive
                              ? 'bg-white/10 text-white shadow-inner ring-1 ring-inset ring-white/10'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          } ${collapsed ? 'justify-center' : ''}`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-[#00EED0]' : 'text-white/60 group-hover:text-white/90'}`}
                              aria-hidden="true"
                            />
                            {!collapsed ? (
                              <>
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                {item.phase > 1 ? (
                                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/60">
                                    F{item.phase}
                                  </span>
                                ) : null}
                              </>
                            ) : null}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className={`border-t border-white/10 p-3 ${collapsed ? 'text-center' : ''}`}>
          {!collapsed ? (
            <div className="rounded-xl bg-white/5 px-3 py-2.5">
              <p className="flex items-center gap-2 text-xs font-semibold text-white/80">
                <span className={`h-2 w-2 rounded-full ${mode === 'insforge' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {mode === 'insforge' ? 'InsForge conectado' : 'Modo demostración'}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-white/45">Fase 3 · Operación</p>
            </div>
          ) : (
            <span
              className={`mx-auto block h-2.5 w-2.5 rounded-full ${mode === 'insforge' ? 'bg-emerald-400' : 'bg-amber-400'}`}
              title={mode === 'insforge' ? 'InsForge conectado' : 'Modo demostración'}
            />
          )}
        </div>
      </aside>
    </>
  );
}
