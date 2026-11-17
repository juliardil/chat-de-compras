import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/insforge', () => ({
  insforge: { database: { rpc: vi.fn() } },
  isInsforgeConfigured: true,
  avatarsBucket: 'avatars',
}));

import { insforge } from '../lib/insforge';
import {
  createGroup,
  fetchGroupBadges,
  fetchMyGroup,
  joinGroup,
  leaveGroup,
} from './community';

const rpc = insforge.database.rpc;

beforeEach(() => {
  rpc.mockReset();
});

describe('capa de datos de comunidades', () => {
  it('lee el club propio con la RPC aislada', async () => {
    const group = { group_id: 'group-1', invite_code: 'ABC12345' };
    rpc.mockResolvedValue({ data: [group], error: null });

    const result = await fetchMyGroup();

    expect(rpc).toHaveBeenCalledWith('app_my_group');
    expect(result.items).toEqual([group]);
    expect(result.error).toBeNull();
  });

  it('crea un club enviando nombre y código opcional', async () => {
    rpc.mockResolvedValue({ data: [{ group_id: 'group-1' }], error: null });

    const result = await createGroup({ name: 'Club Norte', inviteCode: null });

    expect(rpc).toHaveBeenCalledWith('app_create_group', {
      p_name: 'Club Norte',
      p_invite_code: null,
    });
    expect(result.ok).toBe(true);
  });

  it('se une y sale usando sus RPCs dedicadas', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await joinGroup({ inviteCode: 'ABC12345' });
    await leaveGroup();

    expect(rpc).toHaveBeenNthCalledWith(1, 'app_join_group', {
      p_invite_code: 'ABC12345',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'app_leave_group');
  });

  it('no consulta insignias cuando no hay compradores', async () => {
    const result = await fetchGroupBadges([]);

    expect(rpc).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
  });

  it('deduce los identificadores antes de pedir insignias', async () => {
    rpc.mockResolvedValue({
      data: [{ user_id: 'buyer-1', group_name: 'Club Norte', member_count: 5 }],
      error: null,
    });

    const result = await fetchGroupBadges(['buyer-1', 'buyer-2', 'buyer-1']);

    expect(rpc).toHaveBeenCalledWith('app_group_badges', {
      p_buyer_ids: ['buyer-1', 'buyer-2'],
    });
    expect(result.items).toHaveLength(1);
  });
});
