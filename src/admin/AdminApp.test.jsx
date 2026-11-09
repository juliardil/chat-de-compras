import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import AdminApp from './AdminApp';

const renderAdmin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AdminApp />
    </MemoryRouter>
  );

const loginWithDemoAccount = async (email) => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: new RegExp(email, 'i') }));
  await user.click(screen.getByRole('button', { name: /entrar al panel/i }));
  return user;
};

describe('panel administrativo (modo demostración)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('permite entrar con una cuenta demo y cargar el panel', async () => {
    renderAdmin();

    expect(await screen.findByRole('heading', { name: /acceso administrativo/i })).toBeInTheDocument();
    expect(screen.getByText(/modo demostración local/i)).toBeInTheDocument();

    await loginWithDemoAccount('superadmin@demo.local');

    expect(
      await screen.findByRole('heading', { level: 1, name: /panel de control/i })
    ).toBeInTheDocument();
    expect(await screen.findByText(/personal activo/i)).toBeInTheDocument();
  });

  it('muestra solo las secciones permitidas para el rol', async () => {
    renderAdmin();
    await loginWithDemoAccount('analista@demo.local');

    await screen.findByRole('heading', { level: 1, name: /panel de control/i });

    const sidebar = screen.getByRole('complementary', { name: /menú administrativo/i });
    expect(within(sidebar).queryByRole('link', { name: /personal y permisos/i })).not.toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: /auditoría/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: /analítica/i })).toBeInTheDocument();
  });

  it('abre compradores, comercios y categorías en lugar del aviso de módulo pendiente', async () => {
    renderAdmin();
    const user = await loginWithDemoAccount('superadmin@demo.local');

    await screen.findByRole('heading', { level: 1, name: /panel de control/i });
    const sidebar = screen.getByRole('complementary', { name: /menú administrativo/i });

    await user.click(within(sidebar).getByRole('link', { name: /compradores/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /^compradores$/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/compradores de demostración/i)).toBeInTheDocument();
    expect(screen.queryByText(/este módulo todavía no existe/i)).not.toBeInTheDocument();

    await user.click(within(sidebar).getByRole('link', { name: /comercios/i }));
    expect(await screen.findByRole('heading', { level: 1, name: /^comercios$/i })).toBeInTheDocument();
    expect(screen.getByText(/comercios de demostración/i)).toBeInTheDocument();
    expect(screen.queryByText(/este módulo todavía no existe/i)).not.toBeInTheDocument();

    await user.click(within(sidebar).getByRole('link', { name: /categorías y datos/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /categorías y datos/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/catálogo de demostración/i)).toBeInTheDocument();
    expect(screen.queryByText(/este módulo todavía no existe/i)).not.toBeInTheDocument();
  });

  it('abre solicitudes, ofertas, pedidos y entregas en lugar del aviso de módulo pendiente', async () => {
    renderAdmin();
    const user = await loginWithDemoAccount('superadmin@demo.local');

    await screen.findByRole('heading', { level: 1, name: /panel de control/i });
    const sidebar = screen.getByRole('complementary', { name: /menú administrativo/i });

    await user.click(within(sidebar).getByRole('link', { name: /solicitudes/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /^solicitudes$/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/solicitudes de demostración/i)).toBeInTheDocument();
    expect(screen.queryByText(/este módulo todavía no existe/i)).not.toBeInTheDocument();

    await user.click(within(sidebar).getByRole('link', { name: /ofertas/i }));
    expect(await screen.findByRole('heading', { level: 1, name: /^ofertas$/i })).toBeInTheDocument();
    expect(screen.getByText(/ofertas de demostración/i)).toBeInTheDocument();
    expect(screen.queryByText(/este módulo todavía no existe/i)).not.toBeInTheDocument();

    await user.click(within(sidebar).getByRole('link', { name: /pedidos/i }));
    expect(await screen.findByRole('heading', { level: 1, name: /^pedidos$/i })).toBeInTheDocument();
    expect(screen.getByText(/pedidos de demostración/i)).toBeInTheDocument();
    expect(screen.queryByText(/este módulo todavía no existe/i)).not.toBeInTheDocument();

    await user.click(within(sidebar).getByRole('link', { name: /entregas/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /^entregas$/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/entregas de demostración/i)).toBeInTheDocument();
    expect(screen.queryByText(/este módulo todavía no existe/i)).not.toBeInTheDocument();
  });

  it('abre chats, moderación, reseñas, soporte y comunicaciones en lugar del aviso de módulo pendiente', async () => {
    renderAdmin();
    const user = await loginWithDemoAccount('superadmin@demo.local');

    await screen.findByRole('heading', { level: 1, name: /panel de control/i });
    const sidebar = screen.getByRole('complementary', { name: /menú administrativo/i });

    await user.click(within(sidebar).getByRole('link', { name: /^chats/i }));
    expect(await screen.findByRole('heading', { level: 1, name: /^chats$/i })).toBeInTheDocument();
    expect(await screen.findByText(/chats de demostración/i)).toBeInTheDocument();
    expect(screen.queryByText(/este módulo todavía no existe/i)).not.toBeInTheDocument();

    await user.click(within(sidebar).getByRole('link', { name: /^moderación/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /^moderación$/i })
    ).toBeInTheDocument();
    expect(await screen.findByText(/reportes de demostración/i)).toBeInTheDocument();
    expect(screen.queryByText(/este módulo todavía no existe/i)).not.toBeInTheDocument();

    await user.click(within(sidebar).getByRole('link', { name: /^reseñas/i }));
    expect(await screen.findByRole('heading', { level: 1, name: /^reseñas$/i })).toBeInTheDocument();
    expect(await screen.findByText(/reseñas de demostración/i)).toBeInTheDocument();
    expect(screen.queryByText(/este módulo todavía no existe/i)).not.toBeInTheDocument();

    await user.click(within(sidebar).getByRole('link', { name: /^soporte/i }));
    expect(await screen.findByRole('heading', { level: 1, name: /^soporte$/i })).toBeInTheDocument();
    expect(await screen.findByText(/soporte de demostración/i)).toBeInTheDocument();
    expect(screen.queryByText(/este módulo todavía no existe/i)).not.toBeInTheDocument();

    await user.click(within(sidebar).getByRole('link', { name: /^comunicaciones/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /^comunicaciones$/i })
    ).toBeInTheDocument();
    expect(await screen.findByText(/envíos simulados, no reales/i)).toBeInTheDocument();
    expect(screen.queryByText(/este módulo todavía no existe/i)).not.toBeInTheDocument();
  });
});
