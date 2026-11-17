import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, ShoppingCart, Wrench } from 'lucide-react';
import Button from '../../components/ui/Button';
import WorkshopJobsPanel from '../../components/workshop/WorkshopJobsPanel';
import WorkshopPlateHistory from '../../components/workshop/WorkshopPlateHistory';
import { useAuth } from '../../context/auth-context';

// Vista de "modo empresa" para un Taller Verificado. No cambia el rol de la
// cuenta: activa la vista de negocio solo mientras esta pantalla está abierta y
// ofrece un regreso explícito al modo comprador B2B.
export default function WorkshopJobsPage() {
  const navigate = useNavigate();
  const { user, workshopVerified, viewMode, setViewMode } = useAuth();
  const setViewModeRef = useRef(setViewMode);

  useEffect(() => {
    setViewModeRef.current = setViewMode;
  }, [setViewMode]);

  useEffect(() => {
    if (user?.role !== 'commerce') setViewModeRef.current('business');
    return () => {
      if (user?.role !== 'commerce') setViewModeRef.current('buyer');
    };
  }, [user?.role]);

  const goToParts = () => {
    setViewModeRef.current('buyer');
    navigate('/categories');
  };

  const canWork = user?.role === 'commerce' || workshopVerified;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#E7E7E7] pb-24">
      <header className="bg-white/80 backdrop-blur-md px-6 pt-12 pb-6 rounded-b-[32px] shadow-sm border-b border-white/30">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#006E7A]">
              Modo Empresa · Taller Verificado
            </p>
            <h1 className="mt-1 text-xl font-bold text-gray-800">Panel de Trabajos</h1>
            <p className="mt-1 text-xs text-gray-600">
              Cotiza instalaciones y reparaciones. Tus respuestas llegan al flujo de ofertas.
            </p>
          </div>
          <span className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#4B227A]/10 text-[#4B227A]">
            <Wrench className="w-5 h-5" aria-hidden="true" />
          </span>
        </div>

        {workshopVerified || viewMode === 'business' ? (
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-[11px] font-bold text-green-700">
            <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" /> Taller Verificado
          </p>
        ) : null}

        <Button type="button" fullWidth onClick={goToParts} className="mt-4">
          <ShoppingCart className="w-4 h-4" /> 🛒 Comprar Repuestos (Modo Taller B2B)
        </Button>
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
            <Button type="button" variant="secondary" className="mt-4" onClick={goToParts}>
              Volver a comprar repuestos
            </Button>
          </div>
        ) : (
          <>
            <WorkshopJobsPanel />
            <div className="mt-6">
              <WorkshopPlateHistory />
            </div>
          </>
        )}
      </main>

      <nav
        aria-label="Cambiar de modo"
        className="fixed bottom-0 left-1/2 z-10 w-full max-w-md -translate-x-1/2 border-t border-[#4B227A]/10 bg-white/95 px-6 py-3 backdrop-blur"
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-current="page"
            className="rounded-xl bg-[#4B227A] px-3 py-2.5 text-[11px] font-bold text-white"
          >
            <Wrench className="mx-auto mb-1 w-4 h-4" aria-hidden="true" />
            Panel de Trabajos
          </button>
          <button
            type="button"
            onClick={goToParts}
            className="rounded-xl bg-[#4B227A]/10 px-3 py-2.5 text-[11px] font-bold text-[#4B227A]"
          >
            <ShoppingCart className="mx-auto mb-1 w-4 h-4" aria-hidden="true" />
            Comprar Repuestos
          </button>
        </div>
      </nav>
    </div>
  );
}
