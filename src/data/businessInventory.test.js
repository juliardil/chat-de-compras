import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simula un backend conectado para ejercitar los RPC sin red.
const harness = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../lib/insforge', () => ({
  isInsforgeConfigured: true,
  avatarsBucket: 'avatars',
  get insforge() {
    return { database: { rpc: harness.rpc } };
  },
}));

const {
  INVENTORY_NOTICES,
  fetchInventorySource,
  fetchMyInventory,
  mapInventoryItem,
  normalizeInventoryAlternatives,
  saveInventorySource,
  setInventoryAlternatives,
  setInventoryGroup,
  setInventoryPhoto,
  syncInventory,
} = await import('./businessInventory');

describe('capa de datos del inventario', () => {
  beforeEach(() => {
    harness.rpc.mockReset();
  });

  it('normaliza una fila del RPC con foto, bono y alternativas', () => {
    const mapped = mapInventoryItem({
      id: 7,
      name: '  Bafles Sony  ',
      price: '250.5',
      stock: '-3',
      currency: '',
      photo_url: '  https://cdn.example.com/bafles.jpg ',
      valid_until: '2026-12-31',
      bonus: ' Instalación gratis ',
      alternatives: [
        'Bosch:450',
        { id: 'monroe', brand: ' Monroe ', price: 520, photo_url: 'https://cdn.example.com/m.jpg' },
        { brand: '' },
      ],
    });

    expect(mapped).toMatchObject({
      id: '7',
      name: 'Bafles Sony',
      price: 250.5,
      stock: 0,
      currency: 'MXN',
      photo: 'https://cdn.example.com/bafles.jpg',
      validUntil: '2026-12-31',
      bonus: 'Instalación gratis',
      isActive: true,
    });
    expect(mapped.alternatives).toHaveLength(2);
    expect(mapped.alternatives[0]).toMatchObject({
      brand: 'Bosch',
      price: '450',
      photo: null,
    });
    expect(mapped.alternatives[1]).toMatchObject({
      brand: 'Monroe',
      price: '520',
      photo: 'https://cdn.example.com/m.jpg',
    });
  });

  it('normaliza alternativas guardadas como texto', () => {
    expect(normalizeInventoryAlternatives(['Bosch:450', ' Monroe : 520 '])).toEqual([
      { key: 'alt-0', brand: 'Bosch', price: '450', photo: null, note: '' },
      { key: 'alt-1', brand: 'Monroe', price: '520', photo: null, note: '' },
    ]);
  });

  it('consulta el inventario del negocio con el alcance indicado', async () => {
    harness.rpc.mockResolvedValue({ data: [{ id: 'inv-1' }], error: null });

    const result = await fetchMyInventory('commerce');

    expect(harness.rpc).toHaveBeenCalledWith('app_my_business_inventory', {
      p_scope: 'commerce',
    });
    expect(result).toEqual({ items: [{ id: 'inv-1' }], error: null, notice: null });
  });

  it('consulta la fuente configurada del inventario', async () => {
    harness.rpc.mockResolvedValue({ data: [], error: null });

    await fetchInventorySource();

    expect(harness.rpc).toHaveBeenCalledWith('app_my_inventory_source', {
      p_scope: null,
    });
  });

  it('guarda la fuente con su mapeo de columnas', async () => {
    harness.rpc.mockResolvedValue({ data: [{ id: 'source-1' }], error: null });

    const result = await saveInventorySource({
      provider: 'sheets',
      sourceUrl: 'https://docs.google.com/spreadsheets/d/abc',
      fileName: 'inventario',
      columnMapping: { name: 'Producto', price: 'Precio' },
    });

    expect(harness.rpc).toHaveBeenCalledWith('app_save_inventory_source', {
      p_provider: 'sheets',
      p_source_url: 'https://docs.google.com/spreadsheets/d/abc',
      p_file_name: 'inventario',
      p_column_mapping: { name: 'Producto', price: 'Precio' },
      p_scope: null,
    });
    expect(result).toEqual({ ok: true, data: [{ id: 'source-1' }], error: null });
  });

  it('sincroniza productos sin tocar foto, grupo ni alternativas', async () => {
    harness.rpc.mockResolvedValue({ data: [{ inserted: 1, updated: 2 }], error: null });

    const result = await syncInventory({
      items: [{ name: 'Bafles', price: 250, stock: 3 }],
      sourceId: 'source-1',
      summary: { skipped: 1 },
    });

    expect(harness.rpc).toHaveBeenCalledWith('app_sync_inventory', {
      p_items: [{ name: 'Bafles', price: 250, stock: 3 }],
      p_source_id: 'source-1',
      p_summary: { skipped: 1 },
      p_scope: null,
    });
    expect(result.ok).toBe(true);
  });

  it('guarda foto, grupo y alternativas con RPC separados', async () => {
    harness.rpc.mockResolvedValue({ data: null, error: null });

    await setInventoryPhoto('inv-1', 'https://cdn.example.com/bafles.jpg');
    await setInventoryGroup('inv-1', 'audio');
    await setInventoryAlternatives('inv-1', null);

    expect(harness.rpc).toHaveBeenNthCalledWith(1, 'app_set_inventory_photo', {
      p_item_id: 'inv-1',
      p_photo_url: 'https://cdn.example.com/bafles.jpg',
    });
    expect(harness.rpc).toHaveBeenNthCalledWith(2, 'app_set_inventory_group', {
      p_item_id: 'inv-1',
      p_group: 'audio',
    });
    expect(harness.rpc).toHaveBeenNthCalledWith(3, 'app_set_inventory_alternatives', {
      p_item_id: 'inv-1',
      p_alternatives: [],
    });
  });

  it('devuelve el mensaje amigable cuando el backend rechaza una lectura', async () => {
    harness.rpc.mockResolvedValue({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });

    const result = await fetchMyInventory();

    expect(result.items).toEqual([]);
    expect(result.error).toBeTruthy();
    expect(result.error).not.toBe(INVENTORY_NOTICES.load);
  });
});
