import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD, demoRepository } from './demoRepository';

const STORE_KEY = 'chat_compras_admin_demo_v1';

const loginAs = async (email) => demoRepository.login({ email, password: DEMO_PASSWORD });

describe('repositorio de demostración · Fase 2', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('compradores', () => {
    it('enmascara el correo y el teléfono cuando el rol no tiene users.view_pii', async () => {
      const analyst = await loginAs('analista@demo.local');
      const buyers = await demoRepository.listBuyers({ actor: analyst });
      const valentina = buyers.find((buyer) => buyer.id === 'demo-buyer-1');

      expect(valentina).toMatchObject({
        email: 'v***@demo.local',
        phone: '•••• 0101',
        piiMasked: true,
      });
    });

    it('muestra los datos completos con users.view_pii', async () => {
      const admin = await loginAs('superadmin@demo.local');
      const buyers = await demoRepository.listBuyers({ actor: admin });
      const valentina = buyers.find((buyer) => buyer.id === 'demo-buyer-1');

      expect(valentina).toMatchObject({
        email: 'valentina.rodriguez@demo.local',
        phone: '+58 412 555 0101',
        piiMasked: false,
      });
    });

    it('filtra por estado y busca sobre los datos reales aunque se devuelvan enmascarados', async () => {
      const analyst = await loginAs('analista@demo.local');

      const suspended = await demoRepository.listBuyers({ status: 'suspended', actor: analyst });
      expect(suspended).toHaveLength(1);
      expect(suspended[0].status).toBe('suspended');

      const search = await demoRepository.listBuyers({ search: 'valentina.rodriguez', actor: analyst });
      expect(search.map((buyer) => buyer.id)).toEqual(['demo-buyer-1']);
      expect(search[0].email).toBe('v***@demo.local');
    });

    it('exige users.view para consultar compradores', async () => {
      const finance = { permissions: ['dashboard.view'] };

      await expect(demoRepository.listBuyers({ actor: finance })).rejects.toThrow(/permiso/i);
    });

    it('permite suspender con users.suspend pero no bloquear sin users.block', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const suspended = await demoRepository.setBuyerStatus({
        buyerId: 'demo-buyer-1',
        status: 'suspended',
        reason: 'Revisión de seguridad',
        reasonCode: 'security',
        actor: moderator,
      });
      expect(suspended.status).toBe('suspended');
      expect(suspended.piiMasked).toBe(true);

      await expect(
        demoRepository.setBuyerStatus({
          buyerId: 'demo-buyer-2',
          status: 'blocked',
          reason: 'Sospecha de fraude',
          reasonCode: 'fraud',
          actor: moderator,
        })
      ).rejects.toThrow(/bloquear/i);
    });

    it('bloquea y desbloquea con users.block registrando la auditoría correcta', async () => {
      const admin = await loginAs('superadmin@demo.local');

      const blocked = await demoRepository.setBuyerStatus({
        buyerId: 'demo-buyer-2',
        status: 'blocked',
        reason: 'Sospecha de fraude',
        reasonCode: 'fraud',
        actor: admin,
      });
      expect(blocked.status).toBe('blocked');

      let events = await demoRepository.listAudit({ search: 'demo-buyer-2' });
      expect(events[0].action).toBe('buyer.block');

      const reactivated = await demoRepository.setBuyerStatus({
        buyerId: 'demo-buyer-2',
        status: 'active',
        reason: 'Bloqueo por error',
        reasonCode: 'error',
        actor: admin,
      });
      expect(reactivated.status).toBe('active');

      events = await demoRepository.listAudit({ search: 'demo-buyer-2' });
      expect(events[0].action).toBe('buyer.unblock');
    });

    it('rechaza transiciones no permitidas y exige motivo', async () => {
      const admin = await loginAs('superadmin@demo.local');

      await expect(
        demoRepository.setBuyerStatus({
          buyerId: 'demo-buyer-6',
          status: 'suspended',
          reason: 'Revisión',
          actor: admin,
        })
      ).rejects.toThrow(/transición/i);

      await expect(
        demoRepository.setBuyerStatus({
          buyerId: 'demo-buyer-1',
          status: 'suspended',
          reason: '   ',
          actor: admin,
        })
      ).rejects.toThrow(/motivo/i);
    });
  });

  describe('comercios y documentos', () => {
    it('recorre las transiciones permitidas y audita cada cambio', async () => {
      const manager = await loginAs('comercios@demo.local');

      const inReview = await demoRepository.setCommerceStatus({
        commerceId: 'demo-commerce-1',
        status: 'in_review',
        reason: 'Documentación recibida',
        reasonCode: 'documents_received',
        actor: manager,
      });
      expect(inReview.status).toBe('in_review');

      const approved = await demoRepository.setCommerceStatus({
        commerceId: 'demo-commerce-1',
        status: 'approved',
        reason: 'Documentación verificada',
        reasonCode: 'documents_verified',
        actor: manager,
      });
      expect(approved.status).toBe('approved');
      expect(approved.reviewedByName).toBe('María Salas');

      const suspended = await demoRepository.setCommerceStatus({
        commerceId: 'demo-commerce-1',
        status: 'suspended',
        reason: 'Documentación vencida',
        reasonCode: 'documents_expired',
        actor: manager,
      });
      expect(suspended.status).toBe('suspended');

      const reactivated = await demoRepository.setCommerceStatus({
        commerceId: 'demo-commerce-1',
        status: 'approved',
        reason: 'Documentación actualizada',
        reasonCode: 'documents_updated',
        actor: manager,
      });
      expect(reactivated.status).toBe('approved');

      const events = await demoRepository.listAudit({ search: 'demo-commerce-1' });
      const actions = events.map((event) => event.action).slice(0, 4);
      expect(actions).toEqual([
        'commerce.reactivate',
        'commerce.suspend',
        'commerce.approve',
        'commerce.review',
      ]);
    });

    it('rechaza transiciones inválidas y aplica el permiso de cada decisión', async () => {
      const moderator = await loginAs('moderador@demo.local');
      const manager = await loginAs('comercios@demo.local');

      await expect(
        demoRepository.setCommerceStatus({
          commerceId: 'demo-commerce-1',
          status: 'approved',
          reason: 'Aprobación directa',
          actor: manager,
        })
      ).rejects.toThrow(/transición/i);

      await expect(
        demoRepository.setCommerceStatus({
          commerceId: 'demo-commerce-1',
          status: 'in_review',
          reason: 'Revisión',
          actor: moderator,
        })
      ).rejects.toThrow(/permiso/i);

      await expect(
        demoRepository.setCommerceStatus({
          commerceId: 'demo-commerce-1',
          status: 'rejected',
          reason: 'Documentación incompleta',
          actor: moderator,
        })
      ).rejects.toThrow(/permiso/i);
    });

    it('oculta los documentos sin commerce.documents.view', async () => {
      const moderator = await loginAs('moderador@demo.local');

      const commerce = await demoRepository.getCommerce({
        commerceId: 'demo-commerce-1',
        actor: moderator,
      });

      expect(commerce.documentsRestricted).toBe(true);
      expect(commerce.documents).toEqual([]);
      expect(commerce.documentSummary.total).toBe(4);
    });

    it('expone solo metadatos de documentos autorizados, sin rutas de almacenamiento', async () => {
      const manager = await loginAs('comercios@demo.local');

      const commerce = await demoRepository.getCommerce({
        commerceId: 'demo-commerce-1',
        actor: manager,
      });

      expect(commerce.documentsRestricted).toBe(false);
      expect(commerce.documents).toHaveLength(4);
      expect(commerce.documents[0]).toMatchObject({
        typeLabel: 'Identificación fiscal',
        hasFile: false,
      });
      expect(commerce.documents[0]).not.toHaveProperty('storagePath');
    });

    it('revisa documentos con commerce.approve y actualiza el resumen', async () => {
      const manager = await loginAs('comercios@demo.local');

      const reviewed = await demoRepository.reviewCommerceDocument({
        documentId: 'demo-doc-1',
        status: 'verified',
        reason: 'Documento válido y vigente',
        reasonCode: 'valid',
        actor: manager,
      });

      expect(reviewed).toMatchObject({
        id: 'demo-doc-1',
        status: 'verified',
        reviewedByName: 'María Salas',
        hasFile: false,
      });

      const commerce = await demoRepository.getCommerce({
        commerceId: 'demo-commerce-1',
        actor: manager,
      });
      expect(commerce.documentSummary).toMatchObject({
        total: 4,
        pending: 3,
        verified: 1,
      });

      const events = await demoRepository.listAudit({ search: 'demo-doc-1' });
      expect(events[0].action).toBe('commerce.document.verify');
    });

    it('impide revisar documentos sin commerce.approve o sin motivo', async () => {
      const moderator = await loginAs('moderador@demo.local');
      const manager = await loginAs('comercios@demo.local');

      await expect(
        demoRepository.reviewCommerceDocument({
          documentId: 'demo-doc-1',
          status: 'verified',
          reason: 'Válido',
          actor: moderator,
        })
      ).rejects.toThrow(/permiso/i);

      await expect(
        demoRepository.reviewCommerceDocument({
          documentId: 'demo-doc-1',
          status: 'verified',
          reason: '',
          actor: manager,
        })
      ).rejects.toThrow(/motivo/i);

      await expect(
        demoRepository.reviewCommerceDocument({
          documentId: 'demo-doc-1',
          status: 'pending',
          reason: 'Reabrir',
          actor: manager,
        })
      ).rejects.toThrow(/no válido/i);
    });

    it('no inventa archivos ni URLs firmadas en modo demostración', async () => {
      await expect(demoRepository.getDocumentSignedUrl({ documentId: 'demo-doc-1' })).rejects.toThrow(
        /no tienen archivo real/i
      );
    });
  });

  describe('categorías', () => {
    it('exige catalog.view para listar y catalog.deactivate para cambiar el estado', async () => {
      const moderator = await loginAs('moderador@demo.local');

      await expect(demoRepository.listCategories({ actor: moderator })).rejects.toThrow(/permiso/i);
      await expect(
        demoRepository.setCategoryStatus({
          categoryId: 'demo-category-6',
          status: 'inactive',
          reason: 'Fuera de uso',
          actor: moderator,
        })
      ).rejects.toThrow(/permiso/i);
    });

    it('devuelve padres antes que subcategorías e incluye el padre al buscar una hija', async () => {
      const manager = await loginAs('comercios@demo.local');
      const categories = await demoRepository.listCategories({ actor: manager });

      expect(categories[0].id).toBe('demo-category-1');
      expect(categories[1].parentId).toBe('demo-category-1');

      const search = await demoRepository.listCategories({ search: 'frenos', actor: manager });
      const ids = search.map((category) => category.id);
      expect(ids).toContain('demo-category-1');
      expect(ids).toContain('demo-category-3');
    });

    it('crea subcategorías y evita duplicados o un tercer nivel', async () => {
      const manager = await loginAs('comercios@demo.local');

      const created = await demoRepository.createCategory({
        name: 'Discos de freno',
        parentId: 'demo-category-1',
        description: 'Discos y tambores.',
        sortOrder: 25,
        actor: manager,
      });
      expect(created).toMatchObject({
        name: 'Discos de freno',
        slug: 'discos-de-freno',
        parentId: 'demo-category-1',
        status: 'active',
      });

      await expect(
        demoRepository.createCategory({
          name: 'Frenos',
          parentId: null,
          actor: manager,
        })
      ).rejects.toThrow(/ya existe/i);

      await expect(
        demoRepository.createCategory({
          name: 'Discos ventilados',
          parentId: 'demo-category-2',
          actor: manager,
        })
      ).rejects.toThrow(/dos niveles/i);
    });

    it('no mueve categorías con hijas ni permite ser su propio padre', async () => {
      const manager = await loginAs('comercios@demo.local');

      await expect(
        demoRepository.updateCategory({
          categoryId: 'demo-category-1',
          name: 'Repuestos',
          parentId: 'demo-category-6',
          actor: manager,
        })
      ).rejects.toThrow(/mover/i);

      await expect(
        demoRepository.updateCategory({
          categoryId: 'demo-category-3',
          name: 'Frenos',
          parentId: 'demo-category-3',
          actor: manager,
        })
      ).rejects.toThrow(/propia/i);

      await expect(
        demoRepository.updateCategory({
          categoryId: 'demo-category-3',
          name: 'Motor',
          parentId: 'demo-category-1',
          actor: manager,
        })
      ).rejects.toThrow(/ya existe otra/i);
    });

    it('bloquea desactivar un padre con subcategorías activas y permite reactivar hijas', async () => {
      const manager = await loginAs('comercios@demo.local');

      await expect(
        demoRepository.setCategoryStatus({
          categoryId: 'demo-category-1',
          status: 'inactive',
          reason: 'Categoría reemplazada',
          actor: manager,
        })
      ).rejects.toThrow(/subcategorías activas/i);

      const deactivated = await demoRepository.setCategoryStatus({
        categoryId: 'demo-category-2',
        status: 'inactive',
        reason: 'Categoría fuera de uso',
        reasonCode: 'not_used',
        actor: manager,
      });
      expect(deactivated.status).toBe('inactive');

      const reactivated = await demoRepository.setCategoryStatus({
        categoryId: 'demo-category-11',
        status: 'active',
        reason: 'Nueva temporada o catálogo',
        reasonCode: 'new_catalog',
        actor: manager,
      });
      expect(reactivated.status).toBe('active');

      const events = await demoRepository.listAudit({ search: 'catalog.' });
      expect(events.some((event) => event.action === 'catalog.deactivate')).toBe(true);
      expect(events.some((event) => event.action === 'catalog.activate')).toBe(true);
    });

    it('no ofrece borrado de categorías', () => {
      expect(demoRepository.deleteCategory).toBeUndefined();
    });
  });

  describe('indicadores según permisos', () => {
    it('calcula todos los indicadores para superadmin e incluye los avisos de Fase 2', async () => {
      const admin = await loginAs('superadmin@demo.local');
      const metrics = await demoRepository.getMetrics({ actor: admin });

      expect(metrics).toMatchObject({
        totalBuyers: 6,
        activeBuyers: 3,
        totalCommerces: 7,
        pendingCommerces: 1,
        inReviewCommerces: 1,
        approvedCommerces: 3,
        totalDocuments: 28,
        pendingDocuments: 8,
        totalCategories: 11,
        activeCategories: 10,
        inactiveCategories: 1,
      });

      const attentionIds = metrics.attention.map((item) => item.id);
      expect(attentionIds).toContain('pendingCommerces');
      expect(attentionIds).toContain('blockedBuyers');
      expect(attentionIds).toContain('rejectedDocuments');
    });

    it('oculta documentos, catálogo y personal a un rol de solo lectura', async () => {
      const analyst = await loginAs('analista@demo.local');
      const metrics = await demoRepository.getMetrics({ actor: analyst });

      expect(metrics.activeMembers).toBe(0);
      expect(metrics.totalDocuments).toBe(0);
      expect(metrics.totalCategories).toBe(0);
      expect(metrics.activeBuyers).toBe(3);
      expect(metrics.pendingCommerces).toBe(1);
      expect(metrics.recentAudit.length).toBeGreaterThan(0);

      const attentionIds = metrics.attention.map((item) => item.id);
      expect(attentionIds).not.toContain('rejectedDocuments');
      expect(attentionIds).not.toContain('invitations');
    });

    it('no muestra auditoría sin audit.view', async () => {
      const support = await loginAs('soporte@demo.local');
      const metrics = await demoRepository.getMetrics({ actor: support });

      expect(metrics.auditToday).toBe(0);
      expect(metrics.recentAudit).toEqual([]);
    });
  });

  describe('migración del almacén', () => {
    it('migra un almacén de Fase 1 a la versión 3 conservando miembros, invitaciones y auditoría', async () => {
      const legacyStore = {
        version: 1,
        members: [
          {
            id: 'legacy-member',
            email: 'superadmin@demo.local',
            name: 'Ana Torres',
            roleKey: 'superadmin',
            status: 'active',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            lastLoginAt: null,
          },
        ],
        invitations: [
          {
            id: 'legacy-invitation',
            email: 'pendiente@demo.local',
            name: 'Pendiente',
            roleKey: 'analyst',
            status: 'pending',
            createdAt: new Date().toISOString(),
            invitedByName: 'Ana Torres',
          },
        ],
        audit: [
          {
            id: 'legacy-audit',
            createdAt: new Date().toISOString(),
            actorId: 'legacy-member',
            actorName: 'Ana Torres',
            actorRole: 'superadmin',
            action: 'auth.login',
            module: 'Autenticación',
            entityType: 'admin_member',
            entityId: 'legacy-member',
            reason: null,
            metadata: { result: 'success' },
          },
        ],
      };

      localStorage.setItem(STORE_KEY, JSON.stringify(legacyStore));

      const session = await loginAs('superadmin@demo.local');
      expect(session.memberId).toBe('legacy-member');

      const stored = JSON.parse(localStorage.getItem(STORE_KEY));
      expect(stored.version).toBe(3);
      expect(stored.members).toHaveLength(1);
      expect(stored.invitations).toHaveLength(1);
      expect(stored.buyers).toHaveLength(6);
      expect(stored.commerces).toHaveLength(7);
      expect(stored.commerceDocuments).toHaveLength(28);
      expect(stored.categories).toHaveLength(11);
      expect(stored.requests).toHaveLength(7);
      expect(stored.offers).toHaveLength(10);
      expect(stored.orders).toHaveLength(6);
      expect(stored.deliveries).toHaveLength(6);

      const auditIds = stored.audit.map((entry) => entry.id);
      expect(auditIds).toContain('legacy-audit');
      expect(auditIds).toContain('demo-audit-p2-1');
      expect(auditIds).toContain('demo-audit-p3-1');
      expect(auditIds.filter((id) => id === 'legacy-audit')).toHaveLength(1);
      expect(auditIds.indexOf('demo-audit-p3-1')).toBeLessThan(auditIds.indexOf('legacy-audit'));
      expect(auditIds.indexOf('demo-audit-p2-1')).toBeLessThan(auditIds.indexOf('legacy-audit'));
    });
  });
});
