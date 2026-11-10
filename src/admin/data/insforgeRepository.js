// Adaptador InsForge del administrador.
// Requiere: VITE_INSFORGE_URL, VITE_INSFORGE_ANON_KEY y las migraciones de
// Fase 1, 2 y 3 aplicadas. Sin proyecto conectado, el admin usa el modo demostración.

import { deliveryEvidenceBucket, documentsBucket } from '../../lib/insforge';
import { ANALYTICS_EXPORT_NOTICE, analyticsRangeDays, analyticsRangeLabel } from '../constants/phase5';
import { buildCsv, csvDateStamp } from '../utils/csv';

const MEMBER_COLUMNS =
  'id,user_id,email,display_name,status,last_login_at,created_at,role_id';

const AUDIT_COLUMNS =
  'id,created_at,actor_id,actor_name,actor_email,actor_role,action,module,entity_type,entity_id,reason_code,reason_text,metadata';

const mapSession = (payload) => {
  if (!payload) return null;
  const data = Array.isArray(payload) ? payload[0] : payload;
  if (!data || !data.memberId) return null;

  return {
    memberId: data.memberId,
    email: data.email,
    name: data.name,
    roleKey: data.roleKey,
    roleName: data.roleName || data.roleKey,
    status: data.status,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  };
};

const throwIfError = (error, fallback) => {
  if (error) {
    const message = error.message || error.error || fallback;
    const wrapped = new Error(message);
    wrapped.cause = error;
    throw wrapped;
  }
};

const asArray = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return [payload];
};

const readPath = (payload) => {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;
  const row = Array.isArray(payload) ? payload[0] : payload;
  return row?.storagePath || row?.storage_path || row?.path || null;
};

const EMPTY_METRICS = {
  activeMembers: 0,
  suspendedMembers: 0,
  pendingInvitations: 0,
  auditToday: 0,
  totalMembers: 0,
  activeBuyers: 0,
  suspendedBuyers: 0,
  blockedBuyers: 0,
  totalBuyers: 0,
  pendingCommerces: 0,
  inReviewCommerces: 0,
  approvedCommerces: 0,
  suspendedCommerces: 0,
  totalCommerces: 0,
  activeCategories: 0,
  inactiveCategories: 0,
  totalCategories: 0,
  pendingDocuments: 0,
  verifiedDocuments: 0,
  rejectedDocuments: 0,
  totalDocuments: 0,
  openRequests: 0,
  hiddenRequests: 0,
  expiredRequests: 0,
  closedRequests: 0,
  totalRequests: 0,
  activeOffers: 0,
  flaggedOffers: 0,
  withdrawnOffers: 0,
  totalOffers: 0,
  pendingOrders: 0,
  inProgressOrders: 0,
  disputedOrders: 0,
  completedOrders: 0,
  cancelledOrders: 0,
  totalOrders: 0,
  pendingDeliveries: 0,
  inTransitDeliveries: 0,
  failedDeliveries: 0,
  deliveredDeliveries: 0,
  openIncidents: 0,
  totalDeliveries: 0,
  flaggedChats: 0,
  pendingChatAccessRequests: 0,
  totalChats: 0,
  openModerationReports: 0,
  inReviewModerationReports: 0,
  totalModerationReports: 0,
  publishedReviews: 0,
  hiddenReviews: 0,
  flaggedReviews: 0,
  totalReviews: 0,
  openSupportTickets: 0,
  inProgressSupportTickets: 0,
  overdueSupportTickets: 0,
  totalSupportTickets: 0,
  activeTemplates: 0,
  queuedCampaigns: 0,
  totalTemplates: 0,
  totalCampaigns: 0,
  totalPayments: 0,
  pendingPayments: 0,
  unreconciledPayments: 0,
  grossCollected: 0,
  commissionRevenue: 0,
  refundedAmount: 0,
  pendingPayouts: 0,
  totalPayouts: 0,
  paymentGatewayConnected: false,
  recentAudit: [],
  attention: [],
};

const buildAnalyticsCsv = (analytics) => {
  const rows = [];
  const start = String(analytics.periodStart || '').slice(0, 10);
  const end = String(analytics.periodEnd || '').slice(0, 10);
  const period = `${start} a ${end}`;
  const summary = analytics.summary || {};

  [
    ['GMV cobrado', summary.gmv],
    ['Comisión estimada', summary.commissionRevenue],
    ['Neto a comercios', summary.netToCommerces],
    ['Reembolsos registrados', summary.refundedAmount],
    ['Volumen de pedidos', summary.orderVolume],
    ['Ticket promedio', summary.averageOrderValue],
    ['Pedidos', summary.orders],
    ['Pagos registrados', summary.payments],
    ['Pagos cobrados', summary.collectedPayments],
    ['Pedidos completados', summary.completedOrders],
    ['Pedidos en disputa', summary.disputedOrders],
    ['Pedidos cancelados', summary.cancelledOrders],
    ['Pagos sin conciliar', summary.unreconciledPayments],
  ].forEach(([metrica, valor]) => {
    rows.push({ seccion: 'Resumen', periodo: period, comercio: '', metrica, valor });
  });

  (analytics.series || []).forEach((day) => {
    rows.push({ seccion: 'Serie diaria', periodo: day.date, comercio: '', metrica: 'GMV cobrado', valor: day.gmv });
    rows.push({ seccion: 'Serie diaria', periodo: day.date, comercio: '', metrica: 'Pedidos', valor: day.orders });
    rows.push({ seccion: 'Serie diaria', periodo: day.date, comercio: '', metrica: 'Pagos cobrados', valor: day.payments });
  });

  (analytics.topCommerces || []).forEach((commerce) => {
    rows.push({ seccion: 'Top comercios', periodo: period, comercio: commerce.commerceName, metrica: 'GMV cobrado', valor: commerce.gmv });
    rows.push({ seccion: 'Top comercios', periodo: period, comercio: commerce.commerceName, metrica: 'Comisión estimada', valor: commerce.commission });
    rows.push({ seccion: 'Top comercios', periodo: period, comercio: commerce.commerceName, metrica: 'Pagos cobrados', valor: commerce.payments });
  });

  return buildCsv(
    [
      { key: 'seccion', label: 'seccion' },
      { key: 'periodo', label: 'periodo' },
      { key: 'comercio', label: 'comercio' },
      { key: 'metrica', label: 'metrica' },
      { key: 'valor', label: 'valor' },
    ],
    rows
  );
};

export function createInsforgeRepository(insforge) {
  const loadSessionForUser = async (user) => {
    if (!user) return null;

    const { data, error } = await insforge.database.rpc('admin_me');
    throwIfError(error, 'No se pudo comprobar el acceso administrativo. ¿Aplicaste las migraciones de Fase 1?');

    const session = mapSession(data);
    if (!session || session.status !== 'active') return null;
    return session;
  };

  const repository = {
    mode: 'insforge',

    async login({ email, password }) {
      const { data, error } = await insforge.auth.signInWithPassword({ email, password });
      if (error || !data?.user) {
        throw new Error(error?.message || 'Correo o contraseña incorrectos.');
      }

      const session = await loadSessionForUser(data.user);
      if (!session) {
        await insforge.auth.signOut();
        throw new Error('Esta cuenta no tiene acceso administrativo activo.');
      }

      try {
        await insforge.database.rpc('admin_record_login');
      } catch {
        // El login no debe fallar si la auditoría no está disponible; el
        // servidor seguirá exigiendo permisos en cada operación.
      }

      return session;
    },

    async getSession() {
      const { data, error } = await insforge.auth.getCurrentUser();
      if (error || !data?.user) return null;
      return loadSessionForUser(data.user);
    },

    async logout() {
      try {
        await insforge.database.rpc('admin_record_logout');
      } catch {
        // Sin auditoría disponible, el cierre de sesión continúa.
      }
      await insforge.auth.signOut();
    },

    async listMembers() {
      const [membersResult, rolesResult] = await Promise.all([
        insforge.database
          .from('admin_members')
          .select(MEMBER_COLUMNS)
          .order('created_at', { ascending: false }),
        insforge.database.from('admin_roles').select('id,key,name'),
      ]);

      throwIfError(membersResult.error, 'No se pudo cargar el personal administrativo.');
      throwIfError(rolesResult.error, 'No se pudieron cargar los roles.');

      const rolesById = new Map((rolesResult.data || []).map((role) => [role.id, role]));

      return (membersResult.data || []).map((member) => {
        const role = rolesById.get(member.role_id);
        return {
          id: member.id,
          email: member.email,
          name: member.display_name,
          roleKey: role?.key || 'unknown',
          roleName: role?.name || 'Sin rol',
          status: member.status,
          createdAt: member.created_at,
          lastLoginAt: member.last_login_at,
        };
      });
    },

    async listInvitations() {
      const { data, error } = await insforge.database
        .from('admin_invitations')
        .select('id,email,display_name,role_id,status,created_at,invited_by')
        .order('created_at', { ascending: false });

      throwIfError(error, 'No se pudieron cargar las invitaciones.');

      const { data: roles } = await insforge.database.from('admin_roles').select('id,key');
      const rolesById = new Map((roles || []).map((role) => [role.id, role.key]));

      return (data || []).map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        name: invitation.display_name,
        roleKey: rolesById.get(invitation.role_id) || 'unknown',
        status: invitation.status,
        createdAt: invitation.created_at,
      }));
    },

    async inviteMember({ email, name, roleKey }) {
      const { data, error } = await insforge.database.rpc('admin_invite_member', {
        p_email: email.trim().toLowerCase(),
        p_display_name: name.trim() || email.trim().toLowerCase(),
        p_role_key: roleKey,
      });
      throwIfError(error, 'No se pudo registrar la invitación.');
      return data;
    },

    async setMemberStatus({ memberId, status, reason }) {
      const { data, error } = await insforge.database.rpc('admin_set_member_status', {
        p_member_id: memberId,
        p_status: status,
        p_reason: reason,
      });
      throwIfError(error, 'No se pudo cambiar el estado del miembro.');
      return data;
    },

    async listAudit({ search = '', module = 'all', limit = 100 } = {}) {
      const { data, error } = await insforge.database
        .from('admin_audit_logs')
        .select(AUDIT_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(Math.max(limit, 200));

      throwIfError(error, 'No se pudo cargar la auditoría.');

      const term = search.trim().toLowerCase();

      return (data || [])
        .filter((entry) => (module === 'all' ? true : entry.module === module))
        .filter((entry) => {
          if (!term) return true;
          return [entry.action, entry.actor_name, entry.actor_email, entry.entity_id, entry.reason_text, entry.module, JSON.stringify(entry.metadata || {})]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term));
        })
        .slice(0, limit);
    },

    async getMetrics() {
      const [dashboardResult, trustResult, phase5Result] = await Promise.all([
        insforge.database.rpc('admin_dashboard_metrics'),
        insforge.database.rpc('admin_trust_metrics'),
        insforge.database.rpc('admin_phase5_metrics'),
      ]);

      throwIfError(
        dashboardResult.error,
        'No se pudieron cargar las métricas. ¿Aplicaste la migración de Fase 4?'
      );
      throwIfError(
        trustResult.error,
        'No se pudieron cargar las métricas de confianza. ¿Aplicaste la migración de Fase 4?'
      );
      throwIfError(
        phase5Result.error,
        'No se pudieron cargar las métricas de pagos. ¿Aplicaste la migración de Fase 5?'
      );

      const row = Array.isArray(dashboardResult.data)
        ? dashboardResult.data[0]
        : dashboardResult.data;
      const trust = Array.isArray(trustResult.data) ? trustResult.data[0] : trustResult.data;
      const phase5 = Array.isArray(phase5Result.data) ? phase5Result.data[0] : phase5Result.data;

      return {
        ...EMPTY_METRICS,
        ...(row || {}),
        ...(trust || {}),
        ...(phase5 || {}),
        recentAudit: Array.isArray(row?.recentAudit) ? row.recentAudit : [],
        attention: [
          ...(Array.isArray(row?.attention) ? row.attention : []),
          ...(Array.isArray(trust?.attention) ? trust.attention : []),
          ...(Array.isArray(phase5?.attention) ? phase5.attention : []),
        ],
        paymentGatewayConnected: false,
      };
    },

    // -------------------------------------------------------------------------
    // Compradores
    // -------------------------------------------------------------------------
    async listBuyers({ search = '', status = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_buyers', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
      });
      throwIfError(error, 'No se pudieron cargar los compradores.');
      return asArray(data);
    },

    async setBuyerStatus({ buyerId, status, reason, reasonCode = null }) {
      const { data, error } = await insforge.database.rpc('admin_set_buyer_status', {
        p_buyer_id: buyerId,
        p_status: status,
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo cambiar el estado del comprador.');
      return data;
    },

    // -------------------------------------------------------------------------
    // Comercios y documentos
    // -------------------------------------------------------------------------
    async listCommerces({ search = '', status = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_commerces', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
      });
      throwIfError(error, 'No se pudieron cargar los comercios.');
      return asArray(data);
    },

    async getCommerce({ commerceId }) {
      const { data, error } = await insforge.database.rpc('admin_get_commerce', {
        p_commerce_id: commerceId,
      });
      throwIfError(error, 'No se pudo cargar el comercio.');
      return Array.isArray(data) ? data[0] : data;
    },

    async reviewCommerceDocument({ documentId, status, reason, reasonCode = null }) {
      const { data, error } = await insforge.database.rpc('admin_review_commerce_document', {
        p_document_id: documentId,
        p_status: status,
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo revisar el documento.');
      return data;
    },

    async setCommerceStatus({ commerceId, status, reason, reasonCode = null }) {
      const { data, error } = await insforge.database.rpc('admin_set_commerce_status', {
        p_commerce_id: commerceId,
        p_status: status,
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo cambiar el estado del comercio.');
      return data;
    },

    async getDocumentSignedUrl({ documentId }) {
      const { data, error } = await insforge.database.rpc('admin_document_storage_path', {
        p_document_id: documentId,
      });
      throwIfError(error, 'No se pudo autorizar el documento.');

      const storagePath = readPath(data);
      if (!storagePath) {
        throw new Error('El documento no tiene un archivo asociado en el almacenamiento.');
      }

      const { data: signed, error: signedError } = await insforge.storage
        .from(documentsBucket)
        .createSignedUrl(storagePath, 300);
      throwIfError(signedError, 'No se pudo generar la URL firmada del documento.');

      if (!signed?.signedUrl) {
        throw new Error('El almacenamiento no devolvió una URL firmada.');
      }

      return { url: signed.signedUrl, expiresAt: signed.expiresAt || null };
    },

    // -------------------------------------------------------------------------
    // Categorías
    // -------------------------------------------------------------------------
    async listCategories({ search = '', status = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_categories', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
      });
      throwIfError(error, 'No se pudieron cargar las categorías.');
      return asArray(data);
    },

    async createCategory({ name, parentId = null, description = '', sortOrder = 0 }) {
      const { data, error } = await insforge.database.rpc('admin_create_category', {
        p_name: name,
        p_parent_id: parentId || null,
        p_description: description || null,
        p_sort_order: Number(sortOrder) || 0,
      });
      throwIfError(error, 'No se pudo crear la categoría.');
      return Array.isArray(data) ? data[0] : data;
    },

    async updateCategory({ categoryId, name, parentId = null, description = '', sortOrder = 0 }) {
      const { data, error } = await insforge.database.rpc('admin_update_category', {
        p_category_id: categoryId,
        p_name: name,
        p_parent_id: parentId || null,
        p_description: description || null,
        p_sort_order: Number(sortOrder) || 0,
      });
      throwIfError(error, 'No se pudo actualizar la categoría.');
      return Array.isArray(data) ? data[0] : data;
    },

    async setCategoryStatus({ categoryId, status, reason, reasonCode = null }) {
      const { data, error } = await insforge.database.rpc('admin_set_category_status', {
        p_category_id: categoryId,
        p_status: status,
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo cambiar el estado de la categoría.');
      return data;
    },

    // -------------------------------------------------------------------------
    // Solicitudes de compra
    // -------------------------------------------------------------------------
    async listRequests({ search = '', status = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_requests', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
      });
      throwIfError(error, 'No se pudieron cargar las solicitudes.');
      return asArray(data);
    },

    async getRequest({ requestId }) {
      const { data, error } = await insforge.database.rpc('admin_get_request', {
        p_request_id: requestId,
      });
      throwIfError(error, 'No se pudo cargar la solicitud.');
      return Array.isArray(data) ? data[0] : data;
    },

    async setRequestStatus({ requestId, status, reason, reasonCode = null }) {
      const { data, error } = await insforge.database.rpc('admin_set_request_status', {
        p_request_id: requestId,
        p_status: status,
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo cambiar el estado de la solicitud.');
      return data;
    },

    // -------------------------------------------------------------------------
    // Ofertas
    // -------------------------------------------------------------------------
    async listOffers({ search = '', status = 'all', requestId = null } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_offers', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
        p_request_id: requestId || null,
      });
      throwIfError(error, 'No se pudieron cargar las ofertas.');
      return asArray(data);
    },

    async getOffer({ offerId }) {
      const { data, error } = await insforge.database.rpc('admin_get_offer', {
        p_offer_id: offerId,
      });
      throwIfError(error, 'No se pudo cargar la oferta.');
      return Array.isArray(data) ? data[0] : data;
    },

    async setOfferStatus({ offerId, status, reason, reasonCode = null }) {
      const { data, error } = await insforge.database.rpc('admin_set_offer_status', {
        p_offer_id: offerId,
        p_status: status,
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo cambiar el estado de la oferta.');
      return data;
    },

    // -------------------------------------------------------------------------
    // Pedidos
    // -------------------------------------------------------------------------
    async listOrders({ search = '', status = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_orders', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
      });
      throwIfError(error, 'No se pudieron cargar los pedidos.');
      return asArray(data);
    },

    async getOrder({ orderId }) {
      const { data, error } = await insforge.database.rpc('admin_get_order', {
        p_order_id: orderId,
      });
      throwIfError(error, 'No se pudo cargar el pedido.');
      return Array.isArray(data) ? data[0] : data;
    },

    async transitionOrder({
      orderId,
      status,
      reason,
      reasonCode = null,
      resolution = null,
    }) {
      const { data, error } = await insforge.database.rpc('admin_transition_order', {
        p_order_id: orderId,
        p_status: status,
        p_reason: reason,
        p_reason_code: reasonCode,
        p_resolution: resolution,
      });
      throwIfError(error, 'No se pudo actualizar el pedido.');
      return data;
    },

    // -------------------------------------------------------------------------
    // Entregas
    // -------------------------------------------------------------------------
    async listDeliveries({ search = '', status = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_deliveries', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
      });
      throwIfError(error, 'No se pudieron cargar las entregas.');
      return asArray(data);
    },

    async getDelivery({ deliveryId }) {
      const { data, error } = await insforge.database.rpc('admin_get_delivery', {
        p_delivery_id: deliveryId,
      });
      throwIfError(error, 'No se pudo cargar la entrega.');
      return Array.isArray(data) ? data[0] : data;
    },

    async updateDelivery({
      deliveryId,
      status,
      reason,
      reasonCode = null,
      carrier,
      trackingCode,
      estimatedAt,
    }) {
      const { data, error } = await insforge.database.rpc('admin_update_delivery', {
        p_delivery_id: deliveryId,
        p_status: status,
        p_reason: reason,
        p_reason_code: reasonCode,
        p_carrier: carrier ?? null,
        p_tracking_code: trackingCode ?? null,
        p_estimated_at: estimatedAt || null,
      });
      throwIfError(error, 'No se pudo actualizar la entrega.');
      return data;
    },

    async confirmDelivery({ deliveryId, reason, reasonCode = 'received' }) {
      const { data, error } = await insforge.database.rpc('admin_confirm_delivery', {
        p_delivery_id: deliveryId,
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo confirmar la entrega.');
      return data;
    },

    async reportDeliveryIncident({ deliveryId, incidentType, description }) {
      const { data, error } = await insforge.database.rpc('admin_report_delivery_incident', {
        p_delivery_id: deliveryId,
        p_incident_type: incidentType,
        p_description: description,
      });
      throwIfError(error, 'No se pudo registrar la incidencia.');
      return data;
    },

    async resolveDeliveryIncident({ incidentId, resolutionReason }) {
      const { data, error } = await insforge.database.rpc('admin_resolve_delivery_incident', {
        p_incident_id: incidentId,
        p_resolution_reason: resolutionReason,
      });
      throwIfError(error, 'No se pudo resolver la incidencia.');
      return data;
    },

    async getDeliveryEvidenceSignedUrl({ evidenceId }) {
      const { data, error } = await insforge.database.rpc('admin_delivery_evidence_path', {
        p_evidence_id: evidenceId,
      });
      throwIfError(error, 'No se pudo autorizar la evidencia.');

      const storagePath = readPath(data);
      if (!storagePath) {
        throw new Error('La evidencia no tiene un archivo asociado en el almacenamiento.');
      }

      const { data: signed, error: signedError } = await insforge.storage
        .from(deliveryEvidenceBucket)
        .createSignedUrl(storagePath, 300);
      throwIfError(signedError, 'No se pudo generar la URL firmada de la evidencia.');

      if (!signed?.signedUrl) {
        throw new Error('El almacenamiento no devolvió una URL firmada.');
      }

      return { url: signed.signedUrl, expiresAt: signed.expiresAt || null };
    },

    // -------------------------------------------------------------------------
    // Chats (metadatos y acceso excepcional auditado)
    // -------------------------------------------------------------------------
    async listChats({ search = '', status = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_chats', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
      });
      throwIfError(error, 'No se pudieron cargar los chats.');
      return asArray(data);
    },

    async getChat({ chatId }) {
      const { data, error } = await insforge.database.rpc('admin_get_chat', {
        p_chat_id: chatId,
      });
      throwIfError(error, 'No se pudo cargar el chat.');
      return Array.isArray(data) ? data[0] : data;
    },

    async requestChatAccess({ chatId, reason, reasonCode = 'other' }) {
      const { data, error } = await insforge.database.rpc('admin_request_chat_access', {
        p_chat_id: chatId,
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo solicitar acceso al chat.');
      return Array.isArray(data) ? data[0] : data;
    },

    async decideChatAccess({
      accessRequestId,
      decision,
      reason,
      reasonCode = null,
      expiresInHours = 24,
    }) {
      const { data, error } = await insforge.database.rpc('admin_decide_chat_access', {
        p_access_request_id: accessRequestId,
        p_decision: decision,
        p_reason: reason,
        p_reason_code: reasonCode,
        p_expires_in_hours: Number(expiresInHours) || 24,
      });
      throwIfError(error, 'No se pudo actualizar el acceso al chat.');
      return Array.isArray(data) ? data[0] : data;
    },

    async readChatContent({ chatId }) {
      const { data, error } = await insforge.database.rpc('admin_read_chat_content', {
        p_chat_id: chatId,
      });
      throwIfError(
        error,
        'No se pudo leer el contenido. Requiere autorización aprobada y vigente.'
      );

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('El servidor no devolvió contenido para este chat.');
      return {
        ...row,
        messages: Array.isArray(row.messages) ? row.messages : [],
        simulated: false,
      };
    },

    // -------------------------------------------------------------------------
    // Moderación
    // -------------------------------------------------------------------------
    async listModerationReports({ search = '', status = 'all', reportType = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_moderation_reports', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
        p_report_type: reportType === 'all' ? null : reportType,
      });
      throwIfError(error, 'No se pudieron cargar los reportes de moderación.');
      return asArray(data);
    },

    async getModerationReport({ reportId }) {
      const { data, error } = await insforge.database.rpc('admin_get_moderation_report', {
        p_report_id: reportId,
      });
      throwIfError(error, 'No se pudo cargar el reporte de moderación.');
      return Array.isArray(data) ? data[0] : data;
    },

    async updateModerationReport({ reportId, status, reason, reasonCode = null }) {
      const { data, error } = await insforge.database.rpc('admin_update_moderation_report', {
        p_report_id: reportId,
        p_status: status,
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo actualizar el reporte de moderación.');
      return Array.isArray(data) ? data[0] : data;
    },

    // -------------------------------------------------------------------------
    // Reseñas
    // -------------------------------------------------------------------------
    async listReviews({ search = '', status = 'all', rating = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_reviews', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
        p_rating: rating === 'all' ? null : Number(rating),
      });
      throwIfError(error, 'No se pudieron cargar las reseñas.');
      return asArray(data);
    },

    async getReview({ reviewId }) {
      const { data, error } = await insforge.database.rpc('admin_get_review', {
        p_review_id: reviewId,
      });
      throwIfError(error, 'No se pudo cargar la reseña.');
      return Array.isArray(data) ? data[0] : data;
    },

    async setReviewStatus({ reviewId, status, reason, reasonCode = null }) {
      const { data, error } = await insforge.database.rpc('admin_set_review_status', {
        p_review_id: reviewId,
        p_status: status,
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo moderar la reseña.');
      return Array.isArray(data) ? data[0] : data;
    },

    // -------------------------------------------------------------------------
    // Soporte
    // -------------------------------------------------------------------------
    async listSupportTickets({ search = '', status = 'all', priority = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_support_tickets', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
        p_priority: priority === 'all' ? null : priority,
      });
      throwIfError(error, 'No se pudieron cargar los tickets de soporte.');
      return asArray(data);
    },

    async getSupportTicket({ ticketId }) {
      const { data, error } = await insforge.database.rpc('admin_get_support_ticket', {
        p_ticket_id: ticketId,
      });
      throwIfError(error, 'No se pudo cargar el ticket de soporte.');
      return Array.isArray(data) ? data[0] : data;
    },

    async assignSupportTicket({ ticketId, reason = 'Asignación manual' }) {
      const { data, error } = await insforge.database.rpc('admin_assign_support_ticket', {
        p_ticket_id: ticketId,
        p_reason: reason,
      });
      throwIfError(error, 'No se pudo asignar el ticket de soporte.');
      return Array.isArray(data) ? data[0] : data;
    },

    async updateSupportStatus({ ticketId, status, reason, reasonCode = null }) {
      const { data, error } = await insforge.database.rpc('admin_update_support_status', {
        p_ticket_id: ticketId,
        p_status: status,
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo actualizar el ticket de soporte.');
      return Array.isArray(data) ? data[0] : data;
    },

    async replySupportTicket({ ticketId, body, internal = false }) {
      const { data, error } = await insforge.database.rpc('admin_reply_support_ticket', {
        p_ticket_id: ticketId,
        p_body: body,
        p_internal: Boolean(internal),
      });
      throwIfError(error, 'No se pudo responder el ticket de soporte.');
      return Array.isArray(data) ? data[0] : data;
    },

    // -------------------------------------------------------------------------
    // Comunicaciones (sin proveedor: los envíos quedan simulados)
    // -------------------------------------------------------------------------
    async listCommunicationTemplates({ search = '', status = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_communication_templates', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
      });
      throwIfError(error, 'No se pudieron cargar las plantillas de comunicación.');
      return asArray(data);
    },

    async setCommunicationTemplateStatus({ templateId, status, reason, reasonCode = null }) {
      const { data, error } = await insforge.database.rpc(
        'admin_set_communication_template_status',
        {
          p_template_id: templateId,
          p_status: status,
          p_reason: reason,
          p_reason_code: reasonCode,
        }
      );
      throwIfError(error, 'No se pudo actualizar la plantilla de comunicación.');
      return Array.isArray(data) ? data[0] : data;
    },

    async listCommunicationCampaigns({ search = '', status = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_communication_campaigns', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
      });
      throwIfError(error, 'No se pudieron cargar las campañas de comunicación.');
      return asArray(data);
    },

    async createCommunicationCampaign({
      name,
      templateId,
      segment,
      scheduledAt = null,
    }) {
      const { data, error } = await insforge.database.rpc(
        'admin_create_communication_campaign',
        {
          p_name: name,
          p_template_id: templateId,
          p_segment: segment,
          p_scheduled_at: scheduledAt || null,
        }
      );
      throwIfError(error, 'No se pudo crear la campaña de comunicación.');
      return Array.isArray(data) ? data[0] : data;
    },

    async setCampaignStatus({ campaignId, status, reason, reasonCode = null }) {
      const { data, error } = await insforge.database.rpc('admin_set_campaign_status', {
        p_campaign_id: campaignId,
        p_status: status,
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo actualizar la campaña de comunicación.');
      return Array.isArray(data) ? data[0] : data;
    },

    // -------------------------------------------------------------------------
    // Analítica (Fase 5)
    // -------------------------------------------------------------------------
    async getAnalytics({ range = '30' } = {}) {
      const days = analyticsRangeDays(range);
      const { data, error } = await insforge.database.rpc('admin_analytics_report', {
        p_days: days,
      });
      throwIfError(
        error,
        'No se pudo cargar la analítica. ¿Aplicaste la migración de Fase 5?'
      );

      const row = Array.isArray(data) ? data[0] : data;
      return {
        generatedAt: new Date().toISOString(),
        rangeDays: days,
        rangeLabel: analyticsRangeLabel(range),
        periodStart: row?.periodStart || null,
        periodEnd: row?.periodEnd || null,
        piiIncluded: false,
        gatewayConnected: false,
        notice: ANALYTICS_EXPORT_NOTICE,
        summary: row?.summary || {},
        series: Array.isArray(row?.series) ? row.series : [],
        methodMix: Array.isArray(row?.methodMix) ? row.methodMix : [],
        topCommerces: Array.isArray(row?.topCommerces) ? row.topCommerces : [],
      };
    },

    async exportAnalytics({ range = '30' } = {}) {
      const days = analyticsRangeDays(range);
      const { data, error } = await insforge.database.rpc('admin_export_analytics', {
        p_days: days,
      });
      throwIfError(
        error,
        'No se pudo exportar la analítica. ¿Aplicaste la migración de Fase 5?'
      );

      const analytics = Array.isArray(data) ? data[0] : data;
      if (!analytics) throw new Error('El servidor no devolvió datos para exportar.');

      return {
        filename: `analitica-${days}d-${csvDateStamp()}.csv`,
        csv: buildAnalyticsCsv(analytics),
        generatedAt: new Date().toISOString(),
        rangeDays: days,
        rangeLabel: analyticsRangeLabel(range),
        notice: ANALYTICS_EXPORT_NOTICE,
      };
    },

    // -------------------------------------------------------------------------
    // Pagos (libro interno, sin pasarela)
    // -------------------------------------------------------------------------
    async listPayments({ search = '', status = 'all', reconciliation = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_payments', {
        p_search: search.trim() || null,
        p_status: status === 'all' ? null : status,
        p_reconciliation: reconciliation === 'all' ? null : reconciliation,
      });
      throwIfError(error, 'No se pudieron cargar los pagos.');
      return asArray(data);
    },

    async getPayment({ paymentId }) {
      const { data, error } = await insforge.database.rpc('admin_get_payment', {
        p_payment_id: paymentId,
      });
      throwIfError(error, 'No se pudo cargar el movimiento de pago.');
      return Array.isArray(data) ? data[0] : data;
    },

    async getPaymentMetrics() {
      const { data, error } = await insforge.database.rpc('admin_payment_metrics');
      throwIfError(error, 'No se pudieron cargar las métricas de pagos.');
      const row = Array.isArray(data) ? data[0] : data;
      return { ...(row || {}), gatewayConnected: false };
    },

    async listPaymentPayouts({ status = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_list_payment_payouts', {
        p_status: status === 'all' ? null : status,
      });
      throwIfError(error, 'No se pudieron cargar las liquidaciones.');
      return asArray(data);
    },

    async reconcilePayment({
      paymentId,
      reconciled = true,
      reason,
      reasonCode = 'other',
    } = {}) {
      const { data, error } = await insforge.database.rpc('admin_reconcile_payment', {
        p_payment_id: paymentId,
        p_reconciled: Boolean(reconciled),
        p_reason: reason,
        p_reason_code: reasonCode,
      });
      throwIfError(error, 'No se pudo conciliar el pago.');
      return Array.isArray(data) ? data[0] : data;
    },

    // -------------------------------------------------------------------------
    // Exportación de auditoría y búsqueda global (Fase 5)
    // -------------------------------------------------------------------------
    async exportAudit({ search = '', module = 'all' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_export_audit', {
        p_search: search.trim() || null,
        p_module: module === 'all' ? null : module,
      });
      throwIfError(error, 'No se pudo exportar la auditoría.');

      const entries = asArray(data);
      const csv = buildCsv(
        [
          { key: 'fecha', label: 'fecha' },
          { key: 'actor', label: 'actor' },
          { key: 'rol', label: 'rol' },
          { key: 'accion', label: 'accion' },
          { key: 'modulo', label: 'modulo' },
          { key: 'entidad', label: 'entidad' },
          { key: 'entidadId', label: 'entidad_id' },
          { key: 'motivo', label: 'motivo' },
          { key: 'metadata', label: 'metadata' },
        ],
        entries.map((entry) => ({
          fecha: entry.createdAt,
          actor: entry.actorName || 'Sistema',
          rol: entry.actorRole || '',
          accion: entry.action,
          modulo: entry.module || '',
          entidad: entry.entityType || '',
          entidadId: entry.entityId || '',
          motivo: entry.reason || '',
          metadata: JSON.stringify(entry.metadata || {}),
        }))
      );

      return {
        filename: `auditoria-${csvDateStamp()}.csv`,
        csv,
        count: entries.length,
        generatedAt: new Date().toISOString(),
      };
    },

    async globalSearch({ query = '' } = {}) {
      const { data, error } = await insforge.database.rpc('admin_global_search', {
        p_query: String(query || '').trim(),
      });
      throwIfError(error, 'No se pudo realizar la búsqueda global.');

      const row = Array.isArray(data) ? data[0] : data;
      return {
        query: String(query || '').trim(),
        results: Array.isArray(row?.results) ? row.results : [],
        total: Number(row?.total || 0),
        truncated: Boolean(row?.truncated),
        minLength: 2,
      };
    },
  };

  return repository;
}
