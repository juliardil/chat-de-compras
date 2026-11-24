import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NicheConfig from './NicheConfig';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchCommerceIdForUser: vi.fn(),
    updateCommerceMaxResponseMinutes: vi.fn(),
    updateCommerceSegmentation: vi.fn(),
  };
});

import {
  fetchCommerceIdForUser,
  updateCommerceMaxResponseMinutes,
  updateCommerceSegmentation,
} from '../../data/appData';

const updateProfile = vi.fn();

const renderConfig = () =>
  render(
    <AuthContext.Provider
      value={{ user: { id: 'user-1', role: 'commerce', business: {} }, updateProfile }}
    >
      <MemoryRouter initialEntries={['/niche-config']}>
        <NicheConfig />
      </MemoryRouter>
    </AuthContext.Provider>
  );

beforeEach(() => {
  fetchCommerceIdForUser.mockReset();
  fetchCommerceIdForUser.mockResolvedValue({
    item: {
      id: 'commerce-1',
      max_response_minutes: 15,
      vehicle_types: ['carros'],
      inventory_systems: ['Frenos', 'Motor'],
    },
    error: null,
    notice: null,
  });
  updateCommerceMaxResponseMinutes.mockReset();
  updateCommerceMaxResponseMinutes.mockResolvedValue({ ok: true, data: null, error: null });
  updateCommerceSegmentation.mockReset();
  updateCommerceSegmentation.mockResolvedValue({ ok: true, data: null, error: null });
  updateProfile.mockReset();
  updateProfile.mockResolvedValue(null);
});

describe('nichos y líneas activas del comercio', () => {
  it('carga la segmentación guardada en commerce_profiles', async () => {
    renderConfig();

    expect(await screen.findByText('Nichos Activos')).toBeInTheDocument();
    expect(
      await screen.findByRole('checkbox', { name: 'Carros', checked: true })
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Motos' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Frenos' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Motor' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Suspensión' })).not.toBeChecked();
  });

  it('ofrece todos los tipos de vehículo y líneas de inventario', async () => {
    renderConfig();

    expect(await screen.findByText('Tipos de vehículo')).toBeInTheDocument();
    expect(screen.getByText('Líneas de inventario')).toBeInTheDocument();
    ['Carros', 'Motos'].forEach((label) => {
      expect(screen.getByRole('checkbox', { name: label })).toBeInTheDocument();
    });
    [
      'Motor',
      'Frenos',
      'Suspensión',
      'Eléctrico',
      'Llantas y Neumáticos',
      'Interior / Exterior',
      'Lubricantes y Fluidos',
      'Taller Mecánico',
      'Accesorios Vehiculares',
      'Audio y Sonido',
      'Seguridad Vehicular',
    ].forEach((label) => {
      expect(screen.getByRole('checkbox', { name: label })).toBeInTheDocument();
    });
  });

  it('marca/desmarca valores, guarda en la BD y refresca el perfil', async () => {
    const user = userEvent.setup();
    renderConfig();

    await user.click(await screen.findByRole('checkbox', { name: 'Motos' }));
    await user.click(screen.getByRole('checkbox', { name: 'Frenos' }));
    await user.click(screen.getByRole('checkbox', { name: 'Suspensión' }));
    await user.click(screen.getByRole('button', { name: 'Guardar nichos y líneas' }));

    expect(updateCommerceSegmentation).toHaveBeenCalledWith({
      vehicleTypes: ['carros', 'motos'],
      inventorySystems: ['Motor', 'Suspensión'],
    });
    expect(updateProfile).toHaveBeenCalledWith({
      business: {
        vehicleTypes: ['carros', 'motos'],
        inventorySystems: ['Motor', 'Suspensión'],
      },
    });
    expect(
      await screen.findByText(/Nichos y líneas guardados/i)
    ).toBeInTheDocument();
  });

  it('muestra el error del backend y no actualiza el perfil local', async () => {
    const user = userEvent.setup();
    updateCommerceSegmentation.mockResolvedValue({
      ok: false,
      error: 'No hay un perfil de comercio asociado a esta cuenta.',
    });
    renderConfig();

    await user.click(await screen.findByRole('checkbox', { name: 'Suspensión' }));
    await user.click(screen.getByRole('button', { name: 'Guardar nichos y líneas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No hay un perfil de comercio asociado a esta cuenta.'
    );
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

describe('configuración del tiempo de respuesta del comercio', () => {
  it('carga el SLA guardado y ofrece solo los valores permitidos', async () => {
    renderConfig();

    expect(await screen.findByText('Tiempo de respuesta')).toBeInTheDocument();
    const select = screen.getByLabelText('Tiempo máximo de respuesta');
    expect(select).toHaveValue('15');
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      '5',
      '10',
      '15',
      '20',
      '30',
    ]);
    expect(screen.getByText(/Responde en máx. 15 min/)).toBeInTheDocument();
  });

  it('guarda el nuevo tiempo de respuesta y confirma lo que verán los compradores', async () => {
    const user = userEvent.setup();
    renderConfig();

    const select = await screen.findByLabelText('Tiempo máximo de respuesta');
    await user.selectOptions(select, '30');
    await user.click(screen.getByRole('button', { name: 'Guardar tiempo de respuesta' }));

    expect(updateCommerceMaxResponseMinutes).toHaveBeenCalledWith(30);
    expect(
      await screen.findByText(/ahora respondes en máx. 30 min/i)
    ).toBeInTheDocument();
  });

  it('muestra el error del backend sin cambiar la selección guardada', async () => {
    const user = userEvent.setup();
    updateCommerceMaxResponseMinutes.mockResolvedValue({
      ok: false,
      error: 'No se pudo guardar el tiempo de respuesta.',
    });
    renderConfig();

    await user.selectOptions(
      await screen.findByLabelText('Tiempo máximo de respuesta'),
      '5'
    );
    await user.click(screen.getByRole('button', { name: 'Guardar tiempo de respuesta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo guardar el tiempo de respuesta.'
    );
  });
});
