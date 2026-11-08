import { useEffect, useState } from 'react';
import Modal from './Modal';

export default function ReasonDialog({
  open,
  title,
  description,
  reasons = [],
  confirmLabel = 'Confirmar',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setDetail('');
    }
  }, [open]);

  const toneClasses =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600'
      : 'bg-[#4B227A] hover:bg-[#3A1A5E] focus-visible:outline-[#4B227A]';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !reason}
            onClick={() => onConfirm({ reason, detail })}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses}`}
          >
            {busy ? 'Guardando…' : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="reason-code" className="text-sm font-medium text-slate-700">
            Motivo
          </label>
          <select
            id="reason-code"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          >
            <option value="">Selecciona un motivo…</option>
            {reasons.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="reason-detail" className="text-sm font-medium text-slate-700">
            Detalle (opcional)
          </label>
          <textarea
            id="reason-detail"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Contexto adicional para la auditoría"
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4B227A] focus:ring-2 focus:ring-[#4B227A]/15"
          />
        </div>
        <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-500">
          Esta acción queda registrada en la auditoría con tu usuario, la fecha y el motivo indicado.
        </p>
      </div>
    </Modal>
  );
}
