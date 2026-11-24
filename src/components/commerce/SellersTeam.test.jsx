import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SellersTeam from './SellersTeam';

vi.mock('../../context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'owner-1' } }),
}));

vi.mock('../../data/commerceSellers', () => ({
  fetchCommerceTeam: vi.fn(async () => ({
    items: [
      {
        id: 'member-1',
        userId: 'seller-1',
        fullName: 'Ana Torres',
        email: 'ana@example.com',
        avatarUrl: null,
        role: 'seller',
        isActive: true,
        createdAt: null,
        offersSent: 3,
        salesClosed: 8,
        salesAmount: 1500,
        rating: null,
        initials: 'AT',
      },
    ],
    error: null,
    notice: null,
  })),
  createSeller: vi.fn(async () => ({ ok: true })),
  updateSeller: vi.fn(async () => ({ ok: true })),
  resetSellerPassword: vi.fn(async () => ({ ok: true })),
  setSellerActive: vi.fn(async () => ({ ok: true })),
}));

const renderTeam = () =>
  render(
    <MemoryRouter>
      <SellersTeam />
    </MemoryRouter>
  );

describe('equipo y vendedores', () => {
  it('muestra tarjetas respiradas con ventas cerradas y estado', async () => {
    renderTeam();

    const card = (await screen.findByText('Ana Torres')).closest('article');
    expect(card?.className).toContain('p-5');
    expect(screen.getByText('8 ventas')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('abre el modal en el body con el ancho completo de la columna móvil', async () => {
    const user = userEvent.setup();
    renderTeam();

    await user.click(await screen.findByRole('button', { name: 'Agregar vendedor' }));

    const dialog = screen.getByRole('dialog', { name: /agregar vendedor/i });
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.className).toContain('bg-black/50');
    expect(dialog.className).toContain('z-50');

    const panel = dialog.firstElementChild;
    for (const className of ['max-w-md', 'max-h-[85vh]', 'overflow-y-auto', 'rounded-3xl', 'p-6']) {
      expect(panel.className).toContain(className);
    }

    expect(screen.getByPlaceholderText('Ej. Ana Torres')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('vendedor@ejemplo.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mínimo 8 caracteres')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear vendedor' })).toBeInTheDocument();
  });
});
