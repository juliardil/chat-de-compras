import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Publicidad from './Publicidad';

const {
  listAdCampaigns,
  saveAdCampaign,
  setAdCampaignStatus,
  getAdsOverview,
  getAdPerformanceReport,
  uploadAdBanner,
  notify,
  session,
  hasPermission,
} = vi.hoisted(() => ({
  listAdCampaigns: vi.fn(),
  saveAdCampaign: vi.fn(),
  setAdCampaignStatus: vi.fn(),
  getAdsOverview: vi.fn(),
  getAdPerformanceReport: vi.fn(),
  uploadAdBanner: vi.fn(),
  notify: vi.fn(),
  session: { memberId: 'admin-1', name: 'Ana Torres', roleKey: 'superadmin' },
  hasPermission: vi.fn(() => true),
}));

vi.mock('../auth/useAdminAuth', () => ({
  useAdminAuth: vi.fn(() => ({ session, hasPermission, mode: 'insforge' })),
}));

vi.mock('../data', () => ({
  adminRepository: {
    listAdCampaigns,
    saveAdCampaign,
    setAdCampaignStatus,
    getAdsOverview,
    getAdPerformanceReport,
  },
}));

vi.mock('../components/useToast', () => ({ useToast: () => ({ notify }) }));

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, uploadAdBanner };
});

const campaigns = [
  {
    id: 'ad-1',
    name: 'Temporada automotriz',
    headline: 'Autos, motos, repuestos y accesorios',
    description: 'Descripción de prueba',
    imageUrl: 'https://cdn.example.com/banner.png',
    ctaLabel: 'Ver más',
    targetPath: '/request',
    startsAt: null,
    endsAt: null,
    impressionLimit: 100,
    impressionsCount: 40,
    clicksCount: 5,
    remainingImpressions: 60,
    sortOrder: 0,
    isActive: true,
    lifecycleStatus: 'active',
  },
];

const overview = {
  totalCampaigns: 1,
  activeCampaigns: 1,
  pausedCampaigns: 0,
  scheduledCampaigns: 0,
  expiredCampaigns: 0,
  exhaustedCampaigns: 0,
  totalImpressions: 40,
  totalClicks: 5,
  activeImpressionsRemaining: 60,
};

const performance = [
  {
    campaignId: 'ad-1',
    name: 'Temporada automotriz',
    lifecycleStatus: 'active',
    impressionsCount: 40,
    clicksCount: 5,
    remainingImpressions: 60,
    ctr: 12.5,
    startsAt: null,
    endsAt: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  listAdCampaigns.mockResolvedValue(campaigns);
  getAdsOverview.mockResolvedValue(overview);
  getAdPerformanceReport.mockResolvedValue(performance);
  saveAdCampaign.mockResolvedValue({ ...campaigns[0] });
  setAdCampaignStatus.mockResolvedValue({ ...campaigns[0], isActive: false });
  uploadAdBanner.mockResolvedValue({ url: 'https://cdn.example.com/nuevo.png', error: null });
});

afterEach(() => {
  hasPermission.mockImplementation(() => true);
});

describe('panel admin de Publicidad', () => {
  it('muestra campañas, vigencia e impresiones con clics', async () => {
    render(<Publicidad />);

    expect(await screen.findByText('Temporada automotriz')).toBeTruthy();
    expect(screen.getByText('Autos, motos, repuestos y accesorios')).toBeTruthy();
    expect(screen.getByText('60 disponibles')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nueva campaña' })).toBeTruthy();
    expect(screen.getAllByText('12.50%').length).toBeGreaterThan(0);
  });

  it('guarda una campaña editada con fechas y límite normalizados', async () => {
    render(<Publicidad />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    const headlineInput = screen.getByDisplayValue('Autos, motos, repuestos y accesorios');
    await user.clear(headlineInput);
    await user.type(headlineInput, 'Autos verificados');
    await user.click(screen.getByRole('button', { name: 'Guardar campaña' }));

    await waitFor(() => expect(saveAdCampaign).toHaveBeenCalledTimes(1));
    expect(saveAdCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ad-1',
        headline: 'Autos verificados',
        impressionLimit: 100,
        startsAt: null,
        endsAt: null,
        actor: session,
      })
    );
  });

  it('pausa una campaña registrando el motivo de auditoría', async () => {
    render(<Publicidad />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Pausar/ }));
    expect(await screen.findByText('Pausar campaña')).toBeTruthy();

    const dialog = screen.getByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Motivo'), 'schedule');
    await user.click(within(dialog).getByRole('button', { name: 'Pausar' }));

    await waitFor(() => expect(setAdCampaignStatus).toHaveBeenCalledTimes(1));
    expect(setAdCampaignStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ad-1',
        isActive: false,
        reason: 'Cambio de programación',
        actor: session,
      })
    );
  });

  it('guarda la vigencia y el límite de impresiones que escribe el administrador', async () => {
    render(<Publicidad />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Editar' }));

    fireEvent.change(screen.getByLabelText('Inicia'), {
      target: { value: '2026-12-01T10:00' },
    });
    fireEvent.change(screen.getByLabelText('Termina'), {
      target: { value: '2026-12-31T10:00' },
    });
    fireEvent.change(screen.getByLabelText('Límite de impresiones'), {
      target: { value: '250' },
    });
    await user.click(screen.getByRole('button', { name: 'Guardar campaña' }));

    await waitFor(() => expect(saveAdCampaign).toHaveBeenCalledTimes(1));
    expect(saveAdCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ad-1',
        startsAt: expect.stringMatching(/^2026-12-01T\d{2}:00:00\.000Z$/),
        endsAt: expect.stringMatching(/^2026-12-31T\d{2}:00:00\.000Z$/),
        impressionLimit: 250,
        actor: session,
      })
    );
  });

  it('oculta las acciones de gestión si el rol solo tiene ads.view', async () => {
    hasPermission.mockImplementation((key) => key === 'ads.view');
    render(<Publicidad />);

    expect(await screen.findByText('Temporada automotriz')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nueva campaña' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Pausar/ })).toBeNull();
    expect(saveAdCampaign).not.toHaveBeenCalled();
    expect(setAdCampaignStatus).not.toHaveBeenCalled();
  });
});
