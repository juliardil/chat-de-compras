import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD, demoRepository } from './demoRepository';

const loginAs = async (email) => demoRepository.login({ email, password: DEMO_PASSWORD });

beforeEach(() => {
  localStorage.clear();
  demoRepository.getSession();
});

describe('repositorio de publicidad en demostración', () => {
  it('lista campañas con vigencia calculada y métricas reales de semilla', async () => {
    const actor = await loginAs('superadmin@demo.local');

    const campaigns = await demoRepository.listAdCampaigns({ actor });
    const byId = Object.fromEntries(campaigns.map((campaign) => [campaign.id, campaign]));

    expect(byId['demo-ad-1'].lifecycleStatus).toBe('active');
    expect(byId['demo-ad-2'].lifecycleStatus).toBe('active');
    expect(byId['demo-ad-3'].lifecycleStatus).toBe('paused');
    expect(byId['demo-ad-4'].lifecycleStatus).toBe('scheduled');
    expect(byId['demo-ad-5'].lifecycleStatus).toBe('exhausted');
    expect(byId['demo-ad-2'].remainingImpressions).toBe(16);

    const active = await demoRepository.listAdCampaigns({ actor, status: 'active' });
    expect(active.map((campaign) => campaign.id)).toEqual(['demo-ad-1', 'demo-ad-2']);

    const overview = await demoRepository.getAdsOverview({ actor });
    expect(overview).toMatchObject({
      totalCampaigns: 5,
      activeCampaigns: 2,
      pausedCampaigns: 1,
      scheduledCampaigns: 1,
      exhaustedCampaigns: 1,
    });

    const report = await demoRepository.getAdPerformanceReport({ actor });
    expect(report).toHaveLength(5);
    expect(report.find((row) => row.campaignId === 'demo-ad-2').ctr).toBeGreaterThan(0);
  });

  it('crea, edita y pausa campañas dejando auditoría local', async () => {
    const actor = await loginAs('admin@demo.local');

    const created = await demoRepository.saveAdCampaign({
      name: 'Campaña nueva',
      headline: 'Autos verificados',
      description: 'Solo talleres verificados',
      imageUrl: 'https://cdn.example.com/banner.png',
      ctaLabel: 'Cotizar',
      targetPath: '/request',
      startsAt: null,
      endsAt: null,
      impressionLimit: 100,
      sortOrder: 9,
      isActive: true,
      actor,
    });
    expect(created).toMatchObject({ name: 'Campaña nueva', lifecycleStatus: 'active' });

    const updated = await demoRepository.saveAdCampaign({
      ...created,
      headline: 'Autos y motos verificados',
      actor,
    });
    expect(updated.headline).toBe('Autos y motos verificados');
    expect(updated.impressionsCount).toBe(0);

    const paused = await demoRepository.setAdCampaignStatus({
      id: created.id,
      isActive: false,
      reason: 'Cambio de programación',
      actor,
    });
    expect(paused.lifecycleStatus).toBe('paused');

    const audit = await demoRepository.listAudit({ actor });
    expect(audit.some((entry) => entry.action === 'ads.campaign.create')).toBe(true);
    expect(audit.some((entry) => entry.action === 'ads.campaign.update')).toBe(true);
    expect(audit.some((entry) => entry.action === 'ads.campaign.pause')).toBe(true);
  });

  it('exige permiso de gestión y motivo para pausar', async () => {
    const analyst = await loginAs('analista@demo.local');
    const support = await loginAs('soporte@demo.local');

    expect(await demoRepository.listAdCampaigns({ actor: analyst })).toHaveLength(5);

    await expect(
      demoRepository.saveAdCampaign({
        name: 'Campaña sin permiso',
        headline: 'Sin permiso',
        imageUrl: 'https://cdn.example.com/banner.png',
        actor: analyst,
      })
    ).rejects.toThrow(/permiso/i);

    await expect(
      demoRepository.setAdCampaignStatus({
        id: 'demo-ad-1',
        isActive: false,
        reason: '',
        actor: support,
      })
    ).rejects.toThrow(/permiso/i);

    const admin = await loginAs('superadmin@demo.local');
    await expect(
      demoRepository.setAdCampaignStatus({
        id: 'demo-ad-1',
        isActive: false,
        reason: '',
        actor: admin,
      })
    ).rejects.toThrow(/motivo/i);
  });
});
