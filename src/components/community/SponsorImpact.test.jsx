import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SponsorImpact from './SponsorImpact';

vi.mock('../../data/clubAdvanced', () => ({ fetchSponsorImpact: vi.fn() }));

import { fetchSponsorImpact } from '../../data/clubAdvanced';

beforeEach(() => {
  vi.clearAllMocks();
  fetchSponsorImpact.mockResolvedValue({ items: [], error: null, notice: null });
});

describe('impacto de patrocinios aprobados', () => {
  it('muestra el logo, el beneficio y el descuento de la marca vinculada', async () => {
    fetchSponsorImpact.mockResolvedValue({
      items: [
        {
          sponsor_id: 's-1',
          brand_name: 'Refacciones Express',
          logo_url: 'https://cdn/express.png',
          benefit: '10% en refacciones',
          discount_percent: 10,
          group_name: 'Club Norte',
          club_buyers: 3,
          parts_orders: 7,
          service_orders: 2,
          total_orders: 9,
          purchase_amount: 1200,
        },
      ],
      error: null,
      notice: null,
    });

    render(<SponsorImpact />);

    expect(await screen.findByText('Refacciones Express')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Logo de Refacciones Express' })).toHaveAttribute(
      'src',
      'https://cdn/express.png'
    );
    expect(screen.getByText(/10% en refacciones/)).toBeInTheDocument();
    expect(screen.getByText(/10% de descuento/)).toBeInTheDocument();
  });

  it('usa iniciales cuando la marca aprobada todavía no tiene logo', async () => {
    fetchSponsorImpact.mockResolvedValue({
      items: [
        {
          sponsor_id: 's-2',
          brand_name: 'Lubricantes del Norte',
          logo_url: null,
          benefit: null,
          discount_percent: 0,
          group_name: null,
          club_buyers: 1,
          parts_orders: 0,
          service_orders: 1,
          purchase_amount: 0,
        },
      ],
      error: null,
      notice: null,
    });

    render(<SponsorImpact />);

    expect(await screen.findByRole('img', { name: 'Logo de Lubricantes del Norte' })).toHaveTextContent(
      'LD'
    );
  });
});
