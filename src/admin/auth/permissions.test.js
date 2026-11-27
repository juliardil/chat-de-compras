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

const MIGRATIONS_DIR = path.resolve(globalThis.process.cwd(), 'migrations');
const FOUNDATION_MIGRATION = path.resolve(
  MIGRATIONS_DIR,
  '20261106000000_admin-foundation.sql'
);
const COMMUNITIES_MIGRATION = path.resolve(
  MIGRATIONS_DIR,
  '20261117020000_groups-communities.sql'
);
const WORKSHOPS_MIGRATION = path.resolve(
  MIGRATIONS_DIR,
  '20261117050000_workshops-services-b2b.sql'
);
const SPONSORSHIPS_MIGRATION = path.resolve(
  MIGRATIONS_DIR,
  '20261117170000_clubs-sponsorships-advanced.sql'
);
const SELLERS_MIGRATION = path.resolve(
  MIGRATIONS_DIR,
  '20261124181652_admin-sellers.sql'
);
const HARDENING_MIGRATION = path.resolve(
  MIGRATIONS_DIR,
  '20261127162416_security-hardening.sql'
);
const ADS_MIGRATION = path.resolve(
  MIGRATIONS_DIR,
  '20261127165029_ads-module.sql'
);

const readMigration = (migrationPath) => readFileSync(migrationPath, 'utf8');

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

  it('permite gestionar vendedores solo a los roles operativos autorizados', () => {
    expect(getPermissionsForRole('commerce_manager')).toEqual(
      expect.arrayContaining(['sellers.view', 'sellers.manage', 'audit.view'])
    );
    expect(getPermissionsForRole('commerce_manager')).not.toContain('audit.export');
    expect(getPermissionsForRole('moderator')).toEqual(
      expect.arrayContaining(['sellers.view'])
    );
    expect(getPermissionsForRole('moderator')).not.toContain('sellers.manage');
    expect(getPermissionsForRole('analyst')).toContain('sellers.view');
    expect(getPermissionsForRole('analyst')).not.toContain('sellers.manage');
    expect(getPermissionsForRole('support')).not.toContain('sellers.view');
  });

  it('reserva la gestión de publicidad a los roles operativos', () => {
    expect(getPermissionsForRole('admin')).toEqual(
      expect.arrayContaining(['ads.view', 'ads.manage'])
    );
    expect(getPermissionsForRole('commerce_manager')).toEqual(
      expect.arrayContaining(['ads.view', 'ads.manage'])
    );
    expect(getPermissionsForRole('analyst')).toContain('ads.view');
    expect(getPermissionsForRole('analyst')).not.toContain('ads.manage');
    expect(getPermissionsForRole('support')).not.toContain('ads.view');
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
    // El catálogo se siembra en la fundación y se amplía por fases.
    const seeded = [
      FOUNDATION_MIGRATION,
      COMMUNITIES_MIGRATION,
      WORKSHOPS_MIGRATION,
      SPONSORSHIPS_MIGRATION,
      SELLERS_MIGRATION,
      ADS_MIGRATION,
    ]
      .flatMap((migrationPath) => extractSeededPermissionKeys(readMigration(migrationPath)))
      .sort();
    expect(seeded).toEqual([...ALL_PERMISSION_KEYS].sort());
  });

  it('siembra exactamente los roles del catálogo', () => {
    const seeded = extractSeededRoleKeys(readMigration(FOUNDATION_MIGRATION)).sort();
    expect(seeded).toEqual(ROLES.map((role) => role.key).sort());
  });

  it('siembra los permisos de publicidad con los mismos roles que el frontend', () => {
    const sql = readMigration(ADS_MIGRATION);
    expect(extractSeededPermissionKeys(sql).sort()).toEqual(['ads.manage', 'ads.view']);
    expect(sql).toMatch(/r\.key in \('superadmin', 'admin', 'commerce_manager'\)/);
    expect(sql).toMatch(/r\.key = 'analyst'/);
    expect(sql).toMatch(/p\.key in \('ads\.view', 'ads\.manage'\)/);
    expect(sql).toMatch(/p\.key = 'ads\.view'/);
  });
});

describe('hardening de seguridad (Bloque 2)', () => {
  const hardeningSql = readMigration(HARDENING_MIGRATION);

  it('fija search_path en todas las RPC SECURITY DEFINER sin reescribir cuerpos', () => {
    expect(hardeningSql).toMatch(/p\.prosecdef/);
    expect(hardeningSql).toMatch(
      /alter function %s set search_path = pg_catalog, public, pg_temp/
    );
    // No se reemplaza ninguna función: solo se altera proconfig de forma
    // idempotente y repetible.
    expect(hardeningSql).not.toMatch(/create or replace function public\.admin_/);
  });

  it('da audit.view a commerce_manager en SQL con el mismo significado que en el frontend', () => {
    expect(hardeningSql).toMatch(/values \('audit\.view'/);
    expect(hardeningSql).toMatch(/r\.key = 'commerce_manager'/);
    expect(hardeningSql).not.toMatch(/r\.key = 'commerce_manager'[\s\S]*audit\.export/);
    expect(getPermissionsForRole('commerce_manager')).toContain('audit.view');
    expect(getPermissionsForRole('commerce_manager')).not.toContain('audit.export');
  });
});
