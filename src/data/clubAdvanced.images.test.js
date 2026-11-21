import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, upload } = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn() }));

vi.mock('../lib/insforge', () => ({
  insforge: {
    database: { rpc },
    storage: { from: vi.fn(() => ({ upload })) },
  },
  isInsforgeConfigured: true,
  avatarsBucket: 'avatars',
}));

import { insforge } from '../lib/insforge';
import {
  createClubEvent,
  sendClubMessage,
  uploadClubImage,
  validateClubImage,
} from './clubAdvanced';

const png = (size = 1024) => ({ name: 'flyer.png', type: 'image/png', size });

beforeEach(() => {
  rpc.mockReset();
  upload.mockReset();
  insforge.storage.from.mockReset();
  insforge.storage.from.mockReturnValue({ upload });
});

describe('imágenes del club', () => {
  it('acepta JPG, PNG y WEBP de hasta 5 MB', () => {
    expect(validateClubImage(png())).toBeNull();
    expect(
      validateClubImage({ name: 'flyer.jpg', type: 'image/jpeg', size: 1024 })
    ).toBeNull();
    expect(
      validateClubImage({ name: 'flyer.webp', type: 'image/webp', size: 1024 })
    ).toBeNull();
  });

  it('rechaza GIF y archivos mayores a 5 MB', () => {
    expect(validateClubImage({ name: 'flyer.gif', type: 'image/gif', size: 10 })).toMatch(
      /JPG, PNG o WEBP/i
    );
    expect(validateClubImage(png(5 * 1024 * 1024 + 1))).toMatch(/5 MB/i);
  });

  it('sube flyers a clubs/{groupId}/events validando pertenencia', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    upload.mockResolvedValue({ data: { url: 'https://cdn.test/flyer.png' }, error: null });

    const result = await uploadClubImage({ groupId: 'group-1', file: png(), kind: 'events' });

    expect(rpc).toHaveBeenCalledWith('app_group_can_upload_image', { p_group_id: 'group-1' });
    expect(insforge.storage.from).toHaveBeenCalledWith('avatars');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0]).toMatch(/^clubs\/group-1\/events\/image-.+\.png$/);
    expect(result).toMatchObject({ url: 'https://cdn.test/flyer.png', error: null });
  });

  it('sube fotos del chat a clubs/{groupId}/chat', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    upload.mockResolvedValue({ data: { url: 'https://cdn.test/chat.png' }, error: null });

    await uploadClubImage({ groupId: 'group-1', file: png(), kind: 'chat' });

    expect(upload.mock.calls[0][0]).toMatch(/^clubs\/group-1\/chat\/image-.+\.png$/);
  });

  it('no sube nada si la RPC rechaza la pertenencia al club', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const result = await uploadClubImage({ groupId: 'group-1', file: png(), kind: 'chat' });

    expect(result.error).toMatch(/miembros del club/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it('envía p_image_url al crear actividades', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await createClubEvent({
      title: 'Rodada',
      description: 'Salida juntos',
      location: 'Plaza principal',
      startsAt: '2026-11-21T10:00:00.000Z',
      imageUrl: 'https://cdn.test/flyer.png',
    });

    expect(rpc).toHaveBeenCalledWith('app_group_create_event', {
      p_title: 'Rodada',
      p_description: 'Salida juntos',
      p_location: 'Plaza principal',
      p_starts_at: '2026-11-21T10:00:00.000Z',
      p_image_url: 'https://cdn.test/flyer.png',
    });
  });

  it('permite mensajes solo de imagen con texto opcional', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await sendClubMessage('', 'https://cdn.test/chat.png');

    expect(rpc).toHaveBeenCalledWith('app_group_send_message', {
      p_body: '',
      p_image_url: 'https://cdn.test/chat.png',
    });
  });
});
