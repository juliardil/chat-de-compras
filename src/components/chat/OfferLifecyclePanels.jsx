import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PackageCheck,
  RotateCcw,
  Star,
  Store,
  XCircle,
} from 'lucide-react';
import Button from '../ui/Button';
import { DELIVERY_FAILURE_REASONS } from '../../data/appData';

const STATE_LABELS = {
  SIN_CICLO: 'Conversación libre',
  ESPERANDO_ACEPTACION: 'Esperando respuesta del comercio',
  EN_NEGOCIACION: 'En negociación',
  LIBERADO_POR_TIEMPO: 'Liberado por tiempo',
  EN_ENTREGA: 'En entrega',
  ENTREGA_CONFIRMADA: 'Entrega confirmada',
  NO_ENTREGADO: 'Pedido no entregado',
  CALIFICADO: 'Calificado',
  CANCELADO: 'Cancelado',
};

const formatDeadline = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const isPast = (value) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < Date.now();
};

const panelClass =
  'rounded-2xl border border-white/40 bg-white/80 p-4 shadow-sm backdrop-blur-md';

export function LifecycleBanner({ lifecycle, role }) {
  if (!lifecycle || lifecycle.state === 'SIN_CICLO') return null;

  const label =
    role === 'user' && lifecycle.state === 'ESPERANDO_ACEPTACION'
      ? 'Te están atendiendo'
      : STATE_LABELS[lifecycle.state] || lifecycle.state;

  const deadline =
    lifecycle.state === 'ESPERANDO_ACEPTACION'
      ? lifecycle.responseDeadlineAt
      : lifecycle.state === 'EN_ENTREGA'
        ? lifecycle.deliveryDeadlineAt
        : null;

  return (
    <div className="mb-4 rounded-2xl border border-[#0197AF]/30 bg-gradient-to-r from-[#0197AF]/10 to-[#4B227A]/10 px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-bold text-[#006E7A]">
        <Clock className="h-4 w-4" />
        {label}
      </p>
      {deadline ? (
        <p className="mt-1 text-xs font-medium text-gray-700">
          {isPast(deadline) ? 'El plazo ya venció' : 'Plazo límite'}: {formatDeadline(deadline)}
        </p>
      ) : null}
      {lifecycle.agreedDeliveryLabel ? (
        <p className="mt-1 text-xs text-gray-600">
          Acuerdo de entrega: <strong>{lifecycle.agreedDeliveryLabel}</strong>
        </p>
      ) : null}
    </div>
  );
}

export function DeliveryAgreementPanel({ lifecycle, busy, onAgree, onCancel }) {
  const [unit, setUnit] = useState('dias');
  const [amount, setAmount] = useState('2');

  if (lifecycle?.state !== 'EN_NEGOCIACION') return null;

  const numeric = Number(amount);
  const hoursByUnit = { horas: numeric, dias: numeric * 24, personalizado: numeric };
  const hours = Number.isFinite(hoursByUnit[unit]) ? hoursByUnit[unit] : 0;
  const label =
    unit === 'horas'
      ? `${numeric} ${numeric === 1 ? 'hora' : 'horas'}`
      : unit === 'dias'
        ? `${numeric} ${numeric === 1 ? 'día' : 'días'}`
        : `Plazo personalizado: ${numeric} horas`;

  const canAgree = Number.isFinite(hours) && hours > 0 && hours <= 720;

  return (
    <section className={panelClass} aria-label="Acuerdo de entrega">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-gray-800">
        <PackageCheck className="h-4 w-4 text-[#006E7A]" />
        Acuerdo de tiempo máximo de entrega
      </h2>
      <p className="mb-3 text-xs text-gray-600">
        Definan juntos cuándo debe llegar el pedido. Después se activarán los datos de envío.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-gray-700">
          Unidad
          <select
            value={unit}
            onChange={(event) => {
              const next = event.target.value;
              setUnit(next);
              if (next === 'horas') setAmount('12');
              if (next === 'dias') setAmount('2');
              if (next === 'personalizado') setAmount('48');
            }}
            className="mt-1 w-full rounded-xl border border-[#4B227A]/25 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#0197AF] focus:outline-none"
          >
            <option value="horas">Horas</option>
            <option value="dias">Días</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-700">
          Cantidad
          <input
            type="number"
            min="1"
            max="720"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 w-full rounded-xl border border-[#4B227A]/25 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#0197AF] focus:outline-none"
          />
        </label>
      </div>

      <p className="mt-2 text-[11px] text-gray-600">Plazo acordado: {label}</p>

      <div className="mt-3 flex flex-col gap-2">
        <Button
          fullWidth
          disabled={busy || !canAgree}
          onClick={() => onAgree({ hours, label })}
          className="bg-[#00EED0] text-black hover:bg-[#00EED0]/90"
        >
          <CheckCircle2 className="h-4 w-4" />
          {busy ? 'Guardando…' : 'Llegamos a un acuerdo'}
        </Button>
        <Button
          fullWidth
          disabled={busy}
          onClick={onCancel}
          className="border border-[#4B227A]/30 bg-white text-[#4B227A] hover:bg-[#4B227A]/5"
        >
          <XCircle className="h-4 w-4" />
          Cancelar negociación
        </Button>
      </div>
    </section>
  );
}

export function DelayPanel({ lifecycle, role, busy, onReportDelay, onKeepWaiting, onCancelBreach }) {
  const [reason, setReason] = useState(DELIVERY_FAILURE_REASONS[0]);
  const [hours, setHours] = useState('24');

  if (lifecycle?.state !== 'EN_ENTREGA' || !isPast(lifecycle.deliveryDeadlineAt)) return null;

  if (lifecycle.delayAttempts >= 2) {
    if (role !== 'user') return null;
    return (
      <section className={panelClass} aria-label="Incumplimiento de plazo">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#4B227A]">
          <AlertTriangle className="h-4 w-4" />
          El pedido volvió a vencer el plazo
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          Puedes darle más tiempo al comercio o cancelar por incumplimiento.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Button
            fullWidth
            disabled={busy}
            onClick={onKeepWaiting}
            className="bg-[#0197AF] text-white hover:bg-[#006E7A]"
          >
            <Clock className="h-4 w-4" />
            Seguir esperando
          </Button>
          <Button
            fullWidth
            disabled={busy}
            onClick={onCancelBreach}
            className="border border-red-200 bg-white text-red-700 hover:bg-red-50"
          >
            <XCircle className="h-4 w-4" />
            Cancelar por incumplimiento
          </Button>
        </div>
      </section>
    );
  }

  if (role !== 'commerce') {
    return (
      <section className={panelClass} aria-label="Retraso en la entrega">
        <p className="flex items-center gap-2 text-sm font-bold text-[#4B227A]">
          <AlertTriangle className="h-4 w-4" />
          El plazo de entrega venció
        </p>
        <p className="mt-1 text-xs text-gray-600">
          El comercio debe indicar por qué no llegó y proponer un nuevo tiempo.
        </p>
      </section>
    );
  }

  return (
    <section className={panelClass} aria-label="Retraso en la entrega">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[#4B227A]">
        <AlertTriangle className="h-4 w-4" />
        ¿Por qué no llegó el pedido?
      </h2>
      <div className="mt-3 space-y-2">
        <select
          aria-label="Motivo del retraso"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="w-full rounded-xl border border-[#4B227A]/25 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#0197AF] focus:outline-none"
        >
          {DELIVERY_FAILURE_REASONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <label className="block text-xs font-semibold text-gray-700">
          Nuevo plazo (horas)
          <input
            type="number"
            min="1"
            max="720"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className="mt-1 w-full rounded-xl border border-[#4B227A]/25 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#0197AF] focus:outline-none"
          />
        </label>
        <Button
          fullWidth
          disabled={busy || !Number(hours) || Number(hours) <= 0}
          onClick={() => onReportDelay({ reason, hours: Number(hours) })}
          className="bg-[#00EED0] text-black hover:bg-[#00EED0]/90"
        >
          Guardar motivo y nuevo plazo
        </Button>
      </div>
    </section>
  );
}

export function DeliveryReviewPanel({
  lifecycle,
  role,
  busy,
  onConfirmDelivery,
  onReportNoDelivery,
  onRate,
  onRelease,
}) {
  const [failureReason, setFailureReason] = useState(DELIVERY_FAILURE_REASONS[0]);
  const [rating, setRating] = useState(0);
  const [arrivedOnTime, setArrivedOnTime] = useState(true);
  const [comment, setComment] = useState('');

  if (!lifecycle || role !== 'user') return null;

  if (lifecycle.state === 'EN_ENTREGA') {
    return (
      <section className={panelClass} aria-label="Resultado de la entrega">
        <h2 className="text-sm font-bold text-gray-800">¿Cómo terminó tu pedido?</h2>
        <div className="mt-3 flex flex-col gap-2">
          <Button
            fullWidth
            disabled={busy}
            onClick={onConfirmDelivery}
            className="bg-[#00EED0] text-black hover:bg-[#00EED0]/90"
          >
            <CheckCircle2 className="h-4 w-4" />
            Llegó mi pedido
          </Button>
          <select
            aria-label="Motivo por el que no llegó el pedido"
            value={failureReason}
            onChange={(event) => setFailureReason(event.target.value)}
            className="w-full rounded-xl border border-[#4B227A]/25 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#0197AF] focus:outline-none"
          >
            {DELIVERY_FAILURE_REASONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Button
            fullWidth
            disabled={busy}
            onClick={() => onReportNoDelivery({ reason: failureReason })}
            className="border border-[#4B227A]/30 bg-white text-[#4B227A] hover:bg-[#4B227A]/5"
          >
            <XCircle className="h-4 w-4" />
            No llegó mi pedido
          </Button>
        </div>
      </section>
    );
  }

  if (['ENTREGA_CONFIRMADA', 'NO_ENTREGADO'].includes(lifecycle.state)) {
    return (
      <section className={panelClass} aria-label="Calificación de la compra">
        <h2 className="text-sm font-bold text-gray-800">Califica esta compra</h2>
        <div className="mt-2 flex gap-1" role="group" aria-label="Estrellas">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
              aria-pressed={rating === star}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`h-7 w-7 ${star <= rating ? 'fill-current text-[#006E7A]' : 'text-gray-400'}`}
              />
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2" role="group" aria-label="¿Llegó a tiempo?">
          {[
            { value: true, label: 'Sí' },
            { value: false, label: 'No' },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={arrivedOnTime === option.value}
              onClick={() => setArrivedOnTime(option.value)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                arrivedOnTime === option.value
                  ? 'border-[#00EED0]/60 bg-[#00EED0]/25 text-[#006E7A]'
                  : 'border-white/50 bg-white text-gray-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <textarea
          aria-label="Comentario de la calificación"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          placeholder="Cuéntanos cómo fue la experiencia (opcional)"
          className="mt-3 w-full rounded-xl border border-[#4B227A]/25 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#0197AF] focus:outline-none"
        />
        <Button
          fullWidth
          disabled={busy || rating === 0}
          onClick={() => onRate({ rating, arrivedOnTime, comment })}
          className="mt-3 bg-[#00EED0] text-black hover:bg-[#00EED0]/90"
        >
          <Star className="h-4 w-4" />
          Enviar calificación
        </Button>
      </section>
    );
  }

  if (['CALIFICADO', 'CANCELADO', 'LIBERADO_POR_TIEMPO'].includes(lifecycle.state)) {
    return (
      <section className={panelClass} aria-label="Elegir otro vendedor">
        <p className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <Store className="h-4 w-4 text-[#006E7A]" />
          ¿Quieres otra opción?
        </p>
        <p className="mt-1 text-xs text-gray-600">
          Tus datos de envío se conservan para que no tengas que capturarlos otra vez.
        </p>
        <Button
          fullWidth
          disabled={busy}
          onClick={onRelease}
          className="mt-3 bg-gradient-to-r from-[#0197AF] to-[#4B227A] text-white hover:opacity-90"
        >
          <RotateCcw className="h-4 w-4" />
          Quiero otro vendedor
        </Button>
      </section>
    );
  }

  return null;
}
