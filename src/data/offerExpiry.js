import { useEffect, useState } from 'react';

// Regla compartida por empresas y compradores: 30 minutos por oferta/solicitud.
// Es aditiva: no cambia consultas, estados ni flujos; solo hace visible el
// tiempo y permite ocultar la tarjeta cuando se agota.
export const OFFER_EXPIRY_MS = 30 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const THREE_MINUTES_MS = 3 * 60 * 1000;

export const toExpiryTimestamp = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
};

// Prioridad: plazo explícito del ciclo de vida, luego `expires_at` y, si el
// backend no guardó fecha, los 30 minutos desde `created_at`.
export const getExpiryDeadline = (item) => {
  if (!item) return null;
  const explicit = toExpiryTimestamp(item.deadlineAt || item.expiresAt);
  if (explicit !== null) return explicit;
  const created = toExpiryTimestamp(item.createdAt);
  return created === null ? null : created + OFFER_EXPIRY_MS;
};

export const getExpiryInfo = (item, now = Date.now()) => {
  const deadline = getExpiryDeadline(item);
  if (deadline === null) {
    return { state: 'none', label: '', percent: 0, remainingMs: null, deadline: null };
  }

  const remainingMs = Math.max(0, deadline - now);
  const state = remainingMs === 0
    ? 'expired'
    : remainingMs <= THREE_MINUTES_MS
      ? 'critical'
      : remainingMs <= TEN_MINUTES_MS
        ? 'warning'
        : 'normal';

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const label = state === 'normal'
    ? `Quedan ${Math.ceil(remainingMs / 60000)} min`
    : state === 'warning'
      ? `Por acabar · ${clock}`
      : state === 'critical'
        ? `Expira en ${clock}`
        : 'Vencida';

  return {
    state,
    label,
    percent: Math.max(0, Math.min(100, (remainingMs / OFFER_EXPIRY_MS) * 100)),
    remainingMs,
    deadline,
  };
};

// Un solo reloj por pantalla: cada minuto mientras falten más de 10 minutos y
// cada segundo en la recta final. Las tarjetas reciben el mismo `now`.
export function useExpiryNow(deadlines = [], enabled = true) {
  const [now, setNow] = useState(() => Date.now());

  const validDeadlines = (Array.isArray(deadlines) ? deadlines : [])
    .map(toExpiryTimestamp)
    .filter((value) => value !== null);
  const nextDeadline = validDeadlines.length > 0 ? Math.min(...validDeadlines) : null;
  const intervalMs = nextDeadline === null
    ? 0
    : nextDeadline - now <= TEN_MINUTES_MS
      ? 1000
      : 60000;

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs, nextDeadline]);

  return now;
}
