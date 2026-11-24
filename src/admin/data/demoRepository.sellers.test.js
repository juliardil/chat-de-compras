import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD, demoRepository } from './demoRepository';

const loginAs = async (email) => demoRepository.login({ email, password: DEMO_PASSWORD });

beforeEach(() => {
  localStorage.clear();
  demoRepository.getSession();
});

describe('repositorio de vendedores afiliados en demostración', () => {
  it('lista vendedores con comercio, estado y métricas', async () => {
    const actor = await loginAs('superadmin@demo.local');

    const sellers = await demoRepository.listAdminSellers({ actor });

    expect(sellers.length).toBeGreaterThan(1);
    expect(sellers[0]).toMatchObject({
      id: expect.any(String),
      fullName: expect.any(String),
      email: expect.any(String),
      commerceName: expect.any(String),
      isActive: expect.any(Boolean),
      salesClosed: expect.any(Number),
      chatCount: expect.any(Number),
    });
    expect(sellers.every((seller) => seller.sales === undefined && seller.chats === undefined)).toBe(
      true
    );
  });

  it('busca por vendedor, correo o comercio', async () => {
    const actor = await loginAs('superadmin@demo.local');

    const byName = await demoRepository.listAdminSellers({ search: 'Andrés', actor });
    const byEmail = await demoRepository.listAdminSellers({ search: 'lospinos.demo', actor });
    const byCommerce = await demoRepository.listAdminSellers({ search: 'Eléctricos', actor });

    expect(byName.map((seller) => seller.fullName)).toEqual(['Andrés Martínez']);
    expect(byEmail.map((seller) => seller.fullName)).toEqual(['Camila Pérez']);
    expect(byCommerce.map((seller) => seller.fullName)).toEqual(['Miguel Ángel Rojas']);
  });

  it('muestra el detalle de ventas y chats, y oculta mensajes sin permiso de contenido', async () => {
    const superadmin = await loginAs('superadmin@demo.local');
    const withContent = await demoRepository.getAdminSellerDetail({
      sellerId: 'demo-seller-1',
      actor: superadmin,
    });

    expect(withContent.seller.fullName).toBe('Andrés Martínez');
    expect(withContent.sales.length).toBeGreaterThan(0);
    expect(withContent.chats[0].messages.length).toBeGreaterThan(0);
    expect(withContent.contentUnlocked).toBe(true);

    const support = await loginAs('soporte@demo.local');
    const withoutContent = await demoRepository.getAdminSellerDetail({
      sellerId: 'demo-seller-1',
      actor: { ...support, permissions: ['sellers.view'] },
    });

    expect(withoutContent.contentUnlocked).toBe(false);
    expect(withoutContent.chats[0].messages).toEqual([]);
  });

  it('cambia el estado con motivo, auditoría y sin tocar a los dueños', async () => {
    const actor = await loginAs('superadmin@demo.local');

    const updated = await demoRepository.setSellerActive({
      sellerId: 'demo-seller-1',
      isActive: false,
      reason: 'Bajo desempeño: sin cierres en el periodo',
      reasonCode: 'performance',
      actor,
    });
    expect(updated).toMatchObject({ id: 'demo-seller-1', isActive: false });

    const audit = await demoRepository.listAudit({ module: 'Vendedores' });
    expect(audit.map((entry) => entry.action)).toContain('sellers.deactivate');

    await expect(
      demoRepository.setSellerActive({
        sellerId: 'demo-seller-owner',
        isActive: false,
        reason: 'Prueba',
        actor,
      })
    ).rejects.toThrow(/dueños|vendedores afiliados|solo se puede/i);
  });

  it('exige permiso de gestión y motivo para cambiar el estado', async () => {
    const viewer = await loginAs('analista@demo.local');

    await expect(
      demoRepository.setSellerActive({
        sellerId: 'demo-seller-1',
        isActive: false,
        reason: 'Prueba',
        actor: viewer,
      })
    ).rejects.toThrow(/permiso/i);

    const actor = await loginAs('superadmin@demo.local');
    await expect(
      demoRepository.setSellerActive({
        sellerId: 'demo-seller-1',
        isActive: false,
        reason: '   ',
        actor,
      })
    ).rejects.toThrow(/motivo/i);
  });
});
