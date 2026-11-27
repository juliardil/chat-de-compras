import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Vendedores from './Vendedores';
import { DEMO_PASSWORD, demoRepository } from '../data/demoRepository';

// Integración real UI → repositorio → auditoría, sin tocar InsForge: el setup
// de pruebas fuerza modo demostración y `../data` resuelve a demoRepository.
const harness = vi.hoisted(() => ({
  session: null,
  notify: vi.fn(),
}));

vi.mock('../auth/useAdminAuth', () => ({
  useAdminAuth: vi.fn(() => ({
    session: harness.session,
    hasPermission: (key) => ['sellers.view', 'sellers.manage', 'audit.view'].includes(key),
    mode: 'demo',
  })),
}));

vi.mock('../components/useToast', () => ({
  useToast: () => ({ notify: harness.notify }),
}));

const readAudit = () => demoRepository.listAudit({ module: 'Vendedores' });

beforeEach(async () => {
  localStorage.clear();
  demoRepository.getSession();
  harness.notify.mockClear();
  harness.session = await demoRepository.login({
    email: 'superadmin@demo.local',
    password: DEMO_PASSWORD,
  });
});

describe('integración del panel de Vendedores con auditoría', () => {
  it('activa un afiliado inactivo y registra sellers.activate con el motivo', async () => {
    const user = userEvent.setup();
    render(<Vendedores />);

    const row = (await screen.findByText('Miguel Ángel Rojas')).closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Activar' }));

    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Motivo'), 'review_complete');
    await user.click(within(dialog).getByRole('button', { name: 'Activar' }));

    await waitFor(async () => {
      const sellers = await demoRepository.listAdminSellers({ actor: harness.session });
      expect(sellers.find((seller) => seller.id === 'demo-seller-3').isActive).toBe(true);
    });
    expect(harness.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Vendedor activado' })
    );

    const entry = (await readAudit()).find(
      (item) => item.action === 'sellers.activate' && item.entityId === 'demo-seller-3'
    );
    expect(entry).toBeTruthy();
    expect(entry).toMatchObject({
      actorId: harness.session.memberId,
      module: 'Vendedores',
      entityType: 'commerce_member',
      entityId: 'demo-seller-3',
    });
    expect(entry.metadata).toMatchObject({
      reasonCode: 'review_complete',
      previousIsActive: false,
      newIsActive: true,
      mode: 'demo',
    });
    expect(entry.reason).toContain('Revisión completada');
  });

  it('desactiva un afiliado con motivo y bloquea al dueño también en el repositorio', async () => {
    const user = userEvent.setup();
    render(<Vendedores />);

    const ownerRow = (await screen.findByText('Gabriela Núñez')).closest('tr');
    expect(within(ownerRow).queryByRole('button', { name: /Activar|Desactivar/ })).toBeNull();
    await expect(
      demoRepository.setSellerActive({
        sellerId: 'demo-seller-owner',
        isActive: false,
        reason: 'Intento de prueba',
        actor: harness.session,
      })
    ).rejects.toThrow(/afiliados|dueños/i);

    const sellerRow = (await screen.findByText('Andrés Martínez')).closest('tr');
    await user.click(within(sellerRow).getByRole('button', { name: 'Desactivar' }));

    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Motivo'), 'performance');
    await user.type(within(dialog).getByLabelText(/Detalle/), 'Sin cierres en el periodo');
    await user.click(within(dialog).getByRole('button', { name: 'Desactivar' }));

    await waitFor(async () => {
      const sellers = await demoRepository.listAdminSellers({ actor: harness.session });
      expect(sellers.find((seller) => seller.id === 'demo-seller-1').isActive).toBe(false);
    });

    const entry = (await readAudit()).find(
      (item) => item.action === 'sellers.deactivate' && item.entityId === 'demo-seller-1'
    );
    expect(entry).toBeTruthy();
    expect(entry.metadata).toMatchObject({
      reasonCode: 'performance',
      previousIsActive: true,
      newIsActive: false,
    });
    expect(entry.reason).toContain('Sin cierres en el periodo');
    expect((await readAudit()).some((item) => item.entityId === 'demo-seller-owner')).toBe(false);
  });
});
