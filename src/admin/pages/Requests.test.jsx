import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Requests from './Requests';

const { listRequests, getRequest, setRequestStatus, notify, useAdminAuth } = vi.hoisted(() => {
  // Sesión estable: Requests recarga la lista cuando cambia la identidad de
  // `session`, así que un objeto nuevo por render provocaría un bucle.
  const session = { memberId: 'admin-1', name: 'Ana Torres', roleKey: 'superadmin' };
  return {
    session,
    useAdminAuth: vi.fn(() => ({
      session,
      hasPermission: vi.fn(() => true),
      mode: 'insforge',
    })),
    listRequests: vi.fn(),
    getRequest: vi.fn(),
    setRequestStatus: vi.fn(),
    notify: vi.fn(),
  };
});

vi.mock('../auth/useAdminAuth', () => ({ useAdminAuth }));

vi.mock('../data', () => ({
  adminRepository: { listRequests, getRequest, setRequestStatus },
}));

vi.mock('../components/useToast', () => ({
  useToast: () => ({ notify }),
}));

const requests = [
  {
    id: 'r-1',
    title: 'Trabajo a domicilio',
    buyerName: 'Camila',
    categoryName: 'Servicios',
    requestType: 'service',
    specialty: 'Frenos',
    serviceModality: 'Servicio a domicilio',
    status: 'open',
    items: [],
    itemCount: 0,
    offerCount: 0,
    activeOfferCount: 0,
    budgetAmount: null,
    currency: 'MXN',
    publishedAt: '2026-11-20T10:00:00Z',
  },
  {
    id: 'r-2',
    title: 'Trabajo en taller',
    buyerName: 'Luis',
    categoryName: 'Servicios',
    requestType: 'service',
    specialty: 'Electricidad',
    serviceModality: 'Visita al taller',
    status: 'open',
    items: [],
    itemCount: 0,
    offerCount: 0,
    activeOfferCount: 0,
    budgetAmount: null,
    currency: 'MXN',
    publishedAt: '2026-11-19T10:00:00Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  listRequests.mockResolvedValue(requests);
  getRequest.mockResolvedValue(requests[0]);
});

const renderRequests = () =>
  render(
    <MemoryRouter>
      <Requests />
    </MemoryRouter>
  );

describe('panel admin de solicitudes con servicios', () => {
  it('muestra especialidad y modalidad por columna en cada solicitud', async () => {
    renderRequests();

    expect(await screen.findByText('Trabajo a domicilio')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Especialidad' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Modalidad' })).toBeInTheDocument();
    const homeRow = screen.getByRole('row', { name: /Trabajo a domicilio/i });
    expect(within(homeRow).getByText('Frenos')).toBeInTheDocument();
    expect(within(homeRow).getByText('Servicio a domicilio')).toBeInTheDocument();

    const workshopRow = screen.getByRole('row', { name: /Trabajo en taller/i });
    expect(within(workshopRow).getByText('Electricidad')).toBeInTheDocument();
    expect(within(workshopRow).getByText('Visita al taller')).toBeInTheDocument();
  });

  it('filtra las solicitudes por modalidad de atención', async () => {
    const user = userEvent.setup();
    renderRequests();

    const filter = await screen.findByLabelText('Filtrar solicitudes por modalidad');
    await user.selectOptions(filter, 'Visita al taller');

    expect(screen.queryByText('Trabajo a domicilio')).not.toBeInTheDocument();
    expect(screen.getByText('Trabajo en taller')).toBeInTheDocument();
  });

  it('filtra las solicitudes por especialidad', async () => {
    const user = userEvent.setup();
    renderRequests();

    const filter = await screen.findByLabelText('Filtrar solicitudes por especialidad');
    await user.selectOptions(filter, 'Frenos');

    expect(screen.getByText('Trabajo a domicilio')).toBeInTheDocument();
    expect(screen.queryByText('Trabajo en taller')).not.toBeInTheDocument();
  });
});
