import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD, demoRepository } from './demoRepository';

const loginAs = async (email) => demoRepository.login({ email, password: DEMO_PASSWORD });

beforeEach(() => {
  localStorage.clear();
  demoRepository.getSession();
});

describe('repositorio de patrocinios en demostración', () => {
  it('lista tarifas sembradas y calcula la vigencia de cada marca', async () => {
    const actor = await loginAs('superadmin@demo.local');

    const rates = await demoRepository.listSponsorshipRates({ actor });
    expect(rates.map((rate) => rate.code)).toEqual([
      'club_basic',
      'club_pro',
      'club_rodada',
    ]);

    const sponsors = await demoRepository.listClubSponsors({ actor });
    const byId = Object.fromEntries(sponsors.map((sponsor) => [sponsor.id, sponsor]));

    expect(byId['demo-sponsor-1'].lifecycleStatus).toBe('active');
    expect(byId['demo-sponsor-2'].lifecycleStatus).toBe('expiring');
    expect(byId['demo-sponsor-3'].lifecycleStatus).toBe('pending');
    expect(byId['demo-sponsor-4'].lifecycleStatus).toBe('rejected');
    expect(byId['demo-sponsor-5'].lifecycleStatus).toBe('expired');

    const pending = await demoRepository.listClubSponsors({ actor, status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0].brandName).toBe('Lubricantes del Norte');
  });

  it('guarda tarifas, aprueba marcas y deja auditoría local', async () => {
    const actor = await loginAs('superadmin@demo.local');

    const rate = await demoRepository.saveSponsorshipRate({
      code: 'club_gold',
      name: 'Patrocinio Gold',
      amount: 2499,
      currency: 'MXN',
      billingCycle: 'monthly',
      description: 'Incluye reporte de impacto',
      isActive: true,
      actor,
    });
    expect(rate).toMatchObject({ code: 'club_gold', amount: 2499 });

    const approved = await demoRepository.setClubSponsorStatus({
      id: 'demo-sponsor-3',
      status: 'approved',
      reason: 'Marca verificada',
      actor,
    });
    expect(approved).toMatchObject({
      moderationStatus: 'approved',
      lifecycleStatus: 'scheduled',
    });

    const audit = await demoRepository.listAudit({ actor });
    expect(audit.some((entry) => entry.action === 'sponsorships.rate.create')).toBe(true);
    expect(audit.some((entry) => entry.action === 'sponsorships.brand.approve')).toBe(true);
  });

  it('respeta los permisos de gestión y de finanzas', async () => {
    const analyst = await loginAs('analista@demo.local');

    await expect(
      demoRepository.saveSponsorshipRate({
        code: 'club_gold',
        name: 'Patrocinio Gold',
        amount: 2499,
        currency: 'MXN',
        billingCycle: 'monthly',
        actor: analyst,
      })
    ).rejects.toThrow(/permiso/i);

    const overview = await demoRepository.getSponsorshipOverview({ actor: analyst });
    expect(overview.totalRevenue).toBeGreaterThan(0);
    expect(overview.pendingBrands).toBe(1);

    const impact = await demoRepository.getSponsorImpactReport({ actor: analyst });
    expect(impact.length).toBe(5);
    expect(impact.some((row) => row.totalOrders > 0)).toBe(true);
  });
});
