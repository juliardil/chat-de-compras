import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ALL_PERMISSION_KEYS,
  getPermissionsForRole,
  groupPermissionsByModule,
  hasPermission,
  PERMISSION_BY_KEY,
  ROLE_BY_KEY,
  ROLE_PERMISSIONS,
  ROLES,
} from './permissions';

const MIGRATION_PATH = path.resolve(
  globalThis.process.cwd(),
  'migrations/20261106000000_admin_foundation.sql'
);

const readMigration = () => readFileSync(MIGRATION_PATH, 'utf8');

const extractSeededPermissionKeys = (sql) => {
  const section = sql.split('insert into public.admin_permissions')[1] || '';
  const body = section.split('on conflict (key) do update')[0];
  return Array.from(body.matchAll(/\('([a-z0-9_.]+)',/g)).map((match) => match[1]);
};

const extractSeededRoleKeys = (sql) => {
  const section = sql.split('insert into public.admin_roles')[1] || '';
  const body = section.split('on conflict (key) do update')[0];
  return Array.from(body.matchAll(/\('([a-z_]+)',/g)).map((match) => match[1]);
};

describe('catálogo de permisos', () => {
  it('no tiene claves duplicadas', () => {
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(ALL_PERMISSION_KEYS.length);
  });

  it('indexa cada permiso por su clave', () => {
    ALL_PERMISSION_KEYS.forEach((key) => {
      expect(PERMISSION_BY_KEY[key]).toMatchObject({ key });
    });
  });

  it('define los siete roles del sistema', () => {
    expect(ROLES.map((role) => role.key).sort()).toEqual(
      ['admin', 'analyst', 'commerce_manager', 'finance', 'moderator', 'superadmin', 'support'].sort()
    );
  });

  it('solo usa permisos que existen en el catálogo', () => {
    Object.entries(ROLE_PERMISSIONS).forEach(([roleKey, permissions]) => {
      expect(ROLE_BY_KEY[roleKey], `rol ${roleKey} sin metadatos`).toBeTruthy();
      permissions.forEach((permission) => {
        expect(PERMISSION_BY_KEY[permission], `${roleKey} → ${permission}`).toBeTruthy();
      });
    });
  });

  it('da todos los permisos al superadministrador', () => {
    expect(getPermissionsForRole('superadmin').sort()).toEqual([...ALL_PERMISSION_KEYS].sort());
  });

  it('impide que el administrador general gestione personal o configuración sensible', () => {
    const admin = getPermissionsForRole('admin');
    expect(admin).not.toContain('staff.view');
    expect(admin).not.toContain('staff.invite');
    expect(admin).not.toContain('settings.update');
    expect(admin).not.toContain('payments.refund');
    expect(admin).toContain('users.view');
    expect(admin).toContain('audit.view');
  });

  it('limita al analista a lectura y exportación de métricas', () => {
    const analyst = getPermissionsForRole('analyst');
    expect(analyst).toContain('analytics.view');
    expect(analyst).toContain('analytics.export');
    expect(analyst).not.toContain('users.suspend');
    expect(analyst).not.toContain('commerce.approve');
    expect(analyst).not.toContain('staff.view');
  });

  it('no inventa permisos para roles desconocidos', () => {
    expect(getPermissionsForRole('inexistente')).toEqual([]);
  });
});

describe('hasPermission', () => {
  it('acepta cualquier petición vacía', () => {
    expect(hasPermission([], null)).toBe(true);
    expect(hasPermission([], undefined)).toBe(true);
  });

  it('comprueba pertenencia real', () => {
    expect(hasPermission(['users.view'], 'users.view')).toBe(true);
    expect(hasPermission(['users.view'], 'users.suspend')).toBe(false);
    expect(hasPermission(null, 'users.view')).toBe(false);
  });
});

describe('groupPermissionsByModule', () => {
  it('agrupa permisos válidos y descarta claves desconocidas', () => {
    const groups = groupPermissionsByModule(['users.view', 'users.suspend', 'no.existe']);
    const users = groups.find((group) => group.module === 'Compradores');

    expect(groups).toHaveLength(1);
    expect(users.permissions.map((permission) => permission.key)).toEqual([
      'users.view',
      'users.suspend',
    ]);
  });
});

describe('consistencia con la migración de Fase 1', () => {
  it('siembra exactamente los permisos del catálogo', () => {
    const seeded = extractSeededPermissionKeys(readMigration()).sort();
    expect(seeded).toEqual([...ALL_PERMISSION_KEYS].sort());
  });

  it('siembra exactamente los roles del catálogo', () => {
    const seeded = extractSeededRoleKeys(readMigration()).sort();
    expect(seeded).toEqual(ROLES.map((role) => role.key).sort());
  });
});
