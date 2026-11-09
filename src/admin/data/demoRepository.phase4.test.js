import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD, demoRepository } from './demoRepository';

const loginAs = async (email) => demoRepository.login({ email, password: DEMO_PASSWORD });

const asActor = (permissions) => ({
  memberId: 'test-member',
  name: 'Prueba',
  roleKey: 'test',
  permissions,
});

const hoursFromNow = (isoDate) => (new Date(isoDate).getTime() - Date.now()) / (60 * 60 * 1000);

describe('repositorio de demostración · Fase 4', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('chats y acceso excepcional', () => {
    it('expone solo metadatos y marca el contenido legible según la autorización del actor', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const chats = await demoRepository.listChats({ actor: moderator });

      expect(chats).toHaveLength(5);
      expect(chats[0]).not.toHaveProperty('messages');
      expect(chats[0]).toHaveProperty('messageCount');

      const readable = chats.filter((chat) => chat.canReadContent);
      expect(readable.map((chat) => chat.id)).toEqual(['demo-chat-2']);
      expect(readable[0].activeAccessRequestId).toBe('demo-chat-access-1');
    });

    it('audita cada lectura de contenido autorizada', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const content = await demoRepository.readChatContent({
        chatId: 'demo-chat-2',
        actor: moderator,
      });

      expect(content.simulated).toBe(true);
      expect(content.messages).toHaveLength(8);
      expect(content.accessRequestId).toBe('demo-chat-access-1');

      const audit = await demoRepository.listAudit({ module: 'Chats' });
      expect(audit[0]).toMatchObject({
        action: 'chat.content.read',
        entityId: 'demo-chat-2',
        metadata: {
          accessRequestId: 'demo-chat-access-1',
          messageCount: 8,
          result: 'granted',
        },
      });
    });

    it('niega la lectura sin autorización aprobada y vigente', async () => {
      const moderator = await loginAs('moderador@demo.local');

      await expect(
        demoRepository.readChatContent({ chatId: 'demo-chat-1', actor: moderator })
      ).rejects.toThrow(/aprobada y vigente/i);
    });

    it('solicita, aprueba con vigencia limitada y permite leer el contenido', async () => {
      const moderator = await loginAs('moderador@demo.local');
      const superadmin = await loginAs('superadmin@demo.local');

      const request = await demoRepository.requestChatAccess({
        chatId: 'demo-chat-3',
        reason: 'Revisión puntual de una reseña del pedido',
        reasonCode: 'moderation_review',
        actor: moderator,
      });

      expect(request).toMatchObject({ status: 'pending', effectiveStatus: 'pending' });

      const approved = await demoRepository.decideChatAccess({
        accessRequestId: request.id,
        decision: 'approved',
        reason: 'Motivo justificado',
        reasonCode: 'justified',
        expiresInHours: 500,
        actor: superadmin,
      });

      expect(approved.status).toBe('approved');
      expect(approved.effectiveStatus).toBe('approved');
      expect(hoursFromNow(approved.expiresAt)).toBeLessThanOrEqual(168);
      expect(hoursFromNow(approved.expiresAt)).toBeGreaterThan(160);

      const content = await demoRepository.readChatContent({
        chatId: 'demo-chat-3',
        actor: moderator,
      });
      expect(content.accessRequestId).toBe(request.id);
      expect(content.messages.length).toBeGreaterThan(0);
    });

    it('no permite duplicar una solicitud pendiente ni decidir sin motivo', async () => {
      const moderator = await loginAs('moderador@demo.local');
      const superadmin = await loginAs('superadmin@demo.local');

      await expect(
        demoRepository.requestChatAccess({
          chatId: 'demo-chat-1',
          reason: 'Segunda solicitud',
          actor: moderator,
        })
      ).rejects.toThrow(/pendiente o aprobada/i);

      await expect(
        demoRepository.decideChatAccess({
          accessRequestId: 'demo-chat-access-2',
          decision: 'approved',
          reason: '   ',
          actor: superadmin,
        })
      ).rejects.toThrow(/motivo/i);
    });

    it('revoca un acceso aprobado y bloquea su lectura posterior', async () => {
      const moderator = await loginAs('moderador@demo.local');
      const superadmin = await loginAs('superadmin@demo.local');

      const revoked = await demoRepository.decideChatAccess({
        accessRequestId: 'demo-chat-access-1',
        decision: 'revoked',
        reason: 'La revisión ya terminó',
        reasonCode: 'no_longer_needed',
        actor: superadmin,
      });

      expect(revoked).toMatchObject({
        status: 'revoked',
        effectiveStatus: 'revoked',
        isActive: false,
      });

      await expect(
        demoRepository.readChatContent({ chatId: 'demo-chat-2', actor: moderator })
      ).rejects.toThrow(/aprobada y vigente/i);
    });

    it('deniega los metadatos a un rol sin chats.view_metadata', async () => {
      const support = await loginAs('soporte@demo.local');

      await expect(demoRepository.listChats({ actor: support })).rejects.toThrow(/permiso/i);
    });
  });

  describe('moderación', () => {
    it('asigna un reporte abierto al actor con auditoría', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const updated = await demoRepository.updateModerationReport({
        reportId: 'demo-report-1',
        status: 'in_review',
        reason: 'Asignación manual para revisión',
        reasonCode: 'manual',
        actor: moderator,
      });

      expect(updated).toMatchObject({
        status: 'in_review',
        assignedToId: moderator.memberId,
        assignedToMe: true,
      });

      const audit = await demoRepository.listAudit({ module: 'Moderación' });
      expect(audit[0]).toMatchObject({
        action: 'moderation.assign',
        entityId: 'demo-report-1',
        metadata: { previousStatus: 'open', newStatus: 'in_review', reasonCode: 'manual' },
      });
    });

    it('resuelve un reporte en revisión y registra el motivo', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const updated = await demoRepository.updateModerationReport({
        reportId: 'demo-report-1',
        status: 'resolved',
        reason: 'Se revisó la conversación y no hubo infracción',
        reasonCode: 'no_violation',
        actor: moderator,
      });

      expect(updated.status).toBe('resolved');
      expect(updated.resolutionReason).toBe('Se revisó la conversación y no hubo infracción');

      const audit = await demoRepository.listAudit({ module: 'Moderación' });
      expect(audit[0]).toMatchObject({
        action: 'moderation.resolve',
        entityId: 'demo-report-1',
      });
    });

    it('rechaza transiciones no permitidas y la falta de motivo', async () => {
      const moderator = await loginAs('moderador@demo.local');

      await expect(
        demoRepository.updateModerationReport({
          reportId: 'demo-report-4',
          status: 'open',
          reason: 'Reabrir',
          actor: moderator,
        })
      ).rejects.toThrow(/no permitida/i);

      await expect(
        demoRepository.updateModerationReport({
          reportId: 'demo-report-1',
          status: 'resolved',
          reason: '',
          actor: moderator,
        })
      ).rejects.toThrow(/motivo/i);
    });

    it('oculta los reportes a un rol sin moderation.view', async () => {
      const analyst = await loginAs('analista@demo.local');

      await expect(demoRepository.listModerationReports({ actor: analyst })).rejects.toThrow(
        /permiso/i
      );
    });
  });

  describe('reseñas', () => {
    it('oculta una reseña publicada con auditoría', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const updated = await demoRepository.setReviewStatus({
        reviewId: 'demo-review-1',
        status: 'hidden',
        reason: 'Expone datos personales',
        reasonCode: 'pii',
        actor: moderator,
      });

      expect(updated.status).toBe('hidden');
      expect(updated.statusReason).toBe('Expone datos personales');

      const audit = await demoRepository.listAudit({ module: 'Reseñas' });
      expect(audit[0]).toMatchObject({
        action: 'review.hide',
        entityId: 'demo-review-1',
        metadata: { previousStatus: 'published', newStatus: 'hidden', reasonCode: 'pii' },
      });
    });

    it('publica una reseña pendiente y restaura una oculta', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const published = await demoRepository.setReviewStatus({
        reviewId: 'demo-review-5',
        status: 'published',
        reason: 'Contenido verificado',
        reasonCode: 'verified',
        actor: moderator,
      });
      expect(published.status).toBe('published');
      expect(published.publishedAt).toBeTruthy();

      let audit = await demoRepository.listAudit({ module: 'Reseñas' });
      expect(audit[0].action).toBe('review.publish');

      const restored = await demoRepository.setReviewStatus({
        reviewId: 'demo-review-4',
        status: 'published',
        reason: 'Ocultación por error',
        reasonCode: 'error',
        actor: moderator,
      });
      expect(restored.status).toBe('published');

      audit = await demoRepository.listAudit({ module: 'Reseñas' });
      expect(audit[0].action).toBe('review.restore');
    });

    it('deniega la moderación a un rol que solo puede ver reseñas', async () => {
      const support = await loginAs('soporte@demo.local');

      await expect(
        demoRepository.setReviewStatus({
          reviewId: 'demo-review-1',
          status: 'hidden',
          reason: 'Intento sin permiso',
          actor: support,
        })
      ).rejects.toThrow(/permiso/i);
    });
  });

  describe('soporte', () => {
    it('responde un ticket abierto, lo pasa a en curso y se asigna', async () => {
      const support = await loginAs('soporte@demo.local');

      const updated = await demoRepository.replySupportTicket({
        ticketId: 'demo-ticket-2',
        body: 'Adjuntamos la factura solicitada.',
        actor: support,
      });

      expect(updated).toMatchObject({
        status: 'in_progress',
        assignedToId: support.memberId,
      });
      expect(updated.messages).toHaveLength(2);

      const audit = await demoRepository.listAudit({ module: 'Soporte' });
      expect(audit[0]).toMatchObject({
        action: 'support.reply',
        entityId: 'demo-ticket-2',
        metadata: { internal: false, previousStatus: 'open', newStatus: 'in_progress' },
      });
    });

    it('resuelve, cierra y reabre un ticket recalculando el plazo', async () => {
      const support = await loginAs('soporte@demo.local');

      const resolved = await demoRepository.updateSupportStatus({
        ticketId: 'demo-ticket-3',
        status: 'resolved',
        reason: 'Disputa resuelta con el comprador',
        reasonCode: 'solved',
        actor: support,
      });
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedAt).toBeTruthy();

      const closed = await demoRepository.updateSupportStatus({
        ticketId: 'demo-ticket-3',
        status: 'closed',
        reason: 'Cierre confirmado',
        reasonCode: 'confirmed',
        actor: support,
      });
      expect(closed.status).toBe('closed');

      const reopened = await demoRepository.updateSupportStatus({
        ticketId: 'demo-ticket-3',
        status: 'open',
        reason: 'El comercio pidió reabrir el caso',
        reasonCode: 'reopen_request',
        actor: support,
      });
      expect(reopened.status).toBe('open');
      expect(reopened.resolvedAt).toBeNull();
      expect(reopened.closedAt).toBeNull();
      // El ticket es urgente: el SLA es de 4 horas.
      expect(hoursFromNow(reopened.dueAt)).toBeGreaterThan(3);
      expect(hoursFromNow(reopened.dueAt)).toBeLessThanOrEqual(4);
    });

    it('no permite asignar un ticket cerrado ni responder sin permiso', async () => {
      const support = await loginAs('soporte@demo.local');
      const analyst = await loginAs('analista@demo.local');

      await demoRepository.updateSupportStatus({
        ticketId: 'demo-ticket-5',
        status: 'closed',
        reason: 'Cierre confirmado',
        actor: support,
      });

      await expect(
        demoRepository.assignSupportTicket({ ticketId: 'demo-ticket-5', actor: support })
      ).rejects.toThrow(/cerrado/i);

      await expect(
        demoRepository.replySupportTicket({
          ticketId: 'demo-ticket-2',
          body: 'Intento sin permiso',
          actor: analyst,
        })
      ).rejects.toThrow(/permiso/i);
    });
  });

  describe('comunicaciones simuladas', () => {
    it('activa una plantilla en borrador con auditoría', async () => {
      const admin = await loginAs('admin@demo.local');

      const updated = await demoRepository.setCommunicationTemplateStatus({
        templateId: 'demo-template-3',
        status: 'active',
        reason: 'Plantilla revisada',
        reasonCode: 'reviewed',
        actor: admin,
      });

      expect(updated).toMatchObject({ status: 'active', segmentLabel: 'Compradores activos' });

      const audit = await demoRepository.listAudit({ module: 'Comunicaciones' });
      expect(audit[0]).toMatchObject({
        action: 'communications.template.active',
        entityId: 'demo-template-3',
      });
    });

    it('crea una campaña dirigida y la deja en cola simulada explícita', async () => {
      const admin = await loginAs('admin@demo.local');

      const campaign = await demoRepository.createCommunicationCampaign({
        name: 'Recordatorio de facturas',
        templateId: 'demo-template-1',
        segment: 'active_buyers',
        actor: admin,
      });

      expect(campaign).toMatchObject({
        status: 'draft',
        simulated: true,
        providerStatus: 'draft',
        segmentLabel: 'Compradores activos',
      });
      expect(campaign.audienceCount).toBeGreaterThan(0);

      const queued = await demoRepository.setCampaignStatus({
        campaignId: campaign.id,
        status: 'queued',
        reason: 'Contenido y segmento aprobados',
        reasonCode: 'approved',
        actor: admin,
      });

      expect(queued).toMatchObject({
        status: 'queued',
        simulated: true,
        providerStatus: 'demo_pending',
      });
      expect(queued.statusReason).toMatch(/simulada/i);
      expect(queued.queuedAt).toBeTruthy();

      const audit = await demoRepository.listAudit({ module: 'Comunicaciones' });
      expect(audit[0]).toMatchObject({
        action: 'communications.campaign.queue',
        metadata: { simulated: true, providerStatus: 'demo_pending', newStatus: 'queued' },
      });
    });

    it('marca una campaña en cola como enviada solo en la simulación', async () => {
      const admin = await loginAs('admin@demo.local');

      const sent = await demoRepository.setCampaignStatus({
        campaignId: 'demo-campaign-2',
        status: 'sent',
        reason: 'Envío autorizado',
        actor: admin,
      });

      expect(sent).toMatchObject({
        status: 'sent',
        simulated: true,
        providerStatus: 'demo_simulated',
      });
      expect(sent.statusReason).toMatch(/no se entregó ningún mensaje real/i);

      const audit = await demoRepository.listAudit({ module: 'Comunicaciones' });
      expect(audit[0]).toMatchObject({
        action: 'communications.campaign.send',
        metadata: { simulated: true, providerStatus: 'demo_simulated', newStatus: 'sent' },
      });
    });

    it('exige communications.broadcast para audiencias amplias y communications.send para dirigidas', async () => {
      const sender = asActor(['communications.view', 'communications.send']);
      const broadcaster = asActor([
        'communications.view',
        'communications.send',
        'communications.broadcast',
      ]);

      await expect(
        demoRepository.createCommunicationCampaign({
          name: 'Aviso masivo sin permiso',
          templateId: 'demo-template-2',
          segment: 'mixed',
          actor: sender,
        })
      ).rejects.toThrow(/permiso/i);

      const broad = await demoRepository.createCommunicationCampaign({
        name: 'Aviso a compradores y comercios',
        templateId: 'demo-template-2',
        segment: 'mixed',
        actor: broadcaster,
      });
      expect(broad.status).toBe('draft');
      expect(broad.audienceCount).toBeGreaterThan(0);
    });

    it('rechaza usar una plantilla que no está activa', async () => {
      const admin = await loginAs('admin@demo.local');

      await expect(
        demoRepository.createCommunicationCampaign({
          name: 'Campaña con plantilla archivada',
          templateId: 'demo-template-4',
          segment: 'mixed',
          actor: admin,
        })
      ).rejects.toThrow(/plantillas activas/i);
    });
  });

  describe('métricas de confianza y atención', () => {
    it('combina los indicadores de la Fase 4 y respeta los permisos del actor', async () => {
      const superadmin = await loginAs('superadmin@demo.local');
      const metrics = await demoRepository.getMetrics({ actor: superadmin });

      expect(metrics).toMatchObject({
        flaggedChats: 1,
        pendingChatAccessRequests: 1,
        totalChats: 5,
        openModerationReports: 2,
        inReviewModerationReports: 1,
        totalModerationReports: 6,
        publishedReviews: 3,
        hiddenReviews: 1,
        flaggedReviews: 1,
        totalReviews: 6,
        openSupportTickets: 2,
        inProgressSupportTickets: 1,
        overdueSupportTickets: 1,
        totalSupportTickets: 6,
        activeTemplates: 2,
        queuedCampaigns: 1,
        totalTemplates: 4,
        totalCampaigns: 4,
      });

      const attentionIds = metrics.attention.map((item) => item.id);
      expect(attentionIds).toEqual(
        expect.arrayContaining([
          'pendingChatAccess',
          'flaggedChats',
          'openModerationReports',
          'flaggedReviews',
          'overdueSupportTickets',
          'queuedCampaigns',
        ])
      );

      const support = await loginAs('soporte@demo.local');
      const supportMetrics = await demoRepository.getMetrics({ actor: support });
      expect(supportMetrics.totalChats).toBe(0);
      expect(supportMetrics.pendingChatAccessRequests).toBe(0);
      expect(supportMetrics.totalSupportTickets).toBe(6);
      expect(supportMetrics.totalTemplates).toBe(0);
    });
  });
});
