import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, MessageCircle, Wrench } from 'lucide-react';
import ViewSwitcher from '../../components/layout/ViewSwitcher';
import WorkshopJobsPanel from '../../components/workshop/WorkshopJobsPanel';
import WorkshopPlateHistory from '../../components/workshop/WorkshopPlateHistory';
import { useAuth } from '../../context/auth-context';

// Vista de "modo empresa" para un Taller Verificado. No cambia el rol de la
// cuenta: activa la vista de negocio solo mientras esta pantalla está abierta.
// El cambio de vista vive en el switcher superior compartido, así que aquí no
// se repite ningún botón de retorno ni barra inferior de cambio de modo.
export default function WorkshopJobsPage() {
  const { user, workshopVerified, viewMode, setViewMode } = useAuth();
  const navigate = useNavigate();
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

  const canWork = user?.role === 'commerce' || workshopVerified;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#E7E7E7] pb-24">
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
          <span className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#4B227A]/10 text-[#4B227A]">
            <Wrench className="w-5 h-5" aria-hidden="true" />
          </span>
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
            <WorkshopJobsPanel />
            <div className="mt-6">
              <WorkshopPlateHistory />
            </div>

            {/* Acceso destacado al final del Panel de Trabajo. */}
            <button
              type="button"
              onClick={() => navigate('/workshop-jobs/responses')}
              className="mt-6 w-full rounded-2xl border border-[#00EED0]/30 bg-[#0B1020] px-5 py-4 text-left text-white shadow-[0_0_24px_rgba(0,238,208,0.12)] transition hover:border-[#00EED0]/60 hover:shadow-[0_0_30px_rgba(0,238,208,0.25)]"
            >
              <span className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00EED0]/15 text-[#00EED0]">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">Respuestas de mis ofertas</span>
                  <span className="mt-0.5 block text-[11px] text-slate-300">
                    Abre la bandeja de chat para negociar y confirmar servicios.
                  </span>
                </span>
                <span aria-hidden="true" className="text-[#00EED0]">→</span>
              </span>
            </button>
          </>
        )}
      </main>
    </div>
  );
}
