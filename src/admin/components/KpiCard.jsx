export default function KpiCard({ label, value, hint, Icon, tone = 'default' }) {
  const tones = {
    default: 'bg-white border-slate-200 text-slate-900',
    accent: 'bg-[#F0FDFB] border-[#99F6E4] text-slate-900',
    warning: 'bg-amber-50 border-amber-200 text-slate-900',
    muted: 'bg-slate-50 border-slate-200 text-slate-900',
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone] || tones.default}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon ? (
          <span className="rounded-xl bg-white/70 p-2 text-[#4B227A] ring-1 ring-black/5" aria-hidden="true">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}
