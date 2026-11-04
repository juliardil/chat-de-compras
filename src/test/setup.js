import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom no implementa scrollIntoView y el chat lo usa para autoscroll.
if (!globalThis.Element.prototype.scrollIntoView) {
  globalThis.Element.prototype.scrollIntoView = vi.fn();
}
