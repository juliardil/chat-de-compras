import { describe, expect, it } from 'vitest';
import { maskEmail, maskPhone, maskTaxId, maskText, slugify } from './mask';

describe('utilidades de enmascarado', () => {
  it('enmascara el correo conservando el dominio', () => {
    expect(maskEmail('valentina.rodriguez@demo.local')).toBe('v***@demo.local');
    expect(maskEmail('  ana@demo.local  ')).toBe('a***@demo.local');
  });

  it('devuelve un marcador cuando el correo no es válido o está vacío', () => {
    expect(maskEmail('')).toBe('—');
    expect(maskEmail(null)).toBe('—');
    expect(maskEmail('sin-arroba')).toBe('••••');
    expect(maskEmail('@demo.local')).toBe('••••');
  });

  it('enmascara el teléfono dejando los últimos cuatro dígitos', () => {
    expect(maskPhone('+58 412 555 0101')).toBe('•••• 0101');
    expect(maskPhone('(414) 555-0199')).toBe('•••• 0199');
    expect(maskPhone('')).toBe('—');
  });

  it('enmascara el identificador fiscal dejando cuatro caracteres', () => {
    expect(maskTaxId('J-40112233-4')).toBe('••••33-4');
    expect(maskTaxId('123456789')).toBe('••••6789');
    expect(maskTaxId('')).toBe('—');
  });

  it('oculta cualquier texto no vacío y marca los vacíos', () => {
    expect(maskText('dato sensible')).toBe('••••••');
    expect(maskText('   ')).toBe('—');
    expect(maskText(undefined)).toBe('—');
  });
});

describe('slugify', () => {
  it('normaliza acentos, espacios y mayúsculas', () => {
    expect(slugify('Suspensión y dirección')).toBe('suspension-y-direccion');
    expect(slugify('Discos de freno')).toBe('discos-de-freno');
  });

  it('elimina símbolos y guiones sobrantes', () => {
    expect(slugify('  ¡Ofertas & Promociones!  ')).toBe('ofertas-promociones');
    expect(slugify('--Categoría--')).toBe('categoria');
  });

  it('devuelve una cadena vacía para entradas sin contenido válido', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
    expect(slugify('###')).toBe('');
  });

  it('limita el resultado a 80 caracteres', () => {
    expect(slugify('a'.repeat(120))).toHaveLength(80);
  });
});
