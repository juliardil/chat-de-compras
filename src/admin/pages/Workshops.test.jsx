import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Workshops from './Workshops';

const { listWorkshops, setWorkshopVerification, notify } = vi.hoisted(() => ({
  listWorkshops: vi.fn(),
  setWorkshopVerification: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../auth/useAdminAuth', () => ({
  useAdminAuth: vi.fn(() => ({
    session: { memberId: 'admin-1', name: 'Ana Torres', roleKey: 'superadmin' },
    hasPermission: vi.fn(() => true),
    mode: 'insforge',
  })),
}));

vi.mock('../data', () => ({
  adminRepository: { listWorkshops, setWorkshopVerification },
}));

vi.mock('../components/useToast', () => ({
  useToast: () => ({ notify }),
}));

const workshops = [
  {
    id: 'w-1',
    workshopName: 'Taller Reforma',
    nitOrId: 'RFC-REF',
    address: 'Av. Reforma 1',
    phone: '551234',
    specialties: ['Frenos'],
    isVerified: true,
    createdAt: '2026-11-01T10:00:00Z',
    ownerName: 'Luis',
  },
  {
    id: 'w-2',
    workshopName: 'Electro Auto Norte',
    nitOrId: 'RFC-EAN',
    address: 'Calle 7',
    phone: '812345',
    specialties: ['Electricidad'],
    isVerified: false,
    createdAt: '2026-11-10T10:00:00Z',
    ownerName: 'Iván',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  listWorkshops.mockResolvedValue(workshops);
  setWorkshopVerification.mockResolvedValue({
    id: 'w-2',
    workshopName: 'Electro Auto Norte',
    isVerified: true,
  });
});

describe('panel admin de Talleres Verificados', () => {
  it('muestra todos los datos exigidos para cada taller', async () => {
    render(<Workshops />);

    expect(await screen.findByText('Taller Reforma')).toBeInTheDocument();
    expect(screen.getByText('RFC-REF')).toBeInTheDocument();
    expect(screen.getByText('Av. Reforma 1')).toBeInTheDocument();
    expect(screen.getByText('551234')).toBeInTheDocument();
    expect(screen.getByText('Frenos')).toBeInTheDocument();
    expect(screen.getAllByText(/verificado/i).length).toBeGreaterThan(0);
  });

  it('pide confirmación y activa la verificación por RPC', async () => {
    const user = userEvent.setup();
    render(<Workshops />);

    await user.click(await screen.findByRole('button', { name: /activar verificación/i }));
    expect(
      screen.getByRole('heading', { name: /activar verificación/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sí, activar/i }));

    await waitFor(() => {
      expect(setWorkshopVerification).toHaveBeenCalledWith({
        workshopId: 'w-2',
        isVerified: true,
        actor: expect.objectContaining({ memberId: 'admin-1' }),
      });
    });
    expect(notify).toHaveBeenCalled();
  });

  it('filtra los talleres por texto de búsqueda', async () => {
    const user = userEvent.setup();
    render(<Workshops />);

    await user.type(
      await screen.findByPlaceholderText(/buscar por nombre, nit/i),
      'Electricidad'
    );

    expect(screen.getByText('Electro Auto Norte')).toBeInTheDocument();
    expect(screen.queryByText('Taller Reforma')).not.toBeInTheDocument();
  });
});
