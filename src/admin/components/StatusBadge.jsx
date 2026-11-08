const STATUS_MAP = {
  active: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  suspended: { label: 'Suspendido', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  blocked: { label: 'Bloqueado', className: 'bg-red-50 text-red-700 ring-red-200' },
  limited: { label: 'Limitado', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  pending: { label: 'Pendiente', className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  invited: { label: 'Invitado', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  in_review: { label: 'En revisión', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  verified: { label: 'Verificado', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  rejected: { label: 'Rechazado', className: 'bg-red-50 text-red-700 ring-red-200' },
  inactive: { label: 'Inactiva', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  deleted: { label: 'Eliminado', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  expired: { label: 'Vencido', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  open: { label: 'Abierta', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  hidden: { label: 'Oculta', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  closed: { label: 'Cerrada', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  flagged: { label: 'Irregular', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  accepted: { label: 'Aceptada', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  withdrawn: { label: 'Retirada', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  withdrawn_admin: {
    label: 'Retirada por admin',
    className: 'bg-red-50 text-red-700 ring-red-200',
  },
  confirmed: { label: 'Confirmado', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  preparing: { label: 'En preparación', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  shipped: { label: 'Enviado', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  in_transit: { label: 'En tránsito', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  delivered: { label: 'Entregado', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  completed: { label: 'Completado', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  disputed: { label: 'En disputa', className: 'bg-red-50 text-red-700 ring-red-200' },
  failed: { label: 'Entrega fallida', className: 'bg-red-50 text-red-700 ring-red-200' },
  returned: { label: 'Devuelto', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
};

export default function StatusBadge({ status, children }) {
  const style = STATUS_MAP[status] || {
    label: status || 'Sin estado',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children || style.label}
    </span>
  );
}
