import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-16 text-center">
      <span className="rounded-3xl bg-slate-100 p-4 text-slate-500">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </span>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Error 404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Pantalla no encontrada</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        La ruta administrativa no existe o cambió de nombre. Usa el menú lateral o vuelve al panel.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#3A1A5E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2E144A]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver al panel
      </Link>
    </div>
  );
}
