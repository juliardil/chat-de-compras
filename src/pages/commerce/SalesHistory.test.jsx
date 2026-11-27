import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalesHistory from './SalesHistory';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../components/layout/CommerceBottomNav', () => ({
  default: () => <div>Navegación inferior</div>,
}));

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchCommerceIdForUser: vi.fn(),
    fetchCommerceSales: vi.fn(),
  };
});

import { fetchCommerceIdForUser, fetchCommerceSales } from '../../data/appData';

const NOW = new Date('2026-11-27T12:00:00.000Z');

const rows = [
  {
    id: 'order-1',
    order_number: 'ORD-001',
    status: 'completed',
    total_amount: 1000,
    currency: 'MXN',
    created_at: '2026-11-27T09:00:00.000Z',
    snapshot: { product: 'Bafles', image: null },
    items: [{ id: 'item-1', name: 'Bafles', quantity: 2 }],
    sold_by_name: 'Sofía Ramírez',
  },
  {
    id: 'order-2',
    order_number: 'ORD-002',
    status: 'delivered',
    total_amount: 2000,
    currency: 'MXN',
    created_at: '2026-11-17T09:00:00.000Z',
    snapshot: { product: 'Amplificador' },
    items: [],
    sold_by_name: '',
  },
  {
    id: 'order-3',
    order_number: 'ORD-003',
    status: 'pending',
    total_amount: 500,
    currency: 'MXN',
    created_at: '2026-11-26T09:00:00.000Z',
    snapshot: { product: 'Luces LED' },
    items: [{ id: 'item-3', item: 'Luces LED', quantity: 1 }],
    status_reason: 'Esperando confirmación del comprador',
  },
  {
    id: 'order-4',
    order_number: 'ORD-004',
    status: 'shipped',
    total_amount: 700,
    currency: 'MXN',
    created_at: '2026-11-07T09:00:00.000Z',
    snapshot: { product: 'Neumático' },
    items: [],
  },
  {
    id: 'order-5',
    order_number: 'ORD-005',
    status: 'cancelled',
    total_amount: 300,
    currency: 'MXN',
    created_at: '2026-11-25T09:00:00.000Z',
    snapshot: { product: 'Pedido cancelado' },
    items: [],
  },
];

const renderHistory = () =>
  render(
    <AuthContext.Provider value={{ user: { id: 'user-1', role: 'commerce' } }}>
      <SalesHistory />
    </AuthContext.Provider>
  );

const readBlob = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsText(blob);
});

const openMenu = async (user) => {
  const button = screen.getByRole('button', { name: 'Opciones de transacciones' });
  await user.click(button);
  return screen.getByRole('menu', { name: 'Opciones de transacciones' });
};

beforeEach(() => {
  vi.setSystemTime(NOW);
  fetchCommerceIdForUser.mockReset();
  fetchCommerceSales.mockReset();
  fetchCommerceIdForUser.mockResolvedValue({
    item: { id: 'commerce-1', status: 'approved' },
    error: null,
    notice: null,
  });
  fetchCommerceSales.mockResolvedValue({ items: rows, error: null, notice: null });

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:transacciones-test'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('menú ⋮ del historial de ventas', () => {
  it('es accesible y se cierra al elegir una opción, con Escape o clic fuera', async () => {
    renderHistory();
    const user = userEvent.setup();

    expect(await screen.findByText('Bafles')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Opciones de transacciones' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    const menu = await openMenu(user);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getByRole('menuitemradio', { name: 'Entregadas y confirmadas' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Exportar CSV' })).toBeTruthy();

    fireEvent.mouseDown(screen.getByText('Transacciones'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await openMenu(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');

    const secondMenu = await openMenu(user);
    await user.click(
      within(secondMenu).getByRole('menuitemradio', { name: 'Entregadas y confirmadas' })
    );
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('filtra transacciones por estado y fecha en tiempo real y permite limpiar', async () => {
    renderHistory();
    const user = userEvent.setup();

    expect(await screen.findByText('Pedido cancelado')).toBeTruthy();

    let menu = await openMenu(user);
    await user.click(
      within(menu).getByRole('menuitemradio', { name: 'Entregadas y confirmadas' })
    );
    expect(screen.getByText('Bafles')).toBeTruthy();
    expect(screen.getByText('Amplificador')).toBeTruthy();
    expect(screen.queryByText('Luces LED')).toBeNull();
    expect(screen.queryByText('Pedido cancelado')).toBeNull();
    expect(screen.getByText(/Entregadas y confirmadas · 2/)).toBeTruthy();

    menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Pendientes' }));
    expect(screen.queryByText('Bafles')).toBeNull();
    expect(screen.getByText('Luces LED')).toBeTruthy();
    expect(screen.getByText('Neumático')).toBeTruthy();

    menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Hoy' }));
    expect(screen.getByText('Bafles')).toBeTruthy();
    expect(screen.queryByText('Luces LED')).toBeNull();
    expect(screen.queryByText('Neumático')).toBeNull();

    menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Últimos 7 días' }));
    expect(screen.getByText('Bafles')).toBeTruthy();
    expect(screen.getByText('Luces LED')).toBeTruthy();
    expect(screen.getByText('Pedido cancelado')).toBeTruthy();
    expect(screen.queryByText('Amplificador')).toBeNull();

    menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Limpiar filtro' }));
    expect(screen.getByText('Amplificador')).toBeTruthy();
    expect(screen.getByText('Pedido cancelado')).toBeTruthy();
    expect(screen.queryByText(/Últimos 7 días ·/)).toBeNull();
  });

  it('exporta solo las transacciones filtradas en CSV y JSON', async () => {
    renderHistory();
    const user = userEvent.setup();

    expect(await screen.findByText('Bafles')).toBeTruthy();
    let menu = await openMenu(user);
    await user.click(
      within(menu).getByRole('menuitemradio', { name: 'Entregadas y confirmadas' })
    );

    menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Exportar CSV' }));

    const clickSpy = HTMLAnchorElement.prototype.click;
    const csvBlob = URL.createObjectURL.mock.calls.at(-1)[0];
    expect(clickSpy.mock.instances.at(-1).download).toMatch(/^transacciones-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csvBlob.type).toContain('text/csv');
    const csvText = await readBlob(csvBlob);
    expect(csvText).toContain('Bafles');
    expect(csvText).toContain('Amplificador');
    expect(csvText).not.toContain('Luces LED');

    menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Exportar JSON' }));

    const jsonBlob = URL.createObjectURL.mock.calls.at(-1)[0];
    expect(clickSpy.mock.instances.at(-1).download).toMatch(/^transacciones-\d{4}-\d{2}-\d{2}\.json$/);
    const json = JSON.parse(await readBlob(jsonBlob));
    expect(json).toMatchObject({ filtro: 'Entregadas y confirmadas', total: 2 });
    expect(json.transacciones.map((row) => row.producto)).toEqual([
      'Bafles',
      'Amplificador',
    ]);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('abre el detalle desde el menú y desde una transacción, y cierra con Escape', async () => {
    renderHistory();
    const user = userEvent.setup();

    expect(await screen.findByText('Bafles')).toBeTruthy();
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Ver detalle' }));

    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Bafles' })).toBeTruthy();
    expect(within(dialog).getByText('Sofía Ramírez')).toBeTruthy();
    expect(within(dialog).getByText('Completado')).toBeTruthy();
    expect(within(dialog).getByText('× 2')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Ver detalle de Luces LED' }));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Luces LED' })).toBeTruthy();
    expect(within(dialog).getByText('Esperando confirmación del comprador')).toBeTruthy();

    await user.click(
      within(dialog).getAllByRole('button', { name: 'Cerrar detalle' })[0]
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('cierra el menú con un segundo clic en el botón ⋮', async () => {
    renderHistory();
    const user = userEvent.setup();

    expect(await screen.findByText('Bafles')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Opciones de transacciones' });

    await user.click(button);
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(button).toHaveAttribute('aria-expanded', 'true');

    await user.click(button);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('aplica el filtro de últimos 30 días desde el menú ⋮', async () => {
    renderHistory();
    const user = userEvent.setup();

    expect(await screen.findByText('Pedido cancelado')).toBeTruthy();
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Últimos 30 días' }));

    expect(screen.getByText(/Últimos 30 días · 5/)).toBeTruthy();
    expect(screen.getByText('Bafles')).toBeTruthy();
    expect(screen.getByText('Neumático')).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
