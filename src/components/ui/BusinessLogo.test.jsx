import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BusinessLogo from './BusinessLogo';

describe('BusinessLogo', () => {
  it('muestra iniciales cuando el negocio aún no tiene logo', () => {
    render(
      <BusinessLogo
        name="Taller Motorcossio"
        className="h-10 w-10"
        label="Logo de Taller Motorcossio"
      />
    );

    expect(screen.getByRole('img', { name: 'Logo de Taller Motorcossio' })).toHaveTextContent('TM');
  });

  it('muestra la imagen y su texto alternativo cuando hay URL', () => {
    render(
      <BusinessLogo
        src="https://cdn/logo-marca.png"
        name="Refacciones Express"
        label="Logo de Refacciones Express"
        className="h-10 w-10"
      />
    );

    expect(
      screen.getByRole('img', { name: 'Logo de Refacciones Express' })
    ).toHaveAttribute('src', 'https://cdn/logo-marca.png');
  });
});
