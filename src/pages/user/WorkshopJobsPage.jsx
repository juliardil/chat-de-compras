import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Car,
  Menu,
  MessageCircle,
  Package,
  Settings,
  Wrench,
  X,
} from 'lucide-react';
import ViewSwitcher from '../../components/layout/ViewSwitcher';
import WorkshopJobsPanel from '../../components/workshop/WorkshopJobsPanel';
import WorkshopPlateHistory from '../../components/workshop/WorkshopPlateHistory';
import { useAuth } from '../../context/auth-context';

// Vista de "modo empresa" para un Taller Verificado. No cambia el rol de la
// cuenta: activa la vista de negocio solo mientras esta pantalla está abierta.
// El cambio de vista vive en el switcher superior compartido, así que aquí no
// se repite ningún botón de retorno ni barra inferior: los accesos secundarios
// viven en el menú hamburguesa (mismo estilo que /dashboard) y el chat de cada
// propuesta se abre como bottom-sheet sin salir de esta pantalla.
export default function WorkshopJobsPage() {
  const { user, workshopVerified, viewMode, setViewMode } = useAuth();
  const navigate = useNavigate();
  const setViewModeRef = useRef(setViewMode);
  const menuRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('jobs');
  const [showPlateHistory, setShowPlateHistory] = useState(false);

  useEffect(() => {
    setViewModeRef.current = setViewMode;
  }, [setViewMode]);

  useEffect(() => {
    if (user?.role !== 'commerce') setViewModeRef.current('business');
    return () => {
      if (user?.role !== 'commerce') setViewModeRef.current('buyer');
    };
  }, [user?.role]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const canWork = user?.role === 'commerce' || workshopVerified;
  const isCommerce = user?.role === 'commerce';

  // El inventario sigue disponible para quienes venden productos o repuestos.
  // Un taller verificado solo cotiza servicios: no se le ofrece esa acción.
  const menuItems = [
    ...(isCommerce ? [{ icon: Package, label: 'Mi Inventario', path: '/inventory' }] : []),
    { icon: Car, label: 'Historial por placa', action: 'history' },
    {
      icon: Settings,
      label: 'Ajustes',
      path: isCommerce ? '/niche-config' : '/edit-user-profile',
    },
  ];

  const handleMenuAction = (item) => {
    setIsMenuOpen(false);
    if (item.action === 'history') {
      setShowPlateHistory(true);
      return;
    }
    navigate(item.path);
  };

  const handleMenuNavigate = (path) => {
    setIsMenuOpen(false);
    navigate(path);
  };

  const tabs = [
    { id: 'jobs', label: 'Trabajos disponibles' },
    { id: 'proposals', label: 'Mis propuestas' },
  ];

  const tabClass = (id) =>
    `flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0197AF]/40 ${
      activeTab === id
        ? 'bg-[#4B227A] text-white shadow'
        : 'text-[#4B227A] hover:bg-[#4B227A]/10'
    }`;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#E7E7E7] pb-10">
      <header className="bg-white/80 backdrop-blur-md px-6 pt-12 pb-6 rounded-b-[32px] shadow-sm border-b border-white/30">
        <ViewSwitcher />

        <div className="mt-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#006E7A]">
              Modo Empresa · Taller Verificado
            </p>
            <h1 className="mt-1 text-xl font-bold text-gray-800">Panel de Trabajos</h1>
            <p className="mt-1 text-xs text-gray-600">
              Cotiza instalaciones y reparaciones. Tus respuestas llegan al flujo de ofertas.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#4B227A]/10 text-[#4B227A]">
              <Wrench className="w-5 h-5" aria-hidden="true" />
            </span>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((open) => !open)}
                aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                className="p-2 bg-white/60 backdrop-blur-md rounded-full hover:bg-white/80 transition-colors border border-white/30"
              >
                {isMenuOpen
                  ? <X className="w-5 h-5 text-gray-700" />
                  : <Menu className="w-5 h-5 text-gray-700" />}
              </button>

              {isMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-52 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 overflow-hidden z-50"
                >
                  {menuItems.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      onClick={() => handleMenuAction(item)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:bg-white transition-colors border-b border-white/40 last:border-b-0"
                    >
                      <item.icon className="w-4 h-4 text-[#006E7A]" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleMenuNavigate('/workshop-jobs/responses')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:bg-white transition-colors border-t border-[#4B227A]/10"
                  >
                    <MessageCircle className="w-4 h-4 text-[#006E7A]" aria-hidden="true" />
                    <span className="flex-1">Respuestas de mis ofertas</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {workshopVerified || viewMode === 'business' ? (
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-[11px] font-bold text-green-700">
            <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" /> Taller Verificado
          </p>
        ) : null}
      </header>

      <main className="px-6 mt-6">
        {!canWork ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-6 text-center">
            <p className="text-sm font-semibold text-amber-900">
              Tu taller todavía no está verificado.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Cuando el administrador active la verificación podrás cotizar trabajos aquí.
            </p>
          </div>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Secciones del Panel de Trabajos"
              className="flex gap-2 rounded-2xl border border-white/40 bg-white/70 p-1 shadow-sm"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={tabClass(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-5" role="tabpanel" aria-label={tabs.find((tab) => tab.id === activeTab)?.label}>
              <WorkshopJobsPanel activeTab={activeTab} embedded />
            </div>
          </>
        )}
      </main>

      {showPlateHistory ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowPlateHistory(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Historial por placa"
            className="bg-white/90 backdrop-blur-md w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 duration-200 border border-white/30"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Cerrar historial por placa"
              onClick={() => setShowPlateHistory(false)}
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-800"
            >
              <X className="w-6 h-6" />
            </button>
            <WorkshopPlateHistory />
          </div>
        </div>
      ) : null}
    </div>
  );
}
