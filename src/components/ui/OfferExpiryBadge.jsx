import React from 'react';
import { getExpiryDeadline, getExpiryInfo, useExpiryNow } from '../../data/offerExpiry';

const PILL_STYLES = {
  normal: 'bg-[#00EED0]/20 text-[#006E7A] border-[#00EED0]/40',
  warning: 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse',
  critical: 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse',
  expired: 'bg-gray-100 text-gray-600 border-gray-300',
};

const PILL_ICONS = {
  normal: '⏱',
  warning: '⚠️',
  critical: '🔥',
  expired: '⏱',
};

const BAR_STYLES = {
  normal: 'bg-[#00EED0]',
  warning: 'bg-amber-400',
  critical: 'bg-rose-400',
  expired: 'bg-gray-300',
};

function useBadgeNow(item, now) {
  const deadline = getExpiryDeadline(item);
  const internalNow = useExpiryNow(deadline === null ? [] : [deadline], now === undefined);
  return now === undefined ? internalNow : now;
}

export function OfferExpiryBadge({ item, now, className = '' }) {
  const current = useBadgeNow(item, now);
  const info = getExpiryInfo(item, current);
  if (info.state === 'none') return null;

  return (
    <span
      role="timer"
      aria-label={info.label}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${PILL_STYLES[info.state]} ${className}`}
    >
      <span aria-hidden="true">{PILL_ICONS[info.state]}</span>
      {info.label}
    </span>
  );
}

export function CountdownBar({ item, now, className = '' }) {
  const current = useBadgeNow(item, now);
  const info = getExpiryInfo(item, current);
  if (info.state === 'none') return null;

  return (
    <div
      role="progressbar"
      aria-label="Tiempo restante"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(info.percent)}
      className={`h-1 w-full overflow-hidden rounded-full bg-[#0197AF]/10 ${className}`}
    >
      <div
        className={`h-1 rounded-full transition-[width] duration-500 ${BAR_STYLES[info.state]}`}
        style={{ width: `${info.percent}%` }}
      />
    </div>
  );
}
