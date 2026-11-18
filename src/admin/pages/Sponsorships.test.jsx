import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sponsorships from './Sponsorships';

const {
  listSponsorshipRates,
  saveSponsorshipRate,
  listClubSponsors,
  saveClubSponsor,
  setClubSponsorStatus,
  getSponsorshipOverview,
  getSponsorImpactReport,
  listGroups,
  listCommerces,
  listWorkshops,
  notify,
  session,
  hasPermission,
  uploadLogo,
} = vi.hoisted(() => ({
  listSponsorshipRates: vi.fn(),
  saveSponsorshipRate: vi.fn(),
  listClubSponsors: vi.fn(),
  saveClubSponsor: vi.fn(),
  setClubSponsorStatus: vi.fn(),
  getSponsorshipOverview: vi.fn(),
  getSponsorImpactReport: vi.fn(),
  listGroups: vi.fn(),
  listCommerces: vi.fn(),
  listWorkshops: vi.fn(),
  notify: vi.fn(),
  // Referencias estables: useAdminAuth se llama en cada render y un `session`
  // nuevo reiniciaría el callback de carga en cada render.
  session: { memberId: 'admin-1', name: 'Ana Torres', roleKey: 'superadmin' },
  hasPermission: vi.fn(() => true),
  uploadLogo: vi.fn(),
}));

vi.mock('../../data/businessLogos', () => ({ uploadLogo }));

vi.mock('../auth/useAdminAuth', () => ({
  useAdminAuth: vi.fn(() => ({
    session,
    hasPermission,
    mode: 'insforge',
  })),
}));

vi.mock('../data', () => ({
  adminRepository: {
    listSponsorshipRates,
    saveSponsorshipRate,
    listClubSponsors,
    saveClubSponsor,
    setClubSponsorStatus,
    getSponsorshipOverview,
    getSponsorImpactReport,
    listGroups,
    listCommerces,
    listWorkshops,
  },
}));

vi.mock('../components/useToast', () => ({
  useToast: () => ({ notify }),
}));

const rates = [
  {
    id: 'rate-1',
    code: 'club_basic',
    name: 'Patrocinio Básico',
    amount: 899,
    currency: 'MXN',
    billingCycle: 'monthly',
    description: 'Logo en el club',
    isActive: true,
  },
];

const sponsors = [
  {
    id: 'sponsor-1',
    brandName: 'Refacciones Express',
    groupName: 'Club de repuestos del sur',
    benefit: '10% en refacciones',
    discountPercent: 10,
    contactEmail: 'ventas@express.demo',
    amount: 1899,
    currency: 'MXN',
    billingCycle: 'monthly',
    startsOn: '2026-01-01',
    endsOn: '2026-12-31',
    moderationStatus: 'approved',
    lifecycleStatus: 'active',
  },
  {
    id: 'sponsor-2',
    brandName: 'Lubricantes del Norte',
    groupName: 'Todos los clubes',
    benefit: '8% en aceites',
    discountPercent: 8,
    contactEmail: 'ventas@lubricantes.demo',
    amount: 899,
    currency: 'MXN',
    billingCycle: 'monthly',
    startsOn: '2026-01-01',
    endsOn: '2026-11-20',
    moderationStatus: 'pending',
    lifecycleStatus: 'pending',
  },
];

const overview = {
  monthlyRevenue: 2798,
  oneTimeRevenue: 3499,
  totalRevenue: 6297,
  ordersAttributed: 12,
  buyersReached: 5,
  activeBrands: 1,
  expiringBrands: 0,
  expiredBrands: 0,
  groupsReached: 1,
  purchaseAmount: 4355,
};

const impact = [
  {
    sponsorId: 'sponsor-1',
    brandName: 'Refacciones Express',
    groupName: 'Club de repuestos del sur',
    lifecycleStatus: 'active',
    clubBuyers: 3,
    partsOrders: 7,
    serviceOrders: 0,
    totalOrders: 7,
    purchaseAmount: 1245,
    amount: 1899,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  listSponsorshipRates.mockResolvedValue(rates);
  saveSponsorshipRate.mockResolvedValue({ ...rates[0] });
  listClubSponsors.mockResolvedValue(sponsors);
  saveClubSponsor.mockResolvedValue({ ...sponsors[1] });
  setClubSponsorStatus.mockResolvedValue({ ...sponsors[1], moderationStatus: 'approved' });
  getSponsorshipOverview.mockResolvedValue(overview);
  getSponsorImpactReport.mockResolvedValue(impact);
  listGroups.mockResolvedValue([{ id: 'group-1', name: 'Club de repuestos del sur' }]);
  listCommerces.mockResolvedValue([{ id: 'commerce-1', businessName: 'Refacciones Express' }]);
  listWorkshops.mockResolvedValue([{ id: 'workshop-1', workshopName: 'Taller Reforma' }]);
  uploadLogo.mockResolvedValue({ url: 'https://cdn/nueva-marca.png', error: null });
});

describe('panel admin de Patrocinios', () => {
  it('muestra las marcas con su vigencia y permite aprobar una pendiente', async () => {
    const user = userEvent.setup();
    render(<Sponsorships />);

    expect(await screen.findByText('Refacciones Express')).toBeInTheDocument();
    expect(screen.getByText('Lubricantes del Norte')).toBeInTheDocument();
    expect(screen.getByText('10% para miembros')).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    const pendingRow = rows.find((row) => row.textContent.includes('Lubricantes del Norte'));
    await user.click(pendingRow.querySelector('button'));

    expect(screen.getByRole('heading', { name: /aprobar marca/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sí, aprobar/i }));

    await waitFor(() => {
      expect(setClubSponsorStatus).toHaveBeenCalledWith({
        id: 'sponsor-2',
        status: 'approved',
        reason: '',
        actor: expect.objectContaining({ memberId: 'admin-1' }),
      });
    });
    expect(notify).toHaveBeenCalled();
  });

  it('guarda una tarifa nueva desde el modal, incluido el botón fuera del form', async () => {
    const user = userEvent.setup();
    render(<Sponsorships />);

    await user.click(await screen.findByRole('tab', { name: /tarifas/i }));
    await user.click(screen.getByRole('button', { name: /nueva tarifa/i }));

    expect(screen.getByRole('heading', { name: /nueva tarifa de patrocinio/i })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('club_pro'), 'club_gold');
    await user.type(screen.getByPlaceholderText('Patrocinio Pro'), 'Patrocinio Gold');
    await user.type(screen.getByRole('spinbutton'), '2499');

    await user.click(screen.getByRole('button', { name: /guardar tarifa/i }));

    await waitFor(() => {
      expect(saveSponsorshipRate).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'club_gold',
          name: 'Patrocinio Gold',
          amount: 2499,
          actor: expect.objectContaining({ memberId: 'admin-1' }),
        })
      );
    });
  });

  it('sube el logo de la marca al mismo Storage y lo guarda con el patrocinio', async () => {
    const user = userEvent.setup();
    render(<Sponsorships />);

    await user.click(await screen.findByRole('button', { name: /nueva marca/i }));
    await user.type(screen.getByPlaceholderText('Refacciones Express'), 'Frenos Premium');
    await user.type(screen.getByLabelText(/costo del patrocinio/i), '1500');

    const fileInput = document.querySelector('#sponsorship-brand-form input[type="file"]');
    await user.upload(fileInput, new File(['logo'], 'marca.png', { type: 'image/png' }));

    await waitFor(() => {
      expect(uploadLogo).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-1', scope: 'sponsor' })
      );
      expect(screen.getByRole('img', { name: /Frenos Premium/ })).toHaveAttribute(
        'src',
        'https://cdn/nueva-marca.png'
      );
    });

    await user.click(screen.getByRole('button', { name: /guardar patrocinio/i }));

    await waitFor(() => {
      expect(saveClubSponsor).toHaveBeenCalledWith(
        expect.objectContaining({
          brandName: 'Frenos Premium',
          logoUrl: 'https://cdn/nueva-marca.png',
        })
      );
    });
  });

  it('muestra ingresos, impacto y patrocinios por marca en la pestaña financiera', async () => {
    const user = userEvent.setup();
    render(<Sponsorships />);

    expect(await screen.findByText('Refacciones Express')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /finanzas e impacto/i }));

    expect(screen.getByText('Ingresos mensuales')).toBeInTheDocument();
    expect(screen.getByText('Compras atribuidas')).toBeInTheDocument();
    expect(screen.getByText('Impacto comercial por marca')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});
