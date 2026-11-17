import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';

const BUYER_PATH = '/categories';
const JOBS_PATH = '/workshop-jobs';

// Switcher superior compartido: única entrada a cada vista (compras / taller).
// El botón activo se resalta según la ruta, así que no hace falta duplicar
// accesos al panel dentro de las tarjetas ni en barras inferiores.
export default function ViewSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setViewMode } = useAuth() || {};

  const jobsActive = location.pathname === JOBS_PATH;

  const changeView = (path, mode) => {
    if (typeof setViewMode === 'function') setViewMode(mode);
    navigate(path);
  };

  const buttonClass =
    'flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0197AF]/40';

  return (
    <nav
      aria-label="Cambiar de vista"
      className="flex gap-2 rounded-2xl border border-white/40 bg-white/70 p-1 shadow-sm"
    >
      <button
        type="button"
        aria-current={jobsActive ? undefined : 'page'}
        onClick={() => changeView(BUYER_PATH, 'buyer')}
        className={`${buttonClass} ${
          jobsActive
            ? 'text-[#4B227A] hover:bg-[#4B227A]/10'
            : 'bg-[#4B227A] text-white shadow'
        }`}
      >
        🛒 Compras
      </button>
      <button
        type="button"
        aria-current={jobsActive ? 'page' : undefined}
        onClick={() => changeView(JOBS_PATH, 'business')}
        className={`${buttonClass} ${
          jobsActive
            ? 'bg-[#4B227A] text-white shadow'
            : 'text-[#4B227A] hover:bg-[#4B227A]/10'
        }`}
      >
        🔧 Panel de Trabajo
      </button>
    </nav>
  );
}
