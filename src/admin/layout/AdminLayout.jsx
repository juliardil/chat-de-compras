import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Clock } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAdminAuth } from '../auth/useAdminAuth';

const COLLAPSE_KEY = 'chat_compras_admin_sidebar_collapsed_v1';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

export default function AdminLayout() {
  const { warning, extendSession } = useAdminAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // Preferencia solo para esta sesión.
    }
  }, [collapsed]);

  return (
    <div className="flex min-h-screen bg-[#F5F6F8]">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((current) => !current)}
          onOpenMobile={() => setMobileOpen(true)}
        />

        {warning ? (
          <div className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="flex items-center gap-2 font-medium">
              <Clock className="h-4 w-4" aria-hidden="true" />
              Tu sesión está a punto de expirar por inactividad.
            </p>
            <button
              type="button"
              onClick={extendSession}
              className="self-start rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-950 sm:self-auto"
            >
              Extender sesión
            </button>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
