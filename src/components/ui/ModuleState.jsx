import React from 'react';
import { AlertTriangle, Inbox, Info, Loader2 } from 'lucide-react';

const TONES = {
  info: {
    wrapper: 'border-[#0197AF]/30 bg-[#0197AF]/10 text-[#006E7A]',
    Icon: Info,
  },
  warning: {
    wrapper: 'border-amber-300 bg-amber-50 text-amber-900',
    Icon: AlertTriangle,
  },
  error: {
    wrapper: 'border-red-300 bg-red-50 text-red-800',
    Icon: AlertTriangle,
  },
};

// Aviso explícito sobre el origen de los datos (módulo no conectado, demo,
// error de permisos/red…). Nunca se usa para disfrazar datos de ejemplo.
export function DataNotice({ tone = 'info', children, className = '' }) {
  const { wrapper, Icon } = TONES[tone] || TONES.info;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'note'}
      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${wrapper} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

// Estado vacío real: se muestra cuando la consulta no devuelve registros o
// cuando el backend todavía no expone el módulo.
export function EmptyModule({
  icon: Icon = Inbox,
  title = 'Sin registros',
  description,
  notice,
  tone = 'info',
  children,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#4B227A]/25 bg-white/70 px-5 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#4B227A]/10" aria-hidden="true">
        <Icon className="h-7 w-7 text-[#4B227A]" />
      </span>
      <h3 className="mt-4 text-base font-bold text-gray-800">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-gray-600">{description}</p> : null}
      {notice ? (
        <div className="mt-4 w-full max-w-sm text-left">
          <DataNotice tone={tone}>{notice}</DataNotice>
        </div>
      ) : null}
      {children ? <div className="mt-4 w-full max-w-sm">{children}</div> : null}
    </div>
  );
}

export function LoadingModule({ label = 'Cargando información…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-600" aria-busy="true">
      <Loader2 className="h-5 w-5 animate-spin text-[#4B227A]" aria-hidden="true" />
      {label}
    </div>
  );
}
