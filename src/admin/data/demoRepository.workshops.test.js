import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD, demoRepository } from './demoRepository';

const loginAs = async (email) => demoRepository.login({ email, password: DEMO_PASSWORD });

beforeEach(() => {
  localStorage.clear();
  demoRepository.getSession();
});

describe('repositorio de talleres verificados en demostración', () => {
  it('lista los talleres con nombre, NIT, dirección, teléfono y especialidades', async () => {
    const actor = await loginAs('superadmin@demo.local');

    const workshops = await demoRepository.listWorkshops({ actor });

    expect(workshops).toHaveLength(3);
    expect(workshops[0]).toMatchObject({
      workshopName: expect.any(String),
      nitOrId: expect.any(String),
      address: expect.any(String),
      phone: expect.any(String),
      specialties: expect.any(Array),
      isVerified: expect.any(Boolean),
      createdAt: expect.any(String),
    });
  });

  it('busca por NIT/Cédula o especialidad', async () => {
    const actor = await loginAs('superadmin@demo.local');

    const byNit = await demoRepository.listWorkshops({ search: 'RFC-EANR', actor });
    const bySpecialty = await demoRepository.listWorkshops({ search: 'Electricidad', actor });

    expect(byNit).toHaveLength(1);
    expect(byNit[0].workshopName).toBe('Electro Auto Norte');
    expect(bySpecialty.map((item) => item.workshopName)).toContain('Electro Auto Norte');
  });

  it('activa y revoca la verificación dejando rastro de auditoría', async () => {
    const actor = await loginAs('superadmin@demo.local');

    const activated = await demoRepository.setWorkshopVerification({
      workshopId: 'demo-workshop-2',
      isVerified: true,
      actor,
    });
    expect(activated).toMatchObject({ id: 'demo-workshop-2', isVerified: true });

    const revoked = await demoRepository.setWorkshopVerification({
      workshopId: 'demo-workshop-1',
      isVerified: false,
      actor,
    });
    expect(revoked).toMatchObject({ id: 'demo-workshop-1', isVerified: false });

    const audit = await demoRepository.listAudit({ module: 'Talleres Verificados' });
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['workshops.verify', 'workshops.revoke'])
    );
  });

  it('permite la lectura a soporte pero no cambiar la verificación', async () => {
    const actor = await loginAs('soporte@demo.local');

    expect(await demoRepository.listWorkshops({ actor })).toHaveLength(3);
    await expect(
      demoRepository.setWorkshopVerification({
        workshopId: 'demo-workshop-2',
        isVerified: true,
        actor,
      })
    ).rejects.toThrow(/permiso/i);
  });
});
