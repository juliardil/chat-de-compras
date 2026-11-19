// =============================================================================
// Capa de datos del inventario por negocio (migración 20261119165949).
//
// Todas las lecturas y escrituras pasan por RPC SECURITY DEFINER que
// comprueban la propiedad del negocio en servidor (RLS por commerce/taller).
// Contrato idéntico al resto de la capa: `{ items, error, notice }` para
// lecturas y `{ ok, data, error }` para escrituras.
//
// Las resincronizaciones SOLO tocan nombre/SKU/marca/categoría/descripción/
// bono/precio/stock/vigencia; foto, grupo de equivalencia y alternativas se
// guardan con RPC separados para que sobrevivan a cada importación.
// =============================================================================

import { runQuery, runWrite } from './appData';

export const INVENTORY_NOTICES = {
  load: 'No se pudieron cargar los productos de tu inventario.',
  source: 'No se pudo cargar la fuente configurada de tu inventario.',
  saveSource: 'No se pudo guardar la fuente del inventario.',
  sync: 'No se pudo sincronizar el inventario.',
  photo: 'No se pudo guardar la foto del producto.',
  group: 'No se pudo guardar el grupo de equivalencia.',
  alternatives: 'No se pudieron guardar las alternativas.',
};

const text = (value) => String(value ?? '').trim();
const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Acepta alternativas guardadas como objetos o como texto «Marca:precio».
export const normalizeInventoryAlternatives = (value) => {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const [brand, price] = entry.split(':');
        return {
          key: `alt-${index}`,
          brand: text(brand),
          price: text(price),
          photo: null,
          note: '',
        };
      }
      return {
        key: text(entry?.id || entry?.key) || `alt-${index}`,
        brand: text(entry?.brand || entry?.name),
        price: text(entry?.price),
        photo: text(entry?.photo || entry?.photo_url) || null,
        note: text(entry?.note),
      };
    })
    .filter((entry) => entry.brand);
};

// Normaliza una fila del RPC para que la interfaz siempre vea las mismas claves.
export const mapInventoryItem = (row = {}, index = 0) => ({
  id: text(row.id) || `inventory-${index}`,
  externalKey: text(row.external_key),
  sku: text(row.sku),
  name: text(row.name) || 'Producto',
  brand: text(row.brand),
  category: text(row.category),
  description: text(row.description),
  bonus: text(row.bonus),
  price: number(row.price),
  currency: text(row.currency) || 'MXN',
  stock: Math.max(0, Math.floor(number(row.stock))),
  photo: text(row.photo_url || row.photo) || null,
  equivalenceGroup: text(row.equivalence_group),
  alternatives: normalizeInventoryAlternatives(row.alternatives),
  isActive: row.is_active !== false,
  validUntil: text(row.valid_until) || null,
  updatedAt: text(row.updated_at) || null,
});

export const fetchMyInventory = (scope = null) =>
  runQuery((db) => db.rpc('app_my_business_inventory', { p_scope: scope || null }), INVENTORY_NOTICES.load);

export const fetchInventorySource = (scope = null) =>
  runQuery((db) => db.rpc('app_my_inventory_source', { p_scope: scope || null }), INVENTORY_NOTICES.source);

export const saveInventorySource = ({
  provider,
  sourceUrl = null,
  fileName = null,
  columnMapping = {},
  scope = null,
} = {}) =>
  runWrite(
    (db) =>
      db.rpc('app_save_inventory_source', {
        p_provider: provider,
        p_source_url: sourceUrl || null,
        p_file_name: fileName || null,
        p_column_mapping: columnMapping,
        p_scope: scope || null,
      }),
    INVENTORY_NOTICES.saveSource
  );

export const syncInventory = ({ items = [], sourceId = null, summary = {}, scope = null } = {}) =>
  runWrite(
    (db) =>
      db.rpc('app_sync_inventory', {
        p_items: items,
        p_source_id: sourceId || null,
        p_summary: summary,
        p_scope: scope || null,
      }),
    INVENTORY_NOTICES.sync
  );

export const setInventoryPhoto = (itemId, photoUrl) =>
  runWrite(
    (db) =>
      db.rpc('app_set_inventory_photo', {
        p_item_id: itemId,
        p_photo_url: photoUrl || null,
      }),
    INVENTORY_NOTICES.photo
  );

export const setInventoryGroup = (itemId, group) =>
  runWrite(
    (db) =>
      db.rpc('app_set_inventory_group', {
        p_item_id: itemId,
        p_group: group || null,
      }),
    INVENTORY_NOTICES.group
  );

export const setInventoryAlternatives = (itemId, alternatives) =>
  runWrite(
    (db) =>
      db.rpc('app_set_inventory_alternatives', {
        p_item_id: itemId,
        p_alternatives: Array.isArray(alternatives) ? alternatives : [],
      }),
    INVENTORY_NOTICES.alternatives
  );

export { uploadInventoryPhoto } from './appData';
