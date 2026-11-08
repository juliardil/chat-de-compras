import { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../data/demoRepository';
import { ROLE_BY_KEY } from '../auth/permissions';
import Alert from '../components/Alert';

export default function Login() {
  const { login, mode, bootError } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login({ email, password });
    } catch (loginError) {
      setError(loginError.message || 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (account) => {
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#3A1A5E] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#00EED0]/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-[#0197AF]/25 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00EED0] text-[#3A1A5E] shadow-[0_0_24px_rgba(0,238,208,0.4)]">
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight">Chat de Compras</p>
              <p className="text-xs text-white/60">Centro de control</p>
            </div>
          </div>

          <h1 className="mt-16 max-w-xl text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Administra la plataforma con orden, permisos y trazabilidad.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/70">
            Un solo lugar para operar el marketplace, proteger a compradores y comercios y tomar
            decisiones con datos confiables.
          </p>

          <ul className="mt-10 space-y-4 text-sm text-white/80">
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#00EED0]" aria-hidden="true" />
              Permisos por módulo y acción, validados en el servidor.
            </li>
            <li className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#00EED0]" aria-hidden="true" />
              Acceso a conversaciones solo con caso, motivo y expiración.
            </li>
            <li className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#00EED0]" aria-hidden="true" />
              Auditoría append-only de toda acción sensible.
            </li>
          </ul>
        </div>

        <p className="relative text-xs leading-5 text-white/40">
          Fase 1 · Fundación administrativa. Sin datos reales conectados todavía.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3A1A5E] text-[#00EED0]">
                <MessageSquare className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">Chat de Compras</p>
                <p className="text-xs text-slate-500">Administración</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0FDFB] text-[#006E7A] ring-1 ring-[#99F6E4]">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Acceso administrativo</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Solo personal autorizado. Cada inicio de sesión queda registrado.
            </p>

            <div className="mt-5">
              {mode === 'demo' ? (
                <Alert tone="warning" title="Modo demostración local">
                  No hay un proyecto InsForge conectado. Los datos son de ejemplo y se guardan en
                  este navegador. Configura <code className="font-mono text-xs">VITE_INSFORGE_URL</code> y{' '}
                  <code className="font-mono text-xs">VITE_INSFORGE_ANON_KEY</code> para usar el backend real.
                </Alert>
              ) : (
                <Alert tone="success" title="Backend InsForge configurado">
                  El acceso se valida con InsForge y los permisos se calculan en el servidor.
                </Alert>
              )}
            </div>

            {bootError ? (
              <div className="mt-4">
                <Alert tone="danger" title="No se pudo comprobar la sesión">
                  {bootError}
                </Alert>
              </div>
            ) : null}

            <form className="mt-5 space-y-4" onSubmit={submit}>
              <div>
                <label htmlFor="admin-email" className="text-sm font-medium text-slate-700">
                  Correo electrónico
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@empresa.com"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:bg-white focus:ring-2 focus:ring-[#4B227A]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <Alert tone="danger" title="No se pudo iniciar sesión">
                  {error}
                </Alert>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3A1A5E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2E144A] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Comprobando…' : 'Entrar al panel'}
                {!busy ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
              </button>
            </form>

            {mode === 'demo' ? (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Cuentas de demostración
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Elige una cuenta para probar cada rol. Contraseña única:{' '}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                    {DEMO_PASSWORD}
                  </code>
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {DEMO_ACCOUNTS.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => fillDemo(account)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-left transition hover:border-[#4B227A]/40 hover:bg-slate-50"
                    >
                      <span className="block text-xs font-semibold text-slate-800">
                        {ROLE_BY_KEY[account.roleKey]?.name || account.roleKey}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">{account.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <span>MFA: pendiente de soporte en el SDK</span>
            <a href="./index.html" className="font-semibold text-[#006E7A] hover:underline">
              Ir a la aplicación
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
