import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Categories from './Categories';

vi.mock('../../components/layout/ViewSwitcher', () => ({
  default: () => <div>Switcher de vistas</div>,
}));

vi.mock('../../components/layout/UserBottomNav', () => ({
  default: () => <div>Navegación inferior</div>,
}));

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

import { fetchActiveAds } from '../../data/appData';

const renderCategories = () =>
  render(
    <MemoryRouter initialEntries={['/categories']}>
      <Routes>
        <Route path="/categories" element={<Categories />} />
        <Route path="/request" element={<div>Nueva solicitud</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchActiveAds.mockResolvedValue({ items: [], error: null, notice: 'Sin anuncios' });
  });

  it('conserva el hero automotriz y el botón de solicitud cuando no hay anuncios', async () => {
    renderCategories();

    expect(await screen.findByText('Automotriz')).toBeTruthy();
    expect(screen.getByText('Autos, motos, repuestos y accesorios')).toBeTruthy();
    expect(screen.getByRole('button', { name: /QUÉ NECESITAS/ })).toBeTruthy();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /QUÉ NECESITAS/ }));
    expect(await screen.findByText('Nueva solicitud')).toBeTruthy();
  });
});
