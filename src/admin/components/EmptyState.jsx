export default function EmptyState({ Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      {Icon ? (
        <span className="rounded-2xl bg-slate-50 p-3 text-slate-400" aria-hidden="true">
          <Icon className="h-6 w-6" />
        </span>
      ) : null}
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
