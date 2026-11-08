import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, demoRepository } from './demoRepository';

const STORE_KEY = 'chat_compras_admin_demo_v1';

const loginAs = async (email) => demoRepository.login({ email, password: DEMO_PASSWORD });

const resetDemoStore = () => {
  localStorage.clear();
  demoRepository.getSession();
};

describe('repositorio de demostración', () => {
  beforeEach(() => {
    resetDemoStore();
  });

  it('siembra las cuentas de demostración y permite entrar con la contraseña correcta', async () => {
    const session = await loginAs('superadmin@demo.local');

    expect(session).toMatchObject({
      email: 'superadmin@demo.local',
      roleKey: 'superadmin',
      status: 'active',
    });
    expect(session.permissions).toContain('staff.roles.manage');
    expect(session.permissions.length).toBeGreaterThan(50);
  });

  it('expone cada rol de demostración con su propio conjunto de permisos', async () => {
    for (const account of DEMO_ACCOUNTS) {
      const session = await loginAs(account.email);
      expect(session.roleKey).toBe(account.roleKey);
      expect(session.permissions.length).toBeGreaterThan(0);
    }
  });

  it('rechaza contraseña incorrecta y correo desconocido', async () => {
    await expect(
      demoRepository.login({ email: 'admin@demo.local', password: 'incorrecta' })
    ).rejects.toThrow(/correo o contraseña/i);

    await expect(
      demoRepository.login({ email: 'nadie@demo.local', password: DEMO_PASSWORD })
    ).rejects.toThrow(/correo o contraseña/i);
  });

  it('persiste y cierra la sesión', async () => {
    await loginAs('analista@demo.local');
    const restored = await demoRepository.getSession();
    expect(restored?.email).toBe('analista@demo.local');

    await demoRepository.logout();
    expect(await demoRepository.getSession()).toBeNull();
  });

  it('no restaura la sesión de una cuenta suspendida', async () => {
    const admin = await loginAs('superadmin@demo.local');
    const members = await demoRepository.listMembers();
    const target = members.find((member) => member.email === 'soporte@demo.local');

    await demoRepository.setMemberStatus({
      memberId: target.id,
      status: 'suspended',
      reason: 'Prueba automatizada',
      actor: admin,
    });

    // Simula una pestaña que conservaba la sesión del miembro ahora suspendido.
    localStorage.setItem('chat_compras_admin_demo_session_v1', target.id);
    expect(await demoRepository.getSession()).toBeNull();

    await expect(loginAs('soporte@demo.local')).rejects.toThrow(/no está activa/i);
  });

  it('registra invitaciones con auditoría y evita duplicados', async () => {
    const admin = await loginAs('superadmin@demo.local');

    const invitation = await demoRepository.inviteMember({
      email: 'Nueva.Persona@Demo.Local',
      name: 'Nueva Persona',
      roleKey: 'moderator',
      actor: admin,
    });

    expect(invitation).toMatchObject({
      email: 'nueva.persona@demo.local',
      roleKey: 'moderator',
      status: 'pending',
    });

    await expect(
      demoRepository.inviteMember({
        email: 'nueva.persona@demo.local',
        name: 'Duplicada',
        roleKey: 'moderator',
        actor: admin,
      })
    ).rejects.toThrow(/invitación pendiente/i);

    const events = await demoRepository.listAudit({ search: 'nueva.persona' });
    expect(events.some((event) => event.action === 'staff.invite')).toBe(true);
  });

  it('valida correo y rol al invitar', async () => {
    const admin = await loginAs('superadmin@demo.local');

    await expect(
      demoRepository.inviteMember({ email: 'sin-arroba', name: '', roleKey: 'admin', actor: admin })
    ).rejects.toThrow(/correo válido/i);

    await expect(
      demoRepository.inviteMember({
        email: 'otra@demo.local',
        name: '',
        roleKey: 'inexistente',
        actor: admin,
      })
    ).rejects.toThrow(/rol/i);
  });

  it('exige motivo y prohíbe auto-suspensión', async () => {
    const admin = await loginAs('superadmin@demo.local');
    const members = await demoRepository.listMembers();
    const target = members.find((member) => member.email === 'admin@demo.local');

    await expect(
      demoRepository.setMemberStatus({
        memberId: target.id,
        status: 'suspended',
        reason: '',
        actor: admin,
      })
    ).rejects.toThrow(/motivo/i);

    await expect(
      demoRepository.setMemberStatus({
        memberId: admin.memberId,
        status: 'suspended',
        reason: 'Intento propio',
        actor: admin,
      })
    ).rejects.toThrow(/tu propia cuenta/i);
  });

  it('no permite suspender al último superadministrador activo', async () => {
    const admin = await loginAs('superadmin@demo.local');

    await expect(
      demoRepository.setMemberStatus({
        memberId: admin.memberId,
        status: 'suspended',
        reason: 'Prueba',
        actor: { ...admin, memberId: 'otro-actor' },
      })
    ).rejects.toThrow(/último superadministrador/i);
  });

  it('guarda los cambios en localStorage', async () => {
    const admin = await loginAs('superadmin@demo.local');
    const members = await demoRepository.listMembers();
    const target = members.find((member) => member.email === 'comercios@demo.local');

    await demoRepository.setMemberStatus({
      memberId: target.id,
      status: 'suspended',
      reason: 'Revisión de seguridad',
      actor: admin,
    });

    const stored = JSON.parse(localStorage.getItem(STORE_KEY));
    const storedTarget = stored.members.find((member) => member.email === 'comercios@demo.local');
    expect(storedTarget.status).toBe('suspended');
    expect(stored.audit[0].action).toBe('staff.suspend');
  });
});
