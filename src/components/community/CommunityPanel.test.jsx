import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommunityPanel from './CommunityPanel';

vi.mock('../../data/community', () => ({
  fetchMyGroup: vi.fn(),
  createGroup: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
}));

import {
  createGroup,
  fetchMyGroup,
  joinGroup,
  leaveGroup,
} from '../../data/community';

beforeEach(() => {
  vi.clearAllMocks();
  fetchMyGroup.mockResolvedValue({ items: [], error: null, notice: null });
  createGroup.mockResolvedValue({ ok: true, error: null });
  joinGroup.mockResolvedValue({ ok: true, error: null });
  leaveGroup.mockResolvedValue({ ok: true, error: null });
});

describe('Mi Comunidad / Club', () => {
  it('muestra el club, su código y el progreso de miembros', async () => {
    fetchMyGroup.mockResolvedValue({
      items: [
        {
          group_id: 'group-1',
          name: 'Club Norte',
          invite_code: 'ABC12345',
          role: 'owner',
          member_count: 2,
          min_members: 5,
          is_owner: true,
          is_verified: false,
        },
      ],
      error: null,
      notice: null,
    });

    render(<CommunityPanel />);

    expect(await screen.findByText('Club Norte')).toBeInTheDocument();
    expect(screen.getByText('ABC12345')).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(screen.getByText(/faltan 3 miembros/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument();
  });

  it('permite crear un club desde el perfil', async () => {
    const user = userEvent.setup();
    fetchMyGroup
      .mockResolvedValueOnce({ items: [], error: null, notice: null })
      .mockResolvedValue({ items: [], error: null, notice: null });

    render(<CommunityPanel />);

    await user.type(await screen.findByLabelText('Nombre del club'), 'Club Sur');
    await user.click(screen.getByRole('button', { name: /crear club/i }));

    await waitFor(() => {
      expect(createGroup).toHaveBeenCalledWith({ name: 'Club Sur', inviteCode: null });
    });
  });

  it('permite unirse con un código de invitación', async () => {
    const user = userEvent.setup();
    fetchMyGroup.mockResolvedValue({ items: [], error: null, notice: null });

    render(<CommunityPanel />);

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

    render(<CommunityPanel />);

    await user.type(await screen.findByLabelText('Nombre del club'), 'Club Sur');
    await user.click(screen.getByRole('button', { name: /crear club/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese código ya está en uso.');
  });
});
