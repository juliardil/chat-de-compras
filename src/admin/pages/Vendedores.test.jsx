import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Vendedores from './Vendedores';

const {
  listAdminSellers,
  getAdminSellerDetail,
  setSellerActive,
  notify,
  session,
  hasPermission,
} = vi.hoisted(() => ({
  listAdminSellers: vi.fn(),
  getAdminSellerDetail: vi.fn(),
  setSellerActive: vi.fn(),
  notify: vi.fn(),
  session: { memberId: 'admin-1', name: 'Ana Torres', roleKey: 'superadmin' },
  hasPermission: vi.fn(() => true),
}));

vi.mock('../auth/useAdminAuth', () => ({
  useAdminAuth: vi.fn(() => ({ session, hasPermission, mode: 'insforge' })),
}));

vi.mock('../data', () => ({
  adminRepository: { listAdminSellers, getAdminSellerDetail, setSellerActive },
}));

vi.mock('../components/useToast', () => ({
  useToast: () => ({ notify }),
}));

const sellers = [
  {
    id: 's1',
    fullName: 'Andrés Martínez',
    email: 'andres@frenosseguros.demo',
    commerceName: 'Frenos Seguros',
    avatarUrl: null,
    role: 'seller',
    isActive: true,
    joinedAt: '2026-01-01T00:00:00.000Z',
    offersSent: 16,
    salesClosed: 7,
    salesAmount: 985.5,
    rating: 4.6,
    chatCount: 9,
  },
  {
    id: 's2',
    fullName: 'Camila Pérez',
    email: 'camila@lospinos.demo',
    commerceName: 'Taller Los Pinos',
    avatarUrl: null,
    role: 'seller',
    isActive: false,
    joinedAt: '2026-02-01T00:00:00.000Z',
    offersSent: 11,
    salesClosed: 4,
    salesAmount: 620,
    rating: 4.8,
    chatCount: 6,
  },
  {
    id: 's3',
    fullName: 'Gabriela Núñez',
    email: 'gabriela@autopartescentral.demo',
    commerceName: 'AutoPartes Central',
    avatarUrl: null,
    role: 'owner',
    isActive: true,
    joinedAt: '2025-12-01T00:00:00.000Z',
    offersSent: 0,
    salesClosed: 0,
    salesAmount: 0,
    rating: null,
    chatCount: 0,
  },
];

const detail = {
  seller: sellers[0],
  sales: [
    {
      orderId: 'o1',
      orderNumber: 'GO-1042',
      status: 'completed',
      totalAmount: 245.5,
      currency: 'USD',
      buyerName: 'Valentina Rodríguez',
      placedAt: '2026-11-01T00:00:00.000Z',
      completedAt: '2026-11-02T00:00:00.000Z',
    },
  ],
  chats: [
    {
      chatId: 'c1',
      subject: 'Pastillas de freno',
      status: 'closed',
      buyerName: 'Valentina Rodríguez',
      rating: 5,
      createdAt: '2026-11-01T00:00:00.000Z',
      lastMessageAt: '2026-11-02T00:00:00.000Z',
      messageCount: 2,
      messages: [
        {
          id: 'm1',
          senderType: 'buyer',
          senderName: 'Valentina Rodríguez',
          body: '¿Tienen disponible el juego delantero?',
          createdAt: '2026-11-01T00:00:00.000Z',
        },
      ],
    },
  ],
  contentUnlocked: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  listAdminSellers.mockResolvedValue(sellers);
  getAdminSellerDetail.mockResolvedValue(detail);
  setSellerActive.mockResolvedValue({ id: 's1', fullName: 'Andrés Martínez', isActive: false });
});

describe('panel admin de Vendedores', () => {
  it('muestra el directorio con foto o iniciales, comercio, estado y métricas', async () => {
    render(<Vendedores />);

    expect(await screen.findByRole('heading', { level: 1, name: /^vendedores$/i })).toBeInTheDocument();
    expect(screen.getByText('Andrés Martínez')).toBeInTheDocument();
    expect(screen.getByText('Frenos Seguros')).toBeInTheDocument();
    expect(screen.getAllByText('Activo').length).toBeGreaterThan(0);
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByText(/985/)).toBeInTheDocument();
    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('busca por vendedor, correo o comercio', async () => {
    const user = userEvent.setup();
    render(<Vendedores />);

    await user.type(await screen.findByLabelText('Buscar vendedores'), 'lospinos.demo');

    expect(screen.getByText('Camila Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Andrés Martínez')).not.toBeInTheDocument();
  });

  it('abre el detalle con ventas y conversaciones', async () => {
    const user = userEvent.setup();
    render(<Vendedores />);

    await user.click(await screen.findByRole('button', { name: 'Andrés Martínez' }));

    expect(
      await screen.findByRole('heading', { name: /detalle del vendedor/i })
    ).toBeInTheDocument();
    expect(getAdminSellerDetail).toHaveBeenCalledWith({
      sellerId: 's1',
      actor: expect.objectContaining({ memberId: 'admin-1' }),
    });
    expect(await screen.findByText(/GO-1042/)).toBeInTheDocument();
    expect(screen.getByText(/¿Tienen disponible el juego delantero\?/)).toBeInTheDocument();
  });

  it('desactiva un vendedor con motivo y no ofrece esa acción para los dueños', async () => {
    const user = userEvent.setup();
    render(<Vendedores />);

    const ownerRow = (await screen.findByText('Gabriela Núñez')).closest('tr');
    expect(within(ownerRow).queryByRole('button', { name: /desactivar/i })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Desactivar' })[0]);
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Motivo'), 'performance');
    await user.click(within(dialog).getByRole('button', { name: 'Desactivar' }));

    await waitFor(() => {
      expect(setSellerActive).toHaveBeenCalledWith({
        sellerId: 's1',
        isActive: false,
        reason: 'Bajo desempeño',
        reasonCode: 'performance',
        actor: expect.objectContaining({ memberId: 'admin-1' }),
      });
    });
    expect(notify).toHaveBeenCalled();
  });
});
