import { Clock3, LogIn } from 'lucide-react';
import { useAdminAuth } from '../auth/useAdminAuth';

export default function SessionExpired() {
  const { logout } = useAdminAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F6F8] px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
          <Clock3 className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">Sesión expirada</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Por seguridad, la sesión administrativa se cierra tras un periodo de inactividad. Vuelve a
          iniciar sesión para continuar.
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3A1A5E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2E144A]"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Iniciar sesión de nuevo
        </button>
        <a href="./index.html" className="mt-4 inline-block text-xs font-semibold text-[#006E7A] hover:underline">
          Ir a la aplicación principal
        </a>
      </div>
    </div>
  );
}
