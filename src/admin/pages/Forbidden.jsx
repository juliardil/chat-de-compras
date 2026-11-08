import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAdminAuth } from '../auth/useAdminAuth';

export default function Forbidden() {
  const { session } = useAdminAuth();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-16 text-center">
      <span className="rounded-3xl bg-amber-50 p-4 text-amber-600 ring-1 ring-amber-200">
        <ShieldAlert className="h-8 w-8" aria-hidden="true" />
      </span>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Error 403</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">No tienes permiso para esta sección</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Tu rol actual es <strong className="text-slate-700">{session?.roleName || 'sin rol'}</strong>. Si
        necesitas acceso, solicítalo a un superadministrador. El servidor volverá a comprobar el
        permiso aunque la ruta se abra manualmente.
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
