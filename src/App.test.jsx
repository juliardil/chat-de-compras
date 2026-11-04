import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

const SESSION_KEY = 'chat_compras_session';
const LOGGED_OUT_KEY = 'chat_compras_logged_out';

const renderAt = (path, session) => {
  localStorage.clear();

  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.setItem(LOGGED_OUT_KEY, '1');
  }

  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
};

describe('guardas de ruta por rol', () => {
  it('redirige a welcome si no hay sesión', async () => {
    renderAt('/dashboard');

    expect(await screen.findByRole('button', { name: /soy usuario/i })).toBeInTheDocument();
  });

  it('impide que un usuario entre al panel de comercio', async () => {
    renderAt('/dashboard', { role: 'user', name: 'Julia' });

    expect(await screen.findByRole('heading', { level: 1, name: /automotriz/i })).toBeInTheDocument();
    expect(screen.queryByText(/panel de oportunidades/i)).not.toBeInTheDocument();
  });

  it('impide que un comercio entre a las categorías de usuario', async () => {
    renderAt('/categories', { role: 'commerce', name: 'Comercio Demo' });

    expect(await screen.findByText(/panel de oportunidades/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /automotriz/i })).not.toBeInTheDocument();
  });

  it('muestra 404 en una ruta desconocida', async () => {
    renderAt('/ruta-inexistente', { role: 'user', name: 'Julia' });

    expect(await screen.findByText(/página no encontrada/i)).toBeInTheDocument();
  });
});
