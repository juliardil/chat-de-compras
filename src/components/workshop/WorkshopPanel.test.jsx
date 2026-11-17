import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkshopPanel from './WorkshopPanel';

vi.mock('../../data/workshop', () => ({
  fetchMyWorkshop: vi.fn(),
  saveWorkshop: vi.fn(),
  WORKSHOP_SPECIALTIES: ['Mecánica general', 'Motos', 'Electricidad', 'Latonería'],
}));

import { fetchMyWorkshop, saveWorkshop } from '../../data/workshop';

beforeEach(() => {
  vi.clearAllMocks();
  fetchMyWorkshop.mockResolvedValue({ items: [], error: null, notice: null });
  saveWorkshop.mockResolvedValue({ ok: true, error: null });
});

describe('Soy un Taller Mecánico / Negocio', () => {
  it('muestra el botón de registro cuando el usuario aún no tiene taller', async () => {
    render(<WorkshopPanel />);

    expect(
      await screen.findByRole('heading', { name: /soy un taller mecánico \/ negocio/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registrar mi taller/i })).toBeInTheDocument();
    expect(screen.queryByText(/taller verificado/i)).not.toBeInTheDocument();
  });

  it('abre el formulario y guarda los datos con las especialidades elegidas', async () => {
    const user = userEvent.setup();
    render(<WorkshopPanel />);

    await user.click(await screen.findByRole('button', { name: /registrar mi taller/i }));

    await user.type(screen.getByLabelText('Nombre del taller'), 'Taller La Esquina');
    await user.type(screen.getByLabelText('NIT/Cédula'), 'NIT-123');
    await user.type(screen.getByLabelText('Dirección'), 'Calle 1 #2');
    await user.type(screen.getByLabelText('Teléfono'), '5551234');
    await user.click(screen.getByRole('checkbox', { name: 'Mecánica general' }));
    await user.click(screen.getByRole('checkbox', { name: 'Motos' }));
    await user.click(screen.getByRole('button', { name: /guardar mi taller/i }));

    await waitFor(() => {
      expect(saveWorkshop).toHaveBeenCalledWith({
        workshopName: 'Taller La Esquina',
        nitOrId: 'NIT-123',
        address: 'Calle 1 #2',
        phone: '5551234',
        specialties: ['Mecánica general', 'Motos'],
      });
    });
  });

  it('muestra la credencial, los datos fiscales y los beneficios activos', async () => {
    fetchMyWorkshop.mockResolvedValue({
      items: [
        {
          id: 'w-1',
          user_id: 'u-1',
          workshop_name: 'Taller La Esquina',
          nit_or_id: 'NIT-123',
          address: 'Calle 1 #2',
          phone: '5551234',
          specialties: ['Mecánica general', 'Motos'],
          is_verified: true,
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
      notice: null,
    });

    render(<WorkshopPanel />);

    expect(await screen.findByText('Taller La Esquina')).toBeInTheDocument();
    expect(screen.getByText('Taller Verificado')).toBeInTheDocument();
    expect(screen.getByText('NIT-123')).toBeInTheDocument();
    expect(screen.getByText('Calle 1 #2')).toBeInTheDocument();
    expect(screen.getByText('5551234')).toBeInTheDocument();
    expect(screen.getByText('Tarifas mayoristas')).toBeInTheDocument();
    expect(screen.getByText('Recepción de trabajos de instalación')).toBeInTheDocument();
    expect(screen.getByText('Control por placa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actualizar datos del taller/i })).toBeInTheDocument();
  });

  it('muestra el error devuelto por la RPC al guardar', async () => {
    const user = userEvent.setup();
    saveWorkshop.mockResolvedValue({ ok: false, error: 'El NIT o cédula es obligatorio.' });

    render(<WorkshopPanel />);
    await user.click(await screen.findByRole('button', { name: /registrar mi taller/i }));
    await user.type(screen.getByLabelText('Nombre del taller'), 'Taller Norte');
    await user.type(screen.getByLabelText('NIT/Cédula'), 'NIT-999');
    await user.type(screen.getByLabelText('Dirección'), 'Av. Principal 10');
    await user.type(screen.getByLabelText('Teléfono'), '5550000');
    await user.click(screen.getByRole('button', { name: /guardar mi taller/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El NIT o cédula es obligatorio.');
  });
});
