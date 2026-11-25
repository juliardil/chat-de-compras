import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CountdownBar, OfferExpiryBadge } from './OfferExpiryBadge';
import {
  OFFER_EXPIRY_MS,
  getExpiryDeadline,
  getExpiryInfo,
} from '../../data/offerExpiry';

const START = Date.UTC(2026, 10, 24, 12, 0, 0);
const created = { createdAt: START };

afterEach(() => {
  vi.useRealTimers();
});

describe('contador de vencimiento de ofertas', () => {
  it('calcula 30 minutos desde created_at y respeta expires_at', () => {
    expect(getExpiryDeadline(created)).toBe(START + OFFER_EXPIRY_MS);
    expect(getExpiryDeadline({ ...created, expiresAt: START + 5 * 60000 })).toBe(START + 5 * 60000);
    expect(getExpiryDeadline({ ...created, deadlineAt: START + 8 * 60000 })).toBe(START + 8 * 60000);
    expect(getExpiryDeadline({})).toBeNull();
  });

  it('muestra la píldora verde agua mientras falten más de 10 minutos', () => {
    const info = getExpiryInfo(created, START + 5 * 60000);
    expect(info.state).toBe('normal');
    expect(info.label).toBe('Quedan 25 min');

    render(<OfferExpiryBadge item={created} now={START + 5 * 60000} />);
    const badge = screen.getByRole('timer');
    expect(badge).toHaveTextContent('Quedan 25 min');
    expect(badge.className).toContain('bg-[#00EED0]/20');
    expect(badge.className).toContain('text-[#006E7A]');
  });

  it('cambia a ámbar con MM:SS al entrar en los últimos 10 minutos', () => {
    render(<OfferExpiryBadge item={created} now={START + 20 * 60000 + 30000} />);
    const badge = screen.getByRole('timer');
    expect(badge).toHaveTextContent('Por acabar · 09:30');
    expect(badge.className).toContain('bg-amber-100');
    expect(badge.className).toContain('animate-pulse');
  });

  it('cambia a coral con contador en vivo en los últimos 3 minutos', () => {
    render(<OfferExpiryBadge item={created} now={START + 27 * 60000 + 15000} />);
    const badge = screen.getByRole('timer');
    expect(badge).toHaveTextContent('Expira en 02:45');
    expect(badge.className).toContain('bg-rose-100');
    expect(badge.className).toContain('text-rose-700');
  });

  it('dibuja una barra delgada proporcional a los 30 minutos', () => {
    render(<CountdownBar item={created} now={START + 15 * 60000} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar.className).toContain('h-1');
    expect(bar.firstChild).toHaveStyle({ width: '50%' });
  });

  it('no muestra nada cuando no hay fecha de vencimiento', () => {
    const { container } = render(
      <>
        <OfferExpiryBadge item={{}} now={START} />
        <CountdownBar item={{}} now={START} />
      </>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('actualiza cada segundo en la recta final y cada minuto antes', () => {
    vi.useFakeTimers();

    vi.setSystemTime(START + 27 * 60000);
    const critical = render(<OfferExpiryBadge item={created} />);
    expect(screen.getByRole('timer')).toHaveTextContent('Expira en 03:00');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('timer')).toHaveTextContent('Expira en 02:59');
    critical.unmount();

    vi.setSystemTime(START + 5 * 60000);
    render(<OfferExpiryBadge item={created} />);
    expect(screen.getByRole('timer')).toHaveTextContent('Quedan 25 min');
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByRole('timer')).toHaveTextContent('Quedan 24 min');
  });
});
