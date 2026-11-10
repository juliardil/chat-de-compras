import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD, demoRepository } from './demoRepository';

const loginAs = async (email) => demoRepository.login({ email, password: DEMO_PASSWORD });

const asActor = (permissions) => ({
  memberId: 'test-member',
  name: 'Prueba',
  roleKey: 'test',
  permissions,
});

describe('repositorio de demostración · Fase 5', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('analítica agregada', () => {
    it('calcula el resumen del periodo por defecto con cobros, comisión y pedidos', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const analytics = await demoRepository.getAnalytics({ actor: superadmin });

      expect(analytics.rangeDays).toBe(30);
      expect(analytics.piiIncluded).toBe(false);
      expect(analytics.gatewayConnected).toBe(false);
      expect(analytics.series).toHaveLength(30);
      expect(analytics.series.reduce((total, day) => total + day.gmv, 0)).toBe(623);
      expect(analytics.summary).toMatchObject({
        gmv: 623,
        commissionRevenue: 58.3,
        netToCommerces: 524.7,
        refundedAmount: 40,
        payments: 6,
        collectedPayments: 4,
        orders: 6,
        completedOrders: 1,
        disputedOrders: 1,
        cancelledOrders: 0,
        unreconciledPayments: 1,
      });
    });

    it('respeta el rango seleccionado excluyendo pedidos fuera de la ventana', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const week = await demoRepository.getAnalytics({ range: '7', actor: superadmin });

      expect(week.rangeDays).toBe(7);
      expect(week.series).toHaveLength(7);
      // El pedido completado se colocó hace 8 días: queda fuera de los últimos 7 días.
      expect(week.summary).toMatchObject({
        orders: 5,
        completedOrders: 0,
        disputedOrders: 1,
        collectedPayments: 4,
      });
    });

    it('ordena comercios por GMV y mezcla métodos solo con cobros', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const analytics = await demoRepository.getAnalytics({ actor: superadmin });

      expect(analytics.topCommerces.map((commerce) => commerce.commerceId)).toEqual([
        'demo-commerce-3',
        'demo-commerce-4',
        'demo-commerce-2',
      ]);
      expect(analytics.topCommerces[0]).toMatchObject({ gmv: 280, payments: 2 });

      expect(analytics.methodMix).toHaveLength(3);
      expect(analytics.methodMix[0]).toMatchObject({ method: 'card', amount: 423 });
      expect(analytics.methodMix.map((method) => method.method)).toEqual([
        'card',
        'transfer',
        'cash',
      ]);
    });

    it('exporta un CSV agregado sin datos personales y registra la exportación', async () => {
      const analyst = await loginAs('analista@demo.local');

      const result = await demoRepository.exportAnalytics({ range: '30', actor: analyst });

      expect(result.rangeDays).toBe(30);
      expect(result.filename).toMatch(/^analitica-30d-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(result.csv).toContain('seccion,periodo,comercio,metrica,valor');
      expect(result.csv).toContain('GMV cobrado');
      expect(result.csv).not.toContain('Valentina Rodríguez');

      const audit = await demoRepository.listAudit({ module: 'Analítica' });
      expect(audit[0]).toMatchObject({
        action: 'analytics.export',
        actorRole: 'analyst',
        metadata: { rangeDays: 30, piiIncluded: false, simulated: true },
      });
    });

    it('deniega la analítica y su exportación según permisos', async () => {
      const support = await loginAs('soporte@demo.local');
      const commerceManager = await loginAs('comercios@demo.local');

      await expect(demoRepository.getAnalytics({ actor: support })).rejects.toThrow(/permiso/i);
      await expect(
        demoRepository.exportAnalytics({ actor: commerceManager })
      ).rejects.toThrow(/exportar/i);
    });
  });

  describe('libro interno de pagos', () => {
    it('lista movimientos presentados con pedido, comercio y etiquetas', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const payments = await demoRepository.listPayments({ actor: superadmin });

      expect(payments).toHaveLength(6);
      const pending = payments.find((payment) => payment.id === 'demo-payment-1');
      expect(pending).toMatchObject({
        status: 'pending',
        statusLabel: 'Pendiente',
        methodLabel: 'Tarjeta',
        providerLabel: 'Simulado (demo)',
        orderNumber: 'PED-2026-0101',
        simulated: true,
        reconcilable: false,
        gatewayConnected: false,
      });
    });

    it('filtra por estado y conciliación', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const pending = await demoRepository.listPayments({ status: 'pending', actor: superadmin });
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('demo-payment-1');

      const unreconciled = await demoRepository.listPayments(
        { reconciliation: 'unreconciled', actor: superadmin }
      );
      expect(unreconciled.map((payment) => payment.id)).toEqual(['demo-payment-5']);

      const reconciled = await demoRepository.listPayments(
        { reconciliation: 'reconciled', actor: superadmin }
      );
      expect(reconciled.map((payment) => payment.id).sort()).toEqual([
        'demo-payment-3',
        'demo-payment-4',
        'demo-payment-6',
      ]);
    });

    it('busca por pedido, comercio y referencia', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const byOrder = await demoRepository.listPayments({ search: '0103', actor: superadmin });
      expect(byOrder.map((payment) => payment.id)).toEqual(['demo-payment-3']);

      const byReference = await demoRepository.listPayments({
        search: 'demo-ref-0105',
        actor: superadmin,
      });
      expect(byReference.map((payment) => payment.id)).toEqual(['demo-payment-5']);
    });

    it('devuelve el detalle con pedido y liquidaciones del comercio', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const detail = await demoRepository.getPayment({ paymentId: 'demo-payment-4', actor: superadmin });

      expect(detail.order).toMatchObject({ orderNumber: 'PED-2026-0104', status: 'delivered' });
      expect(detail.payouts.map((payout) => payout.id)).toEqual(['demo-payout-1']);
      expect(detail.payouts[0]).toMatchObject({ commerceId: 'demo-commerce-3', simulated: true });
    });

    it('resume métricas y liquidaciones simuladas sin pasarela', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const metrics = await demoRepository.getPaymentMetrics({ actor: superadmin });
      expect(metrics).toMatchObject({
        totalPayments: 6,
        pendingPayments: 1,
        authorizedPayments: 1,
        refundedPayments: 1,
        unreconciledPayments: 1,
        grossCollected: 623,
        commissionRevenue: 58.3,
        netToCommerces: 524.7,
        refundedAmount: 40,
        pendingPayouts: 2,
        paidPayouts: 1,
        totalPayouts: 3,
        gatewayConnected: false,
      });

      const payouts = await demoRepository.listPaymentPayouts({ actor: superadmin });
      expect(payouts).toHaveLength(3);
      const scheduled = await demoRepository.listPaymentPayouts({ status: 'scheduled', actor: superadmin });
      expect(scheduled.map((payout) => payout.id)).toEqual(['demo-payout-2']);
    });

    it('deniega el libro de pagos a un rol sin payments.view', async () => {
      const moderator = await loginAs('moderador@demo.local');

      await expect(demoRepository.listPayments({ actor: moderator })).rejects.toThrow(/permiso/i);
      await expect(demoRepository.getPaymentMetrics({ actor: moderator })).rejects.toThrow(/permiso/i);
    });
  });

  describe('conciliación manual', () => {
    it('concilia un movimiento cobrado con motivo y auditoría', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const reconciled = await demoRepository.reconcilePayment({
        paymentId: 'demo-payment-5',
        reconciled: true,
        reason: 'Coincide con el extracto bancario',
        reasonCode: 'statement_match',
        actor: superadmin,
      });

      expect(reconciled).toMatchObject({
        reconciled: true,
        reconciledByName: 'Ana Torres',
        reconcilable: true,
      });
      expect(reconciled.reconciledAt).toBeTruthy();

      const audit = await demoRepository.listAudit({ module: 'Pagos' });
      expect(audit[0]).toMatchObject({
        action: 'payment.reconcile',
        entityId: 'demo-payment-5',
        actorName: 'Ana Torres',
        reason: 'Coincide con el extracto bancario',
        metadata: {
          reconciled: true,
          previousReconciled: false,
          reasonCode: 'statement_match',
          simulated: true,
        },
      });
    });

    it('retira la conciliación y limpia la marca', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const reverted = await demoRepository.reconcilePayment({
        paymentId: 'demo-payment-3',
        reconciled: false,
        reason: 'Corrección de registro interno',
        reasonCode: 'correction',
        actor: superadmin,
      });

      expect(reverted.reconciled).toBe(false);
      expect(reverted.reconciledAt).toBeNull();
      expect(reverted.reconciledByName).toBeNull();

      const audit = await demoRepository.listAudit({ module: 'Pagos' });
      expect(audit[0].metadata).toMatchObject({ reconciled: false, previousReconciled: true });
    });

    it('rechaza movimientos no conciliables, motivos vacíos y actores sin permiso', async () => {
      const superadmin = await loginAs('superadmin@demo.local');
      const analyst = await loginAs('analista@demo.local');

      await expect(
        demoRepository.reconcilePayment({
          paymentId: 'demo-payment-1',
          reconciled: true,
          reason: 'Intento sobre pago pendiente',
          actor: superadmin,
        })
      ).rejects.toThrow(/solo se pueden conciliar/i);

      await expect(
        demoRepository.reconcilePayment({
          paymentId: 'demo-payment-5',
          reconciled: true,
          reason: '   ',
          actor: superadmin,
        })
      ).rejects.toThrow(/motivo/i);

      await expect(
        demoRepository.reconcilePayment({
          paymentId: 'demo-payment-5',
          reconciled: true,
          reason: 'Intento sin permiso',
          actor: analyst,
        })
      ).rejects.toThrow(/permiso/i);
    });
  });

  describe('exportación de auditoría', () => {
    it('exporta los eventos filtrados y audita la propia exportación', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const result = await demoRepository.exportAudit({
        module: 'Pagos',
        actor: superadmin,
      });

      expect(result.filename).toMatch(/^auditoria-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(result.csv).toContain('fecha,actor,rol,accion,modulo,entidad,entidad_id,motivo,metadata');
      expect(result.csv).toContain('payment.reconcile');
      expect(result.count).toBeGreaterThan(0);

      const audit = await demoRepository.listAudit({ module: 'Auditoría' });
      expect(audit[0]).toMatchObject({
        action: 'audit.export',
        metadata: { moduleFilter: 'Pagos', simulated: true },
      });
    });

    it('respeta la búsqueda y deniega sin audit.export', async () => {
      const superadmin = await loginAs('superadmin@demo.local');
      const analyst = await loginAs('analista@demo.local');

      const result = await demoRepository.exportAudit({
        search: 'payment.reconcile',
        actor: superadmin,
      });
      expect(result.count).toBeGreaterThan(0);
      expect(result.csv).toContain('payment.reconcile');
      expect(result.csv).not.toContain('staff.invite');

      await expect(demoRepository.exportAudit({ actor: analyst })).rejects.toThrow(/exportar/i);
    });
  });

  describe('búsqueda global', () => {
    it('exige longitud mínima y devuelve metadatos por tipo', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const empty = await demoRepository.globalSearch({ query: 'p', actor: superadmin });
      expect(empty).toMatchObject({ results: [], total: 0, truncated: false, minLength: 2 });

      const results = await demoRepository.globalSearch({
        query: 'PED-2026-0103',
        actor: superadmin,
      });
      expect(results.total).toBeGreaterThan(0);
      expect(results.results.some((result) => result.type === 'order')).toBe(true);
      expect(results.results.some((result) => result.type === 'chat')).toBe(true);
      expect(
        results.results.every((result) => result.typeLabel && result.path && result.title)
      ).toBe(true);
    });

    it('enmascara el correo de compradores para actores sin users.view_pii', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const results = await demoRepository.globalSearch({
        query: 'Valentina',
        actor: moderator,
      });

      const buyer = results.results.find((result) => result.type === 'buyer');
      expect(buyer).toBeTruthy();
      expect(buyer.subtitle).not.toContain('valentina.rodriguez@demo.local');
    });

    it('solo devuelve tipos permitidos por los permisos del actor', async () => {
      const analyst = await loginAs('analista@demo.local');

      const results = await demoRepository.globalSearch({
        query: 'PED-2026-0103',
        actor: analyst,
      });

      const types = new Set(results.results.map((result) => result.type));
      expect(types.has('order')).toBe(true);
      expect(types.has('chat')).toBe(false);
      expect(types.has('ticket')).toBe(false);
    });

    it('no requiere permisos para las secciones de navegación, pero sí para entidades', async () => {
      const actorWithoutPermissions = asActor(['dashboard.view']);

      const results = await demoRepository.globalSearch({
        query: 'PED-2026-0103',
        actor: actorWithoutPermissions,
      });

      expect(results.total).toBe(0);
    });
  });

  describe('métricas del panel', () => {
    it('incluye pagos y avisos de la Fase 5 respetando permisos', async () => {
      const superadmin = await loginAs('superadmin@demo.local');

      const metrics = await demoRepository.getMetrics({ actor: superadmin });
      expect(metrics).toMatchObject({
        totalPayments: 6,
        unreconciledPayments: 1,
        grossCollected: 623,
        commissionRevenue: 58.3,
        refundedAmount: 40,
        pendingPayouts: 2,
        totalPayouts: 3,
        paymentGatewayConnected: false,
      });

      const attentionIds = metrics.attention.map((item) => item.id);
      expect(attentionIds).toContain('unreconciledPayments');
      expect(attentionIds).toContain('pendingPayouts');

      const moderator = await loginAs('moderador@demo.local');
      const moderatorMetrics = await demoRepository.getMetrics({ actor: moderator });
      expect(moderatorMetrics.totalPayments).toBe(0);
      expect(moderatorMetrics.attention.map((item) => item.id)).not.toContain('unreconciledPayments');
    });
  });
});
