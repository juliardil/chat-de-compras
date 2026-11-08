import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD, demoRepository } from './demoRepository';

const loginAs = async (email) => demoRepository.login({ email, password: DEMO_PASSWORD });

const asActor = (permissions) => ({
  memberId: 'test-member',
  name: 'Prueba',
  roleKey: 'test',
  permissions,
});

describe('repositorio de demostración · Fase 3', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('solicitudes', () => {
    it('oculta una solicitud abierta con permiso de moderación y registra auditoría', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const updated = await demoRepository.setRequestStatus({
        requestId: 'demo-request-1',
        status: 'hidden',
        reason: 'Enlaces externos no permitidos',
        reasonCode: 'policy',
        actor: moderator,
      });

      expect(updated).toMatchObject({
        status: 'hidden',
        statusReason: 'Enlaces externos no permitidos',
      });

      const audit = await demoRepository.listAudit({ module: 'Solicitudes' });
      expect(audit[0]).toMatchObject({
        action: 'request.hide',
        entityId: 'demo-request-1',
        reason: 'Enlaces externos no permitidos',
        metadata: { previousStatus: 'open', newStatus: 'hidden', reasonCode: 'policy' },
      });
    });

    it('restaura una solicitud oculta y limpia su motivo de estado', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const updated = await demoRepository.setRequestStatus({
        requestId: 'demo-request-3',
        status: 'open',
        reason: 'Revisión completada',
        reasonCode: 'reviewed',
        actor: moderator,
      });

      expect(updated.status).toBe('open');
      expect(updated.statusReason).toBe('Revisión completada');
    });

    it('rechaza el cambio sin motivo y las transiciones no permitidas', async () => {
      const moderator = await loginAs('moderador@demo.local');

      await expect(
        demoRepository.setRequestStatus({
          requestId: 'demo-request-1',
          status: 'hidden',
          reason: '   ',
          actor: moderator,
        })
      ).rejects.toThrow(/motivo/i);

      await expect(
        demoRepository.setRequestStatus({
          requestId: 'demo-request-4',
          status: 'open',
          reason: 'Reabrir',
          actor: moderator,
        })
      ).rejects.toThrow(/no permitida/i);
    });

    it('niega el cierre a un rol sin requests.close', async () => {
      const analyst = await loginAs('analista@demo.local');

      await expect(
        demoRepository.setRequestStatus({
          requestId: 'demo-request-1',
          status: 'closed',
          reason: 'Intento sin permiso',
          actor: analyst,
        })
      ).rejects.toThrow(/permiso/i);
    });

    it('expone las ofertas de la solicitud solo con offers.view', async () => {
      const moderator = await loginAs('moderador@demo.local');
      const analyst = await loginAs('analista@demo.local');

      const withOffers = await demoRepository.getRequest({
        requestId: 'demo-request-1',
        actor: moderator,
      });
      expect(withOffers.offersRestricted).toBe(false);
      expect(withOffers.offers).toHaveLength(3);

      const withoutOffers = await demoRepository.getRequest({
        requestId: 'demo-request-1',
        actor: { ...analyst, permissions: analyst.permissions.filter((key) => key !== 'offers.view') },
      });
      expect(withoutOffers.offersRestricted).toBe(true);
      expect(withoutOffers.offers).toEqual([]);
    });
  });

  describe('ofertas', () => {
    it('marca una oferta activa como irregular y guarda el autor', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const updated = await demoRepository.setOfferStatus({
        offerId: 'demo-offer-1',
        status: 'flagged',
        reason: 'Precio fuera de rango',
        reasonCode: 'irregular_price',
        actor: moderator,
      });

      expect(updated).toMatchObject({
        status: 'flagged',
        flaggedReason: 'Precio fuera de rango',
        flaggedByName: 'Javier Peña',
      });
      expect(updated.flaggedAt).toBeTruthy();

      const audit = await demoRepository.listAudit({ module: 'Ofertas' });
      expect(audit[0]).toMatchObject({ action: 'offer.flag', entityId: 'demo-offer-1' });
    });

    it('retira la marca de una oferta y limpia los campos de revisión', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const updated = await demoRepository.setOfferStatus({
        offerId: 'demo-offer-2',
        status: 'active',
        reason: 'Marcado por error',
        reasonCode: 'error',
        actor: moderator,
      });

      expect(updated.status).toBe('active');
      expect(updated.flaggedReason).toBeNull();
      expect(updated.flaggedAt).toBeNull();
      expect(updated.flaggedByName).toBeNull();
    });

    it('solo permite la retirada administrativa con offers.withdraw_admin', async () => {
      const moderator = await loginAs('moderador@demo.local');
      const admin = await loginAs('admin@demo.local');

      await expect(
        demoRepository.setOfferStatus({
          offerId: 'demo-offer-4',
          status: 'withdrawn_admin',
          reason: 'Incumplimiento',
          actor: moderator,
        })
      ).rejects.toThrow(/permiso/i);

      const updated = await demoRepository.setOfferStatus({
        offerId: 'demo-offer-4',
        status: 'withdrawn_admin',
        reason: 'Incumplimiento de políticas',
        reasonCode: 'policy',
        actor: admin,
      });

      expect(updated.status).toBe('withdrawn_admin');
      expect(updated.withdrawnAt).toBeTruthy();
    });

    it('rechaza transiciones desde una oferta aceptada', async () => {
      const moderator = await loginAs('moderador@demo.local');

      await expect(
        demoRepository.setOfferStatus({
          offerId: 'demo-offer-3',
          status: 'flagged',
          reason: 'Revisión tardía',
          actor: moderator,
        })
      ).rejects.toThrow(/no permitida/i);

      const offer = await demoRepository.getOffer({
        offerId: 'demo-offer-3',
        actor: moderator,
      });
      expect(offer.status).toBe('accepted');
    });
  });

  describe('pedidos', () => {
    it('avanza un pedido pendiente a confirmado conservando el snapshot de ítems', async () => {
      const admin = await loginAs('admin@demo.local');

      const before = await demoRepository.getOrder({
        orderId: 'demo-order-1',
        actor: admin,
      });

      const updated = await demoRepository.transitionOrder({
        orderId: 'demo-order-1',
        status: 'confirmed',
        reason: 'Confirmación manual autorizada',
        reasonCode: 'manual',
        actor: admin,
      });

      expect(updated.status).toBe('confirmed');
      expect(updated.confirmedAt).toBeTruthy();
      expect(updated.items).toEqual(before.items);
      expect(updated.snapshot).toEqual(before.snapshot);
      expect(updated.timeline.at(-1)).toMatchObject({
        eventType: 'confirmed',
        status: 'confirmed',
        description: 'Confirmación manual autorizada',
      });

      const audit = await demoRepository.listAudit({ module: 'Pedidos' });
      expect(audit[0]).toMatchObject({
        action: 'order.transition',
        entityId: 'demo-order-1',
        metadata: { previousStatus: 'pending', newStatus: 'confirmed' },
      });
    });

    it('niega avanzar pedidos sin orders.transition', async () => {
      const moderator = await loginAs('moderador@demo.local');

      await expect(
        demoRepository.transitionOrder({
          orderId: 'demo-order-1',
          status: 'confirmed',
          reason: 'Intento sin permiso',
          actor: moderator,
        })
      ).rejects.toThrow(/permiso/i);
    });

    it('resuelve una disputa exigiendo una resolución válida', async () => {
      const admin = await loginAs('admin@demo.local');

      await expect(
        demoRepository.transitionOrder({
          orderId: 'demo-order-5',
          status: 'completed',
          reason: 'Resolución sin tipo',
          actor: admin,
        })
      ).rejects.toThrow(/resolución válida/i);

      const updated = await demoRepository.transitionOrder({
        orderId: 'demo-order-5',
        status: 'completed',
        reason: 'Resuelta a favor del comercio',
        reasonCode: 'favor_commerce',
        resolution: 'favor_commerce',
        actor: admin,
      });

      expect(updated.status).toBe('completed');
      expect(updated.hasOpenDispute).toBe(false);
      expect(updated.disputes[0]).toMatchObject({
        status: 'resolved',
        resolution: 'favor_commerce',
        resolvedByName: 'Diego Ramírez',
      });

      const audit = await demoRepository.listAudit({ module: 'Pedidos' });
      expect(audit[0]).toMatchObject({
        action: 'order.resolve_dispute',
        metadata: { previousStatus: 'disputed', newStatus: 'completed', resolution: 'favor_commerce' },
      });
    });

    it('exige orders.cancel para cancelar y deja constancia del motivo', async () => {
      const moderator = await loginAs('moderador@demo.local');
      const admin = await loginAs('admin@demo.local');

      await expect(
        demoRepository.transitionOrder({
          orderId: 'demo-order-2',
          status: 'cancelled',
          reason: 'Sin existencias',
          actor: moderator,
        })
      ).rejects.toThrow(/permiso/i);

      const updated = await demoRepository.transitionOrder({
        orderId: 'demo-order-2',
        status: 'cancelled',
        reason: 'Sin existencias',
        reasonCode: 'out_of_stock',
        actor: admin,
      });

      expect(updated.status).toBe('cancelled');
      expect(updated.cancelledAt).toBeTruthy();
      expect(updated.statusReason).toBe('Sin existencias');
    });

    it('oculta el estado de la entrega cuando falta deliveries.view', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const order = await demoRepository.getOrder({
        orderId: 'demo-order-1',
        actor: moderator,
      });

      expect(order.deliveryRestricted).toBe(true);
      expect(order.delivery).toBeNull();
      expect(order.deliveryStatus).toBeNull();
    });
  });

  describe('entregas', () => {
    it('actualiza el seguimiento con transportista y código', async () => {
      const admin = await loginAs('admin@demo.local');

      const updated = await demoRepository.updateDelivery({
        deliveryId: 'demo-delivery-1',
        status: 'preparing',
        reason: 'Preparación del envío iniciada',
        reasonCode: 'started',
        carrier: 'Transporte Local',
        trackingCode: 'TL-2026-9999',
        actor: admin,
      });

      expect(updated).toMatchObject({
        status: 'preparing',
        carrier: 'Transporte Local',
        trackingCode: 'TL-2026-9999',
      });

      const audit = await demoRepository.listAudit({ module: 'Entregas' });
      expect(audit[0]).toMatchObject({ action: 'delivery.update', entityId: 'demo-delivery-1' });
    });

    it('exige deliveries.confirm para confirmar la recepción', async () => {
      const support = await loginAs('soporte@demo.local');
      const admin = await loginAs('admin@demo.local');

      await expect(
        demoRepository.confirmDelivery({
          deliveryId: 'demo-delivery-3',
          reason: 'Recepción confirmada',
          actor: support,
        })
      ).rejects.toThrow(/permiso/i);

      const updated = await demoRepository.confirmDelivery({
        deliveryId: 'demo-delivery-3',
        reason: 'Recepción confirmada',
        reasonCode: 'received',
        actor: admin,
      });

      expect(updated.status).toBe('delivered');
      expect(updated.deliveredAt).toBeTruthy();
    });

    it('rechaza transiciones de entrega no permitidas', async () => {
      const admin = await loginAs('admin@demo.local');

      await expect(
        demoRepository.updateDelivery({
          deliveryId: 'demo-delivery-1',
          status: 'delivered',
          reason: 'Salto de estado',
          actor: admin,
        })
      ).rejects.toThrow(/no permitida/i);

      const delivery = await demoRepository.getDelivery({
        deliveryId: 'demo-delivery-1',
        actor: admin,
      });
      expect(delivery.status).toBe('pending');
    });

    it('registra y resuelve una incidencia exigiendo motivo', async () => {
      const admin = await loginAs('admin@demo.local');

      await expect(
        demoRepository.reportDeliveryIncident({
          deliveryId: 'demo-delivery-3',
          incidentType: 'delayed',
          description: '   ',
          actor: admin,
        })
      ).rejects.toThrow(/motivo/i);

      await expect(
        demoRepository.reportDeliveryIncident({
          deliveryId: 'demo-delivery-3',
          incidentType: 'unknown_type',
          description: 'Tipo inválido',
          actor: admin,
        })
      ).rejects.toThrow(/tipo de incidencia/i);

      const withIncident = await demoRepository.reportDeliveryIncident({
        deliveryId: 'demo-delivery-3',
        incidentType: 'delayed',
        description: 'Retraso reportado por el comprador',
        actor: admin,
      });

      expect(withIncident.openIncidentCount).toBe(1);
      const incident = withIncident.incidents.find((item) => item.status === 'open');
      expect(incident).toMatchObject({
        incidentType: 'delayed',
        typeLabel: 'Retraso',
        description: 'Retraso reportado por el comprador',
      });

      const resolved = await demoRepository.resolveDeliveryIncident({
        incidentId: incident.id,
        resolutionReason: 'Entrega completada y comprador informado',
        actor: admin,
      });
      expect(resolved.status).toBe('resolved');

      await expect(
        demoRepository.resolveDeliveryIncident({
          incidentId: incident.id,
          resolutionReason: 'Segundo intento',
          actor: admin,
        })
      ).rejects.toThrow(/ya está resuelta/i);
    });

    it('presenta evidencias de demostración como metadatos sin archivo', async () => {
      const admin = await loginAs('admin@demo.local');

      const delivery = await demoRepository.getDelivery({
        deliveryId: 'demo-delivery-5',
        actor: admin,
      });

      expect(delivery.evidence).toHaveLength(1);
      expect(delivery.evidence[0]).toMatchObject({
        evidenceType: 'delivery_note',
        typeLabel: 'Nota de entrega',
        hasFile: false,
      });
      expect(delivery.evidence[0]).not.toHaveProperty('storagePath');

      await expect(demoRepository.getDeliveryEvidenceSignedUrl()).rejects.toThrow(
        /solo metadatos/i
      );
    });

    it('niega el acceso a entregas sin deliveries.view', async () => {
      const moderator = await loginAs('moderador@demo.local');

      await expect(demoRepository.listDeliveries({ actor: moderator })).rejects.toThrow(
        /permiso/i
      );
    });
  });

  describe('métricas de operación', () => {
    it('resume los estados de la semilla para un rol con lectura completa', async () => {
      const analyst = await loginAs('analista@demo.local');
      const metrics = await demoRepository.getMetrics({ actor: analyst });

      expect(metrics).toMatchObject({
        openRequests: 2,
        hiddenRequests: 1,
        expiredRequests: 1,
        closedRequests: 2,
        totalRequests: 7,
        activeOffers: 4,
        flaggedOffers: 1,
        withdrawnOffers: 1,
        totalOffers: 10,
        pendingOrders: 1,
        inProgressOrders: 2,
        disputedOrders: 1,
        completedOrders: 1,
        totalOrders: 6,
        pendingDeliveries: 2,
        inTransitDeliveries: 1,
        failedDeliveries: 1,
        deliveredDeliveries: 2,
        openIncidents: 1,
        totalDeliveries: 6,
      });

      const attentionIds = metrics.attention.map((item) => item.id);
      expect(attentionIds).toEqual(
        expect.arrayContaining(['hiddenRequests', 'flaggedOffers', 'disputedOrders', 'failedDeliveries', 'openIncidents'])
      );
    });

    it('oculta los indicadores de módulos sin permiso de lectura', async () => {
      const metrics = await demoRepository.getMetrics({
        actor: asActor(['orders.view']),
      });

      expect(metrics.totalOrders).toBe(6);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalOffers).toBe(0);
      expect(metrics.totalDeliveries).toBe(0);
      expect(metrics.disputedOrders).toBe(1);

      const attentionIds = metrics.attention.map((item) => item.id);
      expect(attentionIds).toContain('disputedOrders');
      expect(attentionIds).not.toContain('hiddenRequests');
      expect(attentionIds).not.toContain('flaggedOffers');
      expect(attentionIds).not.toContain('openIncidents');
    });
  });
});