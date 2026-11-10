import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// La suite siempre corre en modo demostración: un .env local con credenciales
// InsForge reales no debe activar el modo InsForge en los tests. Los módulos
// (src/lib/insforge.js) leen import.meta.env al importarse, antes de cada
// prueba, así que se neutralizan aquí en el setup.
import.meta.env.VITE_INSFORGE_URL = '';
import.meta.env.VITE_INSFORGE_ANON_KEY = '';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom no implementa scrollIntoView y el chat lo usa para autoscroll.
if (!globalThis.Element.prototype.scrollIntoView) {
  globalThis.Element.prototype.scrollIntoView = vi.fn();
}
