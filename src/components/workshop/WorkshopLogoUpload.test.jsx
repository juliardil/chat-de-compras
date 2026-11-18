import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkshopLogoUpload from './WorkshopLogoUpload';

const { uploadLogo, saveWorkshopLogo, saveCommerceLogo } = vi.hoisted(() => ({
  uploadLogo: vi.fn(),
  saveWorkshopLogo: vi.fn(),
  saveCommerceLogo: vi.fn(),
}));

vi.mock('../../data/businessLogos', () => ({
  LOGO_NOTICES: { save: 'No se pudo guardar el logo.' },
  uploadLogo,
  saveWorkshopLogo,
  saveCommerceLogo,
}));

beforeEach(() => {
  vi.clearAllMocks();
  uploadLogo.mockResolvedValue({ url: 'https://cdn/logo.png', error: null });
  saveWorkshopLogo.mockResolvedValue({ ok: true, error: null });
  saveCommerceLogo.mockResolvedValue({ ok: true, error: null });
});

const logoFile = () => new File(['logo'], 'logo.png', { type: 'image/png' });

describe('cargador de logo del negocio', () => {
  it('sube el logo y guarda la URL del taller automáticamente', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <WorkshopLogoUpload userId="u-1" scope="workshop" name="motorcossio" />
    );

    await user.upload(container.querySelector('input[type="file"]'), logoFile());

    await waitFor(() => {
      expect(uploadLogo).toHaveBeenCalledWith({
        userId: 'u-1',
        scope: 'workshop',
        file: expect.any(File),
      });
      expect(saveWorkshopLogo).toHaveBeenCalledWith('https://cdn/logo.png');
    });
    expect(await screen.findByText('Logo actualizado.')).toBeInTheDocument();
  });

  it('guarda el logo del comercio con su RPC propia', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <WorkshopLogoUpload userId="u-2" scope="commerce" name="Mi Comercio" />
    );

    await user.upload(container.querySelector('input[type="file"]'), logoFile());

    await waitFor(() => expect(saveCommerceLogo).toHaveBeenCalledWith('https://cdn/logo.png'));
    expect(saveWorkshopLogo).not.toHaveBeenCalled();
  });

  it('muestra el error de validación sin intentar guardar', async () => {
    const user = userEvent.setup();
    uploadLogo.mockResolvedValue({ url: null, error: 'Usa una imagen JPG, PNG, WEBP o GIF.' });
    const { container } = render(<WorkshopLogoUpload userId="u-1" scope="workshop" />);

    await user.upload(container.querySelector('input[type="file"]'), logoFile());

    expect(await screen.findByRole('alert')).toHaveTextContent(/JPG, PNG, WEBP o GIF/);
    expect(saveWorkshopLogo).not.toHaveBeenCalled();
  });
});
