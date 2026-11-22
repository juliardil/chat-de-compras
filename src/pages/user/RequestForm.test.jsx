import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RequestForm from './RequestForm';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchBuyerProfileId: vi.fn(),
    createPurchaseRequest: vi.fn(),
  };
});

import { createPurchaseRequest, fetchBuyerProfileId } from '../../data/appData';

vi.mock('../../data/workshop', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchMyWorkshop: vi.fn(),
  };
});

import { fetchMyWorkshop } from '../../data/workshop';

const renderForm = () =>
  render(
    <AuthContext.Provider value={{ user: { id: 'user-1', role: 'user' } }}>
      <MemoryRouter initialEntries={['/request']}>
        <Routes>
          <Route path="/request" element={<RequestForm />} />
          <Route path="/request-success" element={<div>Confirmación de publicación</div>} />
          <Route path="/responses" element={<div>Pantalla de respuestas</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

const fillMinimumFields = async () => {
  const selects = screen.getAllByRole('combobox');
  await userEvent.selectOptions(selects[0], 'Frenos');
  await userEvent.type(
    screen.getByPlaceholderText('Ej: Pastillas de freno, filtro de aceite, batería'),
    'Pastillas de freno'
  );
  await userEvent.selectOptions(selects[1], 'Auto');
};

describe('publicación de una solicitud', () => {
  beforeEach(() => {
    fetchBuyerProfileId.mockReset();
    createPurchaseRequest.mockReset();
    fetchMyWorkshop.mockReset();
    fetchBuyerProfileId.mockResolvedValue({
      item: { id: 'buyer-1' },
      error: null,
      notice: null,
    });
    fetchMyWorkshop.mockResolvedValue({ items: [], error: null, notice: null });
  });

  it('muestra la confirmación solo cuando la solicitud se guardó correctamente', async () => {
    createPurchaseRequest.mockResolvedValue({
      ok: true,
      data: [{ id: 'req-1' }],
      error: null,
    });

    renderForm();
    await fillMinimumFields();
    await userEvent.click(screen.getByRole('button', { name: /enviar solicitud automotriz/i }));

    expect(await screen.findByText('Confirmación de publicación')).toBeInTheDocument();
    expect(createPurchaseRequest).toHaveBeenCalledTimes(1);
    expect(createPurchaseRequest.mock.calls[0][0]).toMatchObject({
      buyer_id: 'buyer-1',
      title: 'Pastillas de freno',
      category: 'Frenos',
      vehicle_type: 'Auto',
      status: 'open',
    });
  });

  it('no muestra la confirmación si la publicación falla', async () => {
    createPurchaseRequest.mockResolvedValue({
      ok: false,
      data: null,
      error: 'No se pudo publicar la solicitud.',
    });

    renderForm();
    await fillMinimumFields();
    await userEvent.click(screen.getByRole('button', { name: /enviar solicitud automotriz/i }));

    expect(await screen.findByText('Pantalla de respuestas')).toBeInTheDocument();
    expect(screen.queryByText('Confirmación de publicación')).not.toBeInTheDocument();
  });

  it('conserva la cantidad solicitada en el payload de la solicitud', async () => {
    createPurchaseRequest.mockResolvedValue({
      ok: true,
      data: [{ id: 'req-1' }],
      error: null,
    });

    renderForm();
    await fillMinimumFields();

    const quantity = screen.getByPlaceholderText('Ej: 1');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '4');

    await userEvent.click(screen.getByRole('button', { name: /enviar solicitud automotriz/i }));

    expect(await screen.findByText('Confirmación de publicación')).toBeInTheDocument();
    expect(createPurchaseRequest).toHaveBeenCalledTimes(1);

    const payload = createPurchaseRequest.mock.calls[0][0];
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      item: 'Pastillas de freno',
      quantity: 4,
      images: [],
    });
  });

  it('no muestra la confirmación si el comprador no tiene perfil en el backend', async () => {
    fetchBuyerProfileId.mockResolvedValue({
      item: null,
      error: null,
      notice: 'Tu cuenta todavía no tiene un perfil de comprador en el backend.',
    });

    renderForm();
    await fillMinimumFields();
    await userEvent.click(screen.getByRole('button', { name: /enviar solicitud automotriz/i }));

    expect(await screen.findByText('Pantalla de respuestas')).toBeInTheDocument();
    expect(createPurchaseRequest).not.toHaveBeenCalled();
  });

  it('publica un trabajo de servicio con falla, zona y placa', async () => {
    createPurchaseRequest.mockResolvedValue({
      ok: true,
      data: [{ id: 'req-service' }],
      error: null,
    });

    renderForm();
    await userEvent.click(
      await screen.findByRole('button', { name: /quién me lo instala \/ repara/i })
    );

    expect(screen.getByText('Solicitud de servicio')).toBeInTheDocument();
    await userEvent.type(
      screen.getByPlaceholderText(/el vehículo hace ruido al frenar/i),
      'Ruido al frenar, requiero cambiar pastillas'
    );
    await userEvent.type(
      screen.getByPlaceholderText(/centro, ciudad de méxico/i),
      'Centro'
    );
    await userEvent.type(screen.getByPlaceholderText(/abc1234/i), 'abc123');

    // La descripción sugiere Frenos; el selector queda visible y editable.
    expect(screen.getByRole('combobox', { name: 'Especialidad requerida' })).toHaveValue('Frenos');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Modalidad de atención' }),
      'Servicio a domicilio'
    );

    await userEvent.click(
      screen.getByRole('button', { name: /publicar trabajo para talleres/i })
    );

    expect(await screen.findByText('Confirmación de publicación')).toBeInTheDocument();
    expect(createPurchaseRequest).toHaveBeenCalledTimes(1);
    expect(createPurchaseRequest.mock.calls[0][0]).toMatchObject({
      request_type: 'service',
      specialty: 'Frenos',
      service_modality: 'Servicio a domicilio',
      title: 'Instalación / reparación: Frenos',
      service_zone: 'Centro',
      vehicle_plate: 'ABC123',
      status: 'open',
    });
  });

  it('no renderiza el bloque de producto en modo servicio', async () => {
    renderForm();
    await userEvent.click(
      await screen.findByRole('button', { name: /quién me lo instala \/ repara/i })
    );

    expect(screen.getByText('Solicitud de servicio')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Especialidad requerida' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Modalidad de atención' })).toBeInTheDocument();
    expect(screen.queryByText('Producto Automotriz')).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Ej: Pastillas de freno, filtro de aceite, batería')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agregar otro producto/i })).not.toBeInTheDocument();
  });

  it('bloquea la publicación sin especialidad y explica por qué', async () => {
    renderForm();
    await userEvent.click(
      await screen.findByRole('button', { name: /quién me lo instala \/ repara/i })
    );
    await userEvent.type(
      screen.getByPlaceholderText(/el vehículo hace ruido al frenar/i),
      'Revisar el vehículo en general'
    );

    await userEvent.click(
      screen.getByRole('button', { name: /publicar trabajo para talleres/i })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/elegir la especialidad requerida/i);
    expect(createPurchaseRequest).not.toHaveBeenCalled();
    expect(fetchBuyerProfileId).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirmación de publicación')).not.toBeInTheDocument();
  });

  it('bloquea la publicación si falta la modalidad de atención', async () => {
    renderForm();
    await userEvent.click(
      await screen.findByRole('button', { name: /quién me lo instala \/ repara/i })
    );
    await userEvent.type(
      screen.getByPlaceholderText(/el vehículo hace ruido al frenar/i),
      'Ruido al frenar'
    );
    expect(screen.getByRole('combobox', { name: 'Especialidad requerida' })).toHaveValue('Frenos');

    await userEvent.click(
      screen.getByRole('button', { name: /publicar trabajo para talleres/i })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/elegir la modalidad de atención/i);
    expect(createPurchaseRequest).not.toHaveBeenCalled();
    expect(fetchBuyerProfileId).not.toHaveBeenCalled();
  });

  it('no adivina la especialidad cuando la descripción menciona varias', async () => {
    renderForm();
    await userEvent.click(
      await screen.findByRole('button', { name: /quién me lo instala \/ repara/i })
    );
    await userEvent.type(
      screen.getByPlaceholderText(/el vehículo hace ruido al frenar/i),
      'Ruido al frenar y también revisar la suspensión'
    );

    expect(screen.getByText(/detectamos varias especialidades posibles/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Especialidad requerida' })).toHaveValue('');

    await userEvent.click(
      screen.getByRole('button', { name: /publicar trabajo para talleres/i })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/elegir la especialidad requerida/i);
    expect(createPurchaseRequest).not.toHaveBeenCalled();
  });

  it('respeta el cambio manual aunque la descripción siga sugiriendo otra especialidad', async () => {
    createPurchaseRequest.mockResolvedValue({
      ok: true,
      data: [{ id: 'req-service-2' }],
      error: null,
    });

    renderForm();
    await userEvent.click(
      await screen.findByRole('button', { name: /quién me lo instala \/ repara/i })
    );
    const description = screen.getByPlaceholderText(/el vehículo hace ruido al frenar/i);
    await userEvent.type(description, 'Ruido al frenar');

    const specialty = screen.getByRole('combobox', { name: 'Especialidad requerida' });
    expect(specialty).toHaveValue('Frenos');
    await userEvent.selectOptions(specialty, 'Electricidad');
    await userEvent.type(description, ' y revisar discos');

    expect(specialty).toHaveValue('Electricidad');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Modalidad de atención' }),
      'Visita al taller'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /publicar trabajo para talleres/i })
    );

    expect(await screen.findByText('Confirmación de publicación')).toBeInTheDocument();
    expect(createPurchaseRequest.mock.calls[0][0]).toMatchObject({
      request_type: 'service',
      specialty: 'Electricidad',
      service_modality: 'Visita al taller',
    });
  });

  it('muestra la insignia B2B y permite placa opcional al taller verificado', async () => {
    fetchMyWorkshop.mockResolvedValue({
      items: [{ id: 'w-1', is_verified: true }],
      error: null,
      notice: null,
    });

    renderForm();

    expect(await screen.findByText(/taller verificado • prioridad b2b/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/abc1234/i)).toBeInTheDocument();
  });

  it('simplifica el año y conserva marca, modelo, sugerencias, instalación y referencia', async () => {
    createPurchaseRequest.mockResolvedValue({
      ok: true,
      data: [{ id: 'req-3' }],
      error: null,
    });

    renderForm();

    await userEvent.selectOptions(await screen.findByLabelText('Año del vehículo'), '2018');
    await userEvent.click(screen.getByRole('button', { name: 'Batería' }));
    expect(
      screen.getByPlaceholderText('Ej: Pastillas de freno, filtro de aceite, batería')
    ).toHaveValue('Batería');

    await userEvent.type(screen.getByPlaceholderText('Ej: Toyota, Ford, Honda'), 'Toyota');
    await userEvent.type(screen.getByPlaceholderText('Ej: Corolla, Fiesta, Civic'), 'Corolla');
    await userEvent.click(screen.getByRole('button', { name: 'Sí' }));

    expect(screen.queryByPlaceholderText('Ej: 04465-02060')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /detalles avanzados y referencia/i })
    );
    await userEvent.type(screen.getByPlaceholderText('Ej: 04465-02060'), 'REF-9');

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[0], 'Frenos');
    await userEvent.selectOptions(selects[1], 'Auto');

    await userEvent.click(screen.getByRole('button', { name: /enviar solicitud automotriz/i }));

    expect(await screen.findByText('Confirmación de publicación')).toBeInTheDocument();
    const item = createPurchaseRequest.mock.calls[0][0].items[0];
    expect(item).toMatchObject({
      item: 'Batería',
      yearFrom: '2018',
      yearTo: '2018',
      vehicleBrand: 'Toyota',
      vehicleModel: 'Corolla',
      installation: 'Sí',
      reference: 'REF-9',
    });
  });
});

describe('solicitudes con «Recomiéndame»', () => {
  beforeEach(() => {
    fetchBuyerProfileId.mockReset();
    createPurchaseRequest.mockReset();
    fetchMyWorkshop.mockReset();
    fetchBuyerProfileId.mockResolvedValue({
      item: { id: 'buyer-1' },
      error: null,
      notice: null,
    });
    fetchMyWorkshop.mockResolvedValue({ items: [], error: null, notice: null });
    createPurchaseRequest.mockResolvedValue({
      ok: true,
      data: [{ id: 'req-rec' }],
      error: null,
    });
  });

  const activateRecommendation = async () => {
    renderForm();
    await userEvent.click(await screen.findByRole('button', { name: /recomiéndame/i }));
  };

  const fillRecommendation = async ({
    vehicle = 'Carro',
    category = 'Eléctrico',
    product = 'Batería',
    budget = '1500',
    preferences = 'Talla YTX9-BS',
    brand = '',
    model = '',
  } = {}) => {
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo de vehículo para recomendaciones' }),
      vehicle
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Línea o categoría para recomendaciones' }),
      category
    );
    if (brand) {
      await userEvent.type(screen.getByLabelText(/marca \(opcional\)/i), brand);
    }
    if (model) {
      await userEvent.type(screen.getByLabelText(/modelo \(opcional\)/i), model);
    }
    await userEvent.type(screen.getByLabelText(/qué producto buscas/i), product);
    await userEvent.type(screen.getByLabelText(/presupuesto aproximado/i), budget);
    if (preferences) {
      await userEvent.type(screen.getByLabelText(/preferencias o talla/i), preferences);
    }
  };

  it('muestra el selector dentro de la tarjeta de producto y activa el modo recomendación', async () => {
    renderForm();

    const card = await screen.findByTestId('product-card');
    expect(within(card).getByText('Producto Automotriz')).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: /busco algo específico/i })
    ).toHaveAttribute('aria-pressed', 'true');
    const recommendButton = within(card).getByRole('button', { name: /recomiéndame/i });
    expect(recommendButton).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(recommendButton);

    expect(screen.getByText('Pide recomendaciones')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Tipo de vehículo para recomendaciones' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Línea o categoría para recomendaciones' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/qué producto buscas/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/presupuesto aproximado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preferencias o talla/i)).toBeInTheDocument();

    expect(screen.getByLabelText(/marca \(opcional\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/modelo \(opcional\)/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/año \(opcional\)/i)).not.toBeInTheDocument();

    expect(screen.queryByTestId('product-card')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Ej: 04465-02060')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Año del vehículo')).not.toBeInTheDocument();
  });

  it('oculta la referencia exacta y pide solo los datos de asesoría', async () => {
    await activateRecommendation();

    expect(screen.getByText('Pide recomendaciones')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Tipo de vehículo para recomendaciones' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Línea o categoría para recomendaciones' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/qué producto buscas/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/presupuesto aproximado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preferencias o talla/i)).toBeInTheDocument();

    expect(
      screen.queryByPlaceholderText('Ej: Pastillas de freno, filtro de aceite, batería')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Producto Automotriz')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Año del vehículo')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /agregar otro producto/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /enviar solicitud automotriz/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /pedir recomendaciones/i })
    ).toBeInTheDocument();
  });

  it('publica la recomendación con Carro mapeado a Auto y sin datos inventados', async () => {
    await activateRecommendation();
    await fillRecommendation();

    await userEvent.click(screen.getByRole('button', { name: /pedir recomendaciones/i }));

    expect(await screen.findByText('Confirmación de publicación')).toBeInTheDocument();
    expect(createPurchaseRequest).toHaveBeenCalledTimes(1);

    const payload = createPurchaseRequest.mock.calls[0][0];
    expect(payload).toMatchObject({
      buyer_id: 'buyer-1',
      title: 'Batería',
      description: 'Talla YTX9-BS',
      category: 'Eléctrico',
      vehicle_type: 'Auto',
      is_recommendation: true,
      budget: 1500,
      budget_amount: 1500,
      preferences: 'Talla YTX9-BS',
      status: 'open',
    });
    expect(payload.items).toEqual([
      {
        category: 'Eléctrico',
        item: 'Batería',
        vehicleType: 'Auto',
        quantity: 1,
        images: [],
        notes: 'Talla YTX9-BS',
        is_recommendation: true,
      },
    ]);
    expect(payload.items[0]).not.toHaveProperty('reference');
    expect(payload.items[0]).not.toHaveProperty('vehicleBrand');
  });

  it('envía marca y modelo opcionales del vehículo cuando se completan', async () => {
    await activateRecommendation();
    await fillRecommendation({
      brand: 'Toyota',
      model: 'Corolla',
    });

    expect(
      screen.getByText(
        'Tu solicitud llegará solo a los comercios registrados en ese tipo de vehículo y línea. Puedes indicar marca y modelo opcionalmente para mayor precisión.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/número de referencia/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /pedir recomendaciones/i }));

    expect(await screen.findByText('Confirmación de publicación')).toBeInTheDocument();
    const payload = createPurchaseRequest.mock.calls[0][0];
    expect(payload).toMatchObject({
      brand: 'Toyota',
      model: 'Corolla',
      is_recommendation: true,
    });
    expect(payload).not.toHaveProperty('year');
    expect(payload.items[0]).toMatchObject({
      brand: 'Toyota',
      vehicleBrand: 'Toyota',
      model: 'Corolla',
      vehicleModel: 'Corolla',
    });
    expect(payload.items[0]).not.toHaveProperty('year');
    expect(payload.items[0]).not.toHaveProperty('reference');
  });

  it('conserva Moto y la línea elegida en el payload', async () => {
    await activateRecommendation();
    await fillRecommendation({
      vehicle: 'Moto',
      category: 'Accesorios Vehiculares',
      product: 'Casco',
    });

    await userEvent.click(screen.getByRole('button', { name: /pedir recomendaciones/i }));

    expect(await screen.findByText('Confirmación de publicación')).toBeInTheDocument();
    expect(createPurchaseRequest.mock.calls[0][0]).toMatchObject({
      vehicle_type: 'Moto',
      category: 'Accesorios Vehiculares',
      title: 'Casco',
    });
  });

  it('bloquea el envío si faltan campos obligatorios', async () => {
    await activateRecommendation();
    await userEvent.click(screen.getByRole('button', { name: /pedir recomendaciones/i }));

    expect(screen.getAllByText('Este campo es obligatorio.').length).toBeGreaterThan(0);
    expect(screen.getByText('Escribe un presupuesto aproximado válido.')).toBeInTheDocument();
    expect(createPurchaseRequest).not.toHaveBeenCalled();
    expect(fetchBuyerProfileId).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirmación de publicación')).not.toBeInTheDocument();
  });
});
