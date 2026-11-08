import { describe, expect, it } from 'vitest';
import {
  createSessionWindow,
  isWindowExpired,
  SESSION_IDLE_MS,
  SESSION_MAX_MS,
  touchSessionWindow,
} from './sessionPolicy';

const START = new Date('2026-01-01T08:00:00.000Z').getTime();

describe('política de sesión', () => {
  it('crea una ventana de 20 minutos', () => {
    const window = createSessionWindow(START);
    expect(window.issuedAt).toBe(START);
    expect(window.lastActivityAt).toBe(START);
    expect(window.expiresAt).toBe(START + SESSION_IDLE_MS);
  });

  it('extiende la expiración con actividad', () => {
    const initial = createSessionWindow(START);
    const touched = touchSessionWindow(initial, START + 10 * 60 * 1000);

    expect(touched.expiresAt).toBe(START + 10 * 60 * 1000 + SESSION_IDLE_MS);
    expect(touched.lastActivityAt).toBe(START + 10 * 60 * 1000);
  });

  it('nunca supera el límite absoluto de 8 horas', () => {
    const initial = createSessionWindow(START);
    const touched = touchSessionWindow(initial, START + SESSION_MAX_MS - 60 * 1000);

    expect(touched.expiresAt).toBe(START + SESSION_MAX_MS);
  });

  it('considera expirada la ventana en el instante exacto de expiración', () => {
    const window = createSessionWindow(START);
    expect(isWindowExpired(window, window.expiresAt - 1)).toBe(false);
    expect(isWindowExpired(window, window.expiresAt)).toBe(true);
  });

  it('trata una ventana ausente o corrupta como expirada', () => {
    expect(isWindowExpired(null)).toBe(true);
    expect(isWindowExpired({})).toBe(true);
  });

  it('reconstruye la ventana si se toca sin datos previos', () => {
    const window = touchSessionWindow(null, START);
    expect(window).toEqual(createSessionWindow(START));
  });
});
