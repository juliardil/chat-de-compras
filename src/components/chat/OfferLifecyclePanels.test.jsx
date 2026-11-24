import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DeliveryAgreementPanel,
  DeliveryReviewPanel,
  DelayPanel,
  LifecycleBanner,
} from './OfferLifecyclePanels';

const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 60 * 1000).toISOString();

const lifecycle = (state, overrides = {}) => ({
  id: 'thread-1',
  state,
  responseDeadlineAt: future,
  deliveryDeadlineAt: future,
  delayAttempts: 0,
  ...overrides,
});

describe('paneles del ciclo de vida de la oferta', () => {
  it('muestra «Te están atendiendo» al comprador mientras corre el SLA', () => {
    render(<LifecycleBanner lifecycle={lifecycle('ESPERANDO_ACEPTACION')} role="user" />);

    expect(screen.getByText('Te están atendiendo')).toBeInTheDocument();
    expect(screen.getByText(/Plazo límite/)).toBeInTheDocument();
  });

  it('permite acordar un plazo de entrega en horas, días o personalizado', async () => {
    const user = userEvent.setup();
    const onAgree = vi.fn();
    const onCancel = vi.fn();
    render(
      <DeliveryAgreementPanel
        lifecycle={lifecycle('EN_NEGOCIACION')}
        busy={false}
        onAgree={onAgree}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Llegamos a un acuerdo' }));
    expect(onAgree).toHaveBeenCalledWith({ hours: 48, label: '2 días' });

    await user.selectOptions(screen.getByLabelText('Unidad'), 'horas');
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '12');
    await user.click(screen.getByRole('button', { name: 'Llegamos a un acuerdo' }));
    expect(onAgree).toHaveBeenLastCalledWith({ hours: 12, label: '12 horas' });

    await user.click(screen.getByRole('button', { name: 'Cancelar negociación' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('pide al comercio el motivo y el nuevo plazo cuando vence la entrega', async () => {
    const user = userEvent.setup();
    const onReportDelay = vi.fn();
    render(
      <DelayPanel
        lifecycle={lifecycle('EN_ENTREGA', { deliveryDeadlineAt: past })}
        role="commerce"
        busy={false}
        onReportDelay={onReportDelay}
      />
    );

    await user.selectOptions(screen.getByLabelText('Motivo del retraso'), 'Llegó incompleto');
    await user.clear(screen.getByLabelText('Nuevo plazo (horas)'));
    await user.type(screen.getByLabelText('Nuevo plazo (horas)'), '36');
    await user.click(screen.getByRole('button', { name: 'Guardar motivo y nuevo plazo' }));

    expect(onReportDelay).toHaveBeenCalledWith({ reason: 'Llegó incompleto', hours: 36 });
  });

  it('ofrece seguir esperando o cancelar tras el segundo vencimiento', async () => {
    const user = userEvent.setup();
    const onKeepWaiting = vi.fn();
    const onCancelBreach = vi.fn();
    render(
      <DelayPanel
        lifecycle={lifecycle('EN_ENTREGA', { deliveryDeadlineAt: past, delayAttempts: 2 })}
        role="user"
        busy={false}
        onKeepWaiting={onKeepWaiting}
        onCancelBreach={onCancelBreach}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Seguir esperando' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar por incumplimiento' }));

    expect(onKeepWaiting).toHaveBeenCalled();
    expect(onCancelBreach).toHaveBeenCalled();
  });

  it('permite reportar que no llegó el pedido con un motivo rápido', async () => {
    const user = userEvent.setup();
    const onConfirmDelivery = vi.fn();
    const onReportNoDelivery = vi.fn();
    render(
      <DeliveryReviewPanel
        lifecycle={lifecycle('EN_ENTREGA')}
        role="user"
        busy={false}
        onConfirmDelivery={onConfirmDelivery}
        onReportNoDelivery={onReportNoDelivery}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Llegó mi pedido' }));
    await user.selectOptions(
      screen.getByLabelText('Motivo por el que no llegó el pedido'),
      'Llegó dañado'
    );
    await user.click(screen.getByRole('button', { name: 'No llegó mi pedido' }));

    expect(onConfirmDelivery).toHaveBeenCalled();
    expect(onReportNoDelivery).toHaveBeenCalledWith({ reason: 'Llegó dañado' });
  });

  it('reúne estrellas, llegada a tiempo y comentario antes de calificar', async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(
      <DeliveryReviewPanel
        lifecycle={lifecycle('ENTREGA_CONFIRMADA')}
        role="user"
        busy={false}
        onRate={onRate}
      />
    );

    const submit = screen.getByRole('button', { name: 'Enviar calificación' });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '4 estrellas' }));
    await user.click(screen.getByRole('button', { name: 'No' }));
    await user.type(screen.getByLabelText('Comentario de la calificación'), 'Llegó tarde');
    await user.click(submit);

    expect(onRate).toHaveBeenCalledWith({
      rating: 4,
      arrivedOnTime: false,
      comment: 'Llegó tarde',
    });
  });

  it('permite pedir otro vendedor sin volver a capturar los datos de envío', async () => {
    const user = userEvent.setup();
    const onRelease = vi.fn();
    render(
      <DeliveryReviewPanel
        lifecycle={lifecycle('CALIFICADO')}
        role="user"
        busy={false}
        onRelease={onRelease}
      />
    );

    expect(screen.getByText(/Tus datos de envío se conservan/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quiero otro vendedor' }));
    expect(onRelease).toHaveBeenCalled();
  });
});
