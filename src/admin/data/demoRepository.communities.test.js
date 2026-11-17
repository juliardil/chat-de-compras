import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD, demoRepository } from './demoRepository';

const loginAs = async (email) => demoRepository.login({ email, password: DEMO_PASSWORD });

beforeEach(() => {
  localStorage.clear();
  demoRepository.getSession();
});

describe('repositorio de comunidades en demostración', () => {
  it('lista clubes con el mínimo vigente y calcula su verificación', async () => {
    const actor = await loginAs('superadmin@demo.local');

    const groups = await demoRepository.listGroups({ actor });

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      name: 'Club de repuestos del sur',
      inviteCode: 'DEMO7A2B',
      memberCount: 4,
      minMembers: 5,
      isVerified: false,
    });
  });

  it('audita los miembros de un club', async () => {
    const actor = await loginAs('superadmin@demo.local');
    const [group] = await demoRepository.listGroups({ actor });

    const detail = await demoRepository.getGroup({ groupId: group.id, actor });

    expect(detail.members).toHaveLength(4);
    expect(detail.members[0]).toMatchObject({ role: 'owner' });
    expect(detail.members.slice(1).every((member) => member.role === 'member')).toBe(true);
  });

  it('actualiza el mínimo y recalcula el estado de los clubes', async () => {
    const actor = await loginAs('superadmin@demo.local');

    const updated = await demoRepository.setGroupMinMembers({ minMembers: 4, actor });
    const groups = await demoRepository.listGroups({ actor });
    const settings = await demoRepository.getGroupSettings({ actor });

    expect(updated).toMatchObject({ minMembers: 4 });
    expect(settings.minMembers).toBe(4);
    expect(groups[0].isVerified).toBe(true);
  });

  it('niega la lectura y la configuración a roles sin permiso', async () => {
    const actor = await loginAs('soporte@demo.local');

    await expect(demoRepository.listGroups({ actor })).rejects.toThrow(/permiso/i);
    await expect(
      demoRepository.setGroupMinMembers({ minMembers: 3, actor })
    ).rejects.toThrow(/permiso/i);
  });

  it('rechaza mínimos fuera de rango', async () => {
    const actor = await loginAs('superadmin@demo.local');

    await expect(
      demoRepository.setGroupMinMembers({ minMembers: 0, actor })
    ).rejects.toThrow(/entre 1 y 1000/i);
  });
});
