// Política de sesión del administrador.
// Es una protección de experiencia de uso; la expiración real del token la
// controla InsForge. El servidor sigue siendo la autoridad de permisos.

export const SESSION_IDLE_MS = 20 * 60 * 1000; // 20 minutos sin actividad
export const SESSION_MAX_MS = 8 * 60 * 60 * 1000; // 8 horas desde el inicio
export const SESSION_WARNING_MS = 60 * 1000; // aviso 1 minuto antes

export function createSessionWindow(now = Date.now()) {
  return {
    issuedAt: now,
    lastActivityAt: now,
    expiresAt: now + SESSION_IDLE_MS,
  };
}

export function touchSessionWindow(window, now = Date.now()) {
  if (!window || !window.issuedAt) return createSessionWindow(now);

  const hardLimit = window.issuedAt + SESSION_MAX_MS;
  return {
    ...window,
    lastActivityAt: now,
    expiresAt: Math.min(now + SESSION_IDLE_MS, hardLimit),
  };
}

export function isWindowExpired(window, now = Date.now()) {
  if (!window || !window.expiresAt) return true;
  return now >= window.expiresAt;
}
