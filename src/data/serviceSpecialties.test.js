import { describe, expect, it } from 'vitest';
import { WORKSHOP_SPECIALTIES } from './workshop';
import { findSpecialtyMatches, suggestServiceSpecialty } from './serviceSpecialties';

describe('sugerencia de especialidad de servicio', () => {
  it('preselecciona la especialidad cuando hay una coincidencia clara', () => {
    expect(
      suggestServiceSpecialty('El vehículo hace ruido al frenar; requiero cambiar pastillas')
    ).toBe('Frenos');
    expect(suggestServiceSpecialty('No enfría el aire acondicionado')).toBe('Aire acondicionado');
    expect(suggestServiceSpecialty('Se rompió el amortiguador trasero')).toBe('Suspensión');
  });

  it('ignora mayúsculas y acentos', () => {
    expect(suggestServiceSpecialty('FALLÓ LA BATERÍA')).toBe('Electricidad');
    expect(suggestServiceSpecialty('Necesito enderezado por un golpe')).toBe('Latonería');
  });

  it('no adivina cuando dos especialidades coinciden', () => {
    const description = 'Tengo ruido al frenar y también necesito revisar la suspensión';
    expect(findSpecialtyMatches(description)).toEqual(['Frenos', 'Suspensión']);
    expect(suggestServiceSpecialty(description)).toBeNull();
  });

  it('no sugiere nada cuando la descripción no tiene coincidencia', () => {
    expect(suggestServiceSpecialty('Revisar el vehículo en general')).toBeNull();
    expect(suggestServiceSpecialty('')).toBeNull();
    expect(suggestServiceSpecialty(null)).toBeNull();
  });

  it('solo devuelve especialidades del catálogo del taller', () => {
    const matches = findSpecialtyMatches('frenos, moto y sensor');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((specialty) => WORKSHOP_SPECIALTIES.includes(specialty))).toBe(true);
  });

  it('no confunde "moto" con "motor"', () => {
    expect(findSpecialtyMatches('El motor hace un ruido extraño')).toEqual(['Mecánica general']);
  });
});
