import { describe, expect, it } from 'vitest';
import { mapSellerMember, sellerInitials } from './commerceSellers';

describe('equipo de vendedores', () => {
  it('resuelve iniciales para la foto de respaldo', () => {
    expect(sellerInitials('Ana Torres')).toBe('AT');
    expect(sellerInitials('  ana   torres  ')).toBe('AT');
    expect(sellerInitials('')).toBe('');
  });

  it('normaliza métricas y estado de una fila de app_commerce_team', () => {
    const seller = mapSellerMember({
      id: 'member-1',
      user_id: 'user-1',
      full_name: 'Ana Torres',
      email: 'ana@example.com',
      avatar_url: null,
      role: 'seller',
      is_active: true,
      offers_sent: 12,
      sales_closed: 8,
      sales_amount: 15400.5,
      rating: 4.8,
    });

    expect(seller).toMatchObject({
      userId: 'user-1',
      fullName: 'Ana Torres',
      initials: 'AT',
      isActive: true,
      offersSent: 12,
      salesClosed: 8,
      salesAmount: 15400.5,
      rating: 4.8,
    });
  });

  it('no inventa calificación cuando el vendedor aún no tiene ventas', () => {
    const seller = mapSellerMember({
      full_name: 'Nuevo Vendedor',
      role: 'seller',
      is_active: false,
      rating: null,
    });

    expect(seller.rating).toBeNull();
    expect(seller.isActive).toBe(false);
    expect(seller.offersSent).toBe(0);
    expect(seller.salesAmount).toBe(0);
  });
});
