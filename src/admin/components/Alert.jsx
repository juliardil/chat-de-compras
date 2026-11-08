import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';

const TONES = {
  info: {
    container: 'border-sky-200 bg-sky-50',
    title: 'text-sky-900',
    body: 'text-sky-800',
    Icon: Info,
  },
  success: {
    container: 'border-emerald-200 bg-emerald-50',
    title: 'text-emerald-900',
    body: 'text-emerald-800',
    Icon: CheckCircle2,
  },
  warning: {
    container: 'border-amber-200 bg-amber-50',
    title: 'text-amber-900',
    body: 'text-amber-800',
    Icon: TriangleAlert,
  },
  danger: {
    container: 'border-red-200 bg-red-50',
    title: 'text-red-900',
    body: 'text-red-800',
    Icon: AlertCircle,
  },
};

export default function Alert({ tone = 'info', title, children, className = '' }) {
  const style = TONES[tone] || TONES.info;
  const Icon = style.Icon;

  return (
    <div className={`flex gap-3 rounded-2xl border p-4 ${style.container} ${className}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.title}`} aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className={`text-sm font-semibold ${style.title}`}>{title}</p> : null}
        {children ? <div className={`text-sm leading-6 ${style.body}`}>{children}</div> : null}
      </div>
    </div>
  );
}
