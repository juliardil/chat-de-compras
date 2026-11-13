import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import RequestSuccess from './RequestSuccess';

const renderSuccess = (products = [{ item: 'Pastillas de freno' }]) =>
  render(
    <MemoryRouter
      initialEntries={[{ pathname: '/request-success', state: { requestId: 'req-1', products } }]}
    >
      <Routes>
        <Route path="/request-success" element={<RequestSuccess />} />
        <Route path="/categories" element={<div>Buscador de productos</div>} />
        <Route path="/offers" element={<div>Bandeja de ofertas</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('confirmación de solicitud publicada', () => {
  it('muestra el mensaje completo solo con los datos reales de la publicación', () => {
    renderSuccess();

    expect(screen.getByRole('heading', { name: '¡Tu solicitud está en camino!' })).toBeInTheDocument();
    expect(screen.getByText('Los comercios están revisando tu pedido.')).toBeInTheDocument();
    expect(
      screen.getByText(/Pronto podrás recibir sus propuestas\. Mantente pendiente de tu bandeja de Ofertas/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText('Entra en la sección Ofertas y consulta las propuestas que recibas.')
    ).toBeInTheDocument();
    expect(screen.getByText('Publicaste: Pastillas de freno')).toBeInTheDocument();
  });

  it('lleva al buscador existente al pulsar Buscar otro producto', async () => {
    renderSuccess();

    await userEvent.click(screen.getByRole('button', { name: /buscar otro producto/i }));

    expect(await screen.findByText('Buscador de productos')).toBeInTheDocument();
  });

  it('permite consultar las ofertas desde la confirmación', async () => {
    renderSuccess();

    await userEvent.click(screen.getByRole('button', { name: /ver mis ofertas/i }));

    expect(await screen.findByText('Bandeja de ofertas')).toBeInTheDocument();
  });
});
