import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import AdCarousel from './AdCarousel';

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchActiveAds: vi.fn(),
    getAdViewerKey: vi.fn(),
    recordAdImpression: vi.fn(),
    recordAdClick: vi.fn(),
  };
});

import {
  fetchActiveAds,
  getAdViewerKey,
  recordAdImpression,
  recordAdClick,
} from '../../data/appData';

const ads = [
  {
    id: 'ad-1',
    name: 'Primera campaña',
    headline: 'Autos verificados',
    description: 'Descripción uno',
    imageUrl: 'https://cdn.example.com/uno.png',
    ctaLabel: 'Cotizar',
    targetPath: '/request',
  },
  {
    id: 'ad-2',
    name: 'Segunda campaña',
    headline: 'Repuestos con garantía',
    description: 'Descripción dos',
    imageUrl: 'https://cdn.example.com/dos.png',
    ctaLabel: 'Ver más',
    targetPath: '/request',
  },
];

const renderCarousel = () =>
  render(
    <MemoryRouter initialEntries={['/categories']}>
      <Routes>
        <Route
          path="/categories"
          element={<AdCarousel fallback={<div>Portada habitual</div>} />}
        />
        <Route path="/request" element={<div>Ruta de solicitud</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  getAdViewerKey.mockReturnValue('viewer-key-1234');
  recordAdImpression.mockResolvedValue({ ok: true, data: [], error: null });
  recordAdClick.mockResolvedValue({ ok: true, data: [], error: null });
});

describe('carrusel de publicidad de /categories', () => {
  it('muestra el hero habitual cuando no hay anuncios o falla la consulta', async () => {
    fetchActiveAds.mockResolvedValue({ items: [], error: null, notice: 'Sin anuncios' });
    renderCarousel();

    expect(await screen.findByText('Portada habitual')).toBeTruthy();
    expect(recordAdImpression).not.toHaveBeenCalled();
  });

  it('registra una impresión por campaña y permite desplazarse con indicadores', async () => {
    fetchActiveAds.mockResolvedValue({ items: ads, error: null, notice: null });
    renderCarousel();

    expect(await screen.findByRole('button', { name: 'Anuncio: Autos verificados' })).toBeTruthy();
    expect(screen.getByText('Repuestos con garantía')).toBeTruthy();
    expect(screen.queryByText('Portada habitual')).toBeNull();

    await waitFor(() => expect(recordAdImpression).toHaveBeenCalledTimes(2));
    expect(recordAdImpression).toHaveBeenCalledWith('ad-1', 'viewer-key-1234');
    expect(recordAdImpression).toHaveBeenCalledWith('ad-2', 'viewer-key-1234');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ir al anuncio 2' }));
    expect(Element.prototype.scrollTo).toHaveBeenCalledWith({
      left: expect.any(Number),
      behavior: 'smooth',
    });
  });

  it('registra el clic y navega a la ruta interna de la campaña', async () => {
    fetchActiveAds.mockResolvedValue({ items: [ads[0]], error: null, notice: null });
    renderCarousel();

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Anuncio: Autos verificados' })
    );

    expect(recordAdClick).toHaveBeenCalledWith('ad-1', 'viewer-key-1234');
    expect(await screen.findByText('Ruta de solicitud')).toBeTruthy();
  });
});
