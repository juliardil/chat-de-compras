import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Inventory from './Inventory';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../data/businessInventory', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchMyInventory: vi.fn(),
    fetchInventorySource: vi.fn(),
    saveInventorySource: vi.fn(),
    syncInventory: vi.fn(),
    setInventoryPhoto: vi.fn(),
    setInventoryGroup: vi.fn(),
    setInventoryAlternatives: vi.fn(),
    uploadInventoryPhoto: vi.fn(),
  };
});

import {
  fetchInventorySource,
  fetchMyInventory,
  setInventoryAlternatives,
  setInventoryGroup,
  setInventoryPhoto,
} from '../../data/businessInventory';

const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

const inventoryRow = {
  id: 'inv-1',
  name: 'Bafles Sony',
  sku: 'REF-1',
  brand: 'Sony',
  category: 'Audio y Sonido',
  price: '250',
  currency: 'MXN',
  stock: '5',
  photo_url: 'https://cdn.example.com/bafles.jpg',
  bonus: 'Instalación gratis',
  equivalence_group: 'audio',
  valid_until: futureDate,
  is_active: true,
  alternatives: [{ id: 'alt-1', brand: 'Pioneer', price: 240 }],
};

const renderInventory = () =>
  render(
    <AuthContext.Provider value={{ user: { id: 'user-1', role: 'commerce' } }}>
      <MemoryRouter initialEntries={['/inventory']}>
        <Inventory />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('Mi Inventario', () => {
  beforeEach(() => {
    fetchMyInventory.mockReset();
    fetchInventorySource.mockReset();
    setInventoryPhoto.mockReset();
    setInventoryGroup.mockReset();
    setInventoryAlternatives.mockReset();

    fetchMyInventory.mockResolvedValue({
      items: [inventoryRow],
      error: null,
      notice: null,
    });
    fetchInventorySource.mockResolvedValue({ items: [], error: null, notice: null });
    setInventoryGroup.mockResolvedValue({ ok: true, data: null, error: null });
    setInventoryAlternatives.mockResolvedValue({ ok: true, data: null, error: null });
  });

  it('muestra precio, stock, vigencia, bono, foto y alternativas', async () => {
    renderInventory();

    expect(await screen.findByRole('heading', { name: /mi inventario/i })).toBeInTheDocument();
    expect(await screen.findByText('Bafles Sony')).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
    expect(screen.getByText('5 en stock')).toBeInTheDocument();
    expect(screen.getByText('Vigente')).toBeInTheDocument();
    expect(screen.getByText('Bono: Instalación gratis')).toBeInTheDocument();
    expect(screen.getByAltText('Foto de Bafles Sony')).toBeInTheDocument();
    expect(screen.getByText(/Alternativas: Pioneer/)).toBeInTheDocument();
  });

  it('muestra un estado vacío explícito cuando no hay productos', async () => {
    fetchMyInventory.mockResolvedValue({ items: [], error: null, notice: null });

    renderInventory();

    expect(await screen.findByText('Tu inventario está vacío')).toBeInTheDocument();
    expect(
      screen.getByText(/conecta un archivo o un enlace de google sheets/i)
    ).toBeInTheDocument();
  });

  it('permite guardar el grupo de equivalencia y las alternativas de un producto', async () => {
    renderInventory();

    await screen.findByText('Bafles Sony');
    await userEvent.click(
      screen.getByRole('button', { name: /foto, equivalencia y alternativas/i })
    );

    const groupInput = screen.getByPlaceholderText(/pastillas delanteras corolla/i);
    await userEvent.clear(groupInput);
    await userEvent.type(groupInput, 'audio-premium');
    await userEvent.click(screen.getByRole('button', { name: /guardar grupo/i }));

    expect(setInventoryGroup).toHaveBeenCalledWith('inv-1', 'audio-premium');

    const alternativesInput = screen.getByPlaceholderText(/bosch:450, monroe:520/i);
    await userEvent.clear(alternativesInput);
    await userEvent.type(alternativesInput, 'Pioneer:240, Sony:260');
    await userEvent.click(screen.getByRole('button', { name: /guardar alternativas/i }));

    expect(setInventoryAlternatives).toHaveBeenCalledWith('inv-1', [
      { id: 'alt-1', brand: 'Pioneer', price: '240' },
      { id: 'alt-2', brand: 'Sony', price: '260' },
    ]);
  });
});
