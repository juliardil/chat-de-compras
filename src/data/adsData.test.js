import { beforeEach, describe, expect, it, vi } from 'vitest';

// Contrato de datos del carrusel con InsForge simulado: solo lectura/escritura
// contra RPC, sin crear campañas reales ni modificar el proyecto.
const harness = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../lib/insforge', () => ({
  isInsforgeConfigured: true,
  avatarsBucket: 'avatars',
  get insforge() {
    return { database: { rpc: harness.rpc } };
  },
}));

import { fetchActiveAds, recordAdClick, recordAdImpression } from './appData';

beforeEach(() => {
  harness.rpc.mockReset();
});

describe('datos del carrusel de publicidad', () => {
  it('consulta la RPC de vigentes y normaliza la vigencia sin inventar campañas', async () => {
    harness.rpc.mockResolvedValue({
      data: [{
        id: 'ad-1',
        name: 'Campaña automotriz',
        headline: 'Autos verificados',
        description: 'Solo campañas vigentes',
        image_url: 'https://cdn.example.com/banner.png',
        cta_label: 'Ver más',
        target_path: '/request',
        starts_at: '2026-12-01T10:00:00.000Z',
        ends_at: '2026-12-31T10:00:00.000Z',
      }],
      error: null,
    });

    const result = await fetchActiveAds();
    expect(harness.rpc).toHaveBeenCalledWith('app_active_ads');
    expect(result.items).toEqual([{
      id: 'ad-1',
      name: 'Campaña automotriz',
      headline: 'Autos verificados',
      description: 'Solo campañas vigentes',
      imageUrl: 'https://cdn.example.com/banner.png',
      ctaLabel: 'Ver más',
      targetPath: '/request',
      startsAt: '2026-12-01T10:00:00.000Z',
      endsAt: '2026-12-31T10:00:00.000Z',
    }]);

    harness.rpc.mockResolvedValue({ data: null, error: { message: 'sin acceso' } });
    const failed = await fetchActiveAds();
    expect(failed.items).toEqual([]);
    expect(failed.error).toBeTruthy();
  });

  it('registra impresiones y clics por campaña con la clave de visitante', async () => {
    harness.rpc.mockResolvedValue({ data: [{ recorded: true }], error: null });

    expect((await recordAdImpression('ad-1', 'viewer-key-1234')).ok).toBe(true);
    expect(harness.rpc).toHaveBeenCalledWith('app_record_ad_impression', {
      p_campaign_id: 'ad-1',
      p_viewer_key: 'viewer-key-1234',
    });

    expect((await recordAdClick('ad-1', 'viewer-key-1234')).ok).toBe(true);
    expect(harness.rpc).toHaveBeenCalledWith('app_record_ad_click', {
      p_campaign_id: 'ad-1',
      p_viewer_key: 'viewer-key-1234',
    });

    harness.rpc.mockClear();
    expect(await recordAdImpression(null, 'viewer-key-1234')).toMatchObject({ ok: false });
    expect(harness.rpc).not.toHaveBeenCalled();
  });
});
