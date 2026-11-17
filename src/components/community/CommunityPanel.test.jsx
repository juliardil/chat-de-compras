import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommunityPanel from './CommunityPanel';

vi.mock('../../data/community', () => ({
  fetchMyGroup: vi.fn(),
  createGroup: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
}));

vi.mock('../../data/clubAdvanced', () => ({
  fetchClubIdentity: vi.fn(),
  fetchClubMembers: vi.fn(),
  fetchClubSponsors: vi.fn(),
}));

import {
  createGroup,
  fetchMyGroup,
  joinGroup,
  leaveGroup,
} from '../../data/community';
import {
  fetchClubIdentity,
  fetchClubMembers,
  fetchClubSponsors,
} from '../../data/clubAdvanced';

const renderPanel = () =>
  render(
    <MemoryRouter>
      <CommunityPanel />
    </MemoryRouter>
  );

const groupFixture = {
  group_id: 'group-1',
  name: 'Club Norte',
  invite_code: 'ABC12345',
  role: 'owner',
  member_count: 2,
  min_members: 5,
  is_owner: true,
  is_verified: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchMyGroup.mockResolvedValue({ items: [], error: null, notice: null });
  createGroup.mockResolvedValue({ ok: true, error: null });
  joinGroup.mockResolvedValue({ ok: true, error: null });
  leaveGroup.mockResolvedValue({ ok: true, error: null });
  fetchClubIdentity.mockResolvedValue({ items: [], error: null, notice: null });
  fetchClubMembers.mockResolvedValue({ items: [], error: null, notice: null });
  fetchClubSponsors.mockResolvedValue({ items: [], error: null, notice: null });
});

describe('Mi Comunidad / Club', () => {
  it('muestra el club, su código y el progreso de miembros', async () => {
    fetchMyGroup.mockResolvedValue({
      items: [groupFixture],
      error: null,
      notice: null,
    });

    renderPanel();

    expect(await screen.findByText('Club Norte')).toBeInTheDocument();
    expect(screen.getByText('ABC12345')).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(screen.getByText(/faltan 3 miembros/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver miembros/i })).toBeInTheDocument();
  });

  it('muestra los beneficios de las marcas en círculos junto a la identidad visual', async () => {
    const user = userEvent.setup();
    fetchMyGroup.mockResolvedValue({
      items: [groupFixture],
      error: null,
      notice: null,
    });
    fetchClubSponsors.mockResolvedValue({
      items: [
        {
          id: 'sponsor-1',
          brand_name: 'Llantas Express',
          logo_url: null,
          benefit: '20% en llantas para miembros',
          discount_percent: 20,
          lifecycle_status: 'active',
        },
      ],
      error: null,
      notice: null,
    });

    renderPanel();

    await user.click(
      await screen.findByRole('button', { name: /ver beneficio de llantas express/i })
    );

    expect(screen.getByRole('dialog')).toHaveTextContent('20% en llantas para miembros');
    expect(screen.getByRole('dialog')).toHaveTextContent('20% de descuento para miembros');
  });

  it('abre el modal de miembros con nombres y roles reales', async () => {
    const user = userEvent.setup();
    fetchMyGroup.mockResolvedValue({
      items: [groupFixture],
      error: null,
      notice: null,
    });
    fetchClubMembers.mockResolvedValue({
      items: [
        {
          user_id: 'user-1',
          display_name: 'Fernando Vargas',
          avatar_url: null,
          role: 'owner',
          is_me: true,
        },
        {
          user_id: 'user-2',
          display_name: 'Julia Pérez',
          avatar_url: null,
          role: 'member',
          is_me: false,
        },
      ],
      error: null,
      notice: null,
    });

    renderPanel();

    await user.click(await screen.findByRole('button', { name: /ver miembros/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Fernando Vargas');
    expect(dialog).toHaveTextContent('Responsable');
    expect(dialog).toHaveTextContent('Julia Pérez');
    expect(dialog).toHaveTextContent('Miembro');
  });

  it('ofrece acceso directo a la pantalla de chat del club', async () => {
    fetchMyGroup.mockResolvedValue({
      items: [groupFixture],
      error: null,
      notice: null,
    });

    renderPanel();

    expect(await screen.findByRole('button', { name: /chat del club/i })).toBeInTheDocument();
    expect(screen.queryByText('Chat interno del club')).not.toBeInTheDocument();
    expect(screen.queryByText('Actividades y rodadas')).not.toBeInTheDocument();
  });

  it('permite crear un club desde el perfil', async () => {
    const user = userEvent.setup();
    fetchMyGroup
      .mockResolvedValueOnce({ items: [], error: null, notice: null })
      .mockResolvedValue({ items: [], error: null, notice: null });

    renderPanel();

    await user.type(await screen.findByLabelText('Nombre del club'), 'Club Sur');
    await user.click(screen.getByRole('button', { name: /crear club/i }));

    await waitFor(() => {
      expect(createGroup).toHaveBeenCalledWith({ name: 'Club Sur', inviteCode: null });
    });
  });

  it('permite unirse con un código de invitación', async () => {
    const user = userEvent.setup();
    fetchMyGroup.mockResolvedValue({ items: [], error: null, notice: null });

    renderPanel();

    await user.click(await screen.findByRole('tab', { name: /unirme con código/i }));
    await user.type(screen.getByLabelText('Código de invitación'), 'abc12345');
    await user.click(screen.getByRole('button', { name: /unirme al club/i }));

    await waitFor(() => {
      expect(joinGroup).toHaveBeenCalledWith({ inviteCode: 'ABC12345' });
    });
  });

  it('muestra el error devuelto por la RPC', async () => {
    const user = userEvent.setup();
    createGroup.mockResolvedValue({ ok: false, error: 'Ese código ya está en uso.' });

    renderPanel();

    await user.type(await screen.findByLabelText('Nombre del club'), 'Club Sur');
    await user.click(screen.getByRole('button', { name: /crear club/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese código ya está en uso.');
  });
});
