import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, upload, getPublicUrl, from } = vi.hoisted(() => ({
  rpc: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../lib/insforge', () => ({
  insforge: {
    database: { rpc },
    storage: { from },
  },
  isInsforgeConfigured: true,
  avatarsBucket: 'avatars',
}));

import { insforge } from '../lib/insforge';
import {
  fetchBusinessBrandLogos,
  fetchMyBusinessLogos,
  saveClubSponsorLogo,
  saveCommerceLogo,
  saveWorkshopLogo,
  uploadLogo,
} from './businessLogos';

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ upload, getPublicUrl });
  upload.mockResolvedValue({ data: { url: 'https://cdn/logo.png', key: 'logos/x.png' }, error: null });
  getPublicUrl.mockReturnValue({ data: { publicUrl: null } });
  rpc.mockResolvedValue({ data: [], error: null });
});

describe('autoservicio de logos', () => {
  it('sube el logo al bucket avatars con las mismas validaciones que la foto', async () => {
    const file = { name: 'marca.png', type: 'image/png', size: 1024 };

    const result = await uploadLogo({ userId: 'u-1', scope: 'sponsor', file });

    expect(insforge.storage.from).toHaveBeenCalledWith('avatars');
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^logos\/sponsor\/u-1\/logo-\d+\.png$/),
      file
    );
    expect(result).toEqual({ url: 'https://cdn/logo.png', key: 'logos/x.png', error: null });
  });

  it('rechaza un archivo que no sea imagen antes de subirlo', async () => {
    const result = await uploadLogo({
      userId: 'u-1',
      scope: 'workshop',
      file: { name: 'logo.pdf', type: 'application/pdf', size: 10 },
    });

    expect(result.url).toBeNull();
    expect(result.error).toMatch(/imagen/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it('usa las RPC con comprobación de propiedad para guardar cada logo', async () => {
    await saveWorkshopLogo('https://cdn/workshop.png');
    await saveCommerceLogo('https://cdn/commerce.png');
    await saveClubSponsorLogo('sponsor-1', 'https://cdn/sponsor.png');

    expect(rpc).toHaveBeenNthCalledWith(1, 'app_set_workshop_logo', {
      p_logo_url: 'https://cdn/workshop.png',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'app_set_commerce_logo', {
      p_logo_url: 'https://cdn/commerce.png',
    });
    expect(rpc).toHaveBeenNthCalledWith(3, 'app_set_club_sponsor_logo', {
      p_sponsor_id: 'sponsor-1',
      p_logo_url: 'https://cdn/sponsor.png',
    });
  });

  it('lee los logos propios y los de marcas vinculadas sin inventar datos', async () => {
    const own = await fetchMyBusinessLogos();
    expect(rpc).toHaveBeenCalledWith('app_my_business_logos');
    expect(own.items).toEqual([]);

    const skipped = await fetchBusinessBrandLogos();
    expect(skipped.items).toEqual([]);
    expect(rpc).toHaveBeenCalledTimes(1);

    await fetchBusinessBrandLogos({ workshopId: 'w-1', commerceId: 'c-1' });
    expect(rpc).toHaveBeenLastCalledWith('app_business_brand_logos', {
      p_workshop_id: 'w-1',
      p_commerce_id: 'c-1',
    });
  });
});
