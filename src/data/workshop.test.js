import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/insforge', () => ({
  insforge: { database: { rpc: vi.fn() } },
  isInsforgeConfigured: true,
  avatarsBucket: 'avatars',
}));

import { insforge } from '../lib/insforge';
import {
  createServiceProposal,
  fetchAvailableServiceJobs,
  fetchMyServiceProposals,
  fetchMyWorkshop,
  fetchWorkshopPlateHistory,
  openWorkshopOfferChat,
  saveWorkshop,
  WORKSHOP_SPECIALTIES,
} from './workshop';

const rpc = insforge.database.rpc;

beforeEach(() => {
  rpc.mockReset();
});

describe('capa de datos de talleres verificados', () => {
  it('lee el taller propio con la RPC aislada', async () => {
    const workshop = { id: 'w-1', workshop_name: 'Taller La Esquina' };
    rpc.mockResolvedValue({ data: [workshop], error: null });

    const result = await fetchMyWorkshop();

    expect(rpc).toHaveBeenCalledWith('app_my_workshop');
    expect(result.items).toEqual([workshop]);
    expect(result.error).toBeNull();
  });

  it('guarda los datos fiscales y las especialidades', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'w-1' }], error: null });

    const result = await saveWorkshop({
      workshopName: 'Taller La Esquina',
      nitOrId: 'NIT-123',
      address: 'Calle 1 #2',
      phone: '5551234',
      specialties: ['Mecánica general', 'Motos'],
    });

    expect(rpc).toHaveBeenCalledWith('app_save_workshop', {
      p_workshop_name: 'Taller La Esquina',
      p_nit_or_id: 'NIT-123',
      p_address: 'Calle 1 #2',
      p_phone: '5551234',
      p_specialties: ['Mecánica general', 'Motos'],
    });
    expect(result.ok).toBe(true);
  });

  it('envía un arreglo vacío cuando no hay especialidades', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'w-1' }], error: null });

    await saveWorkshop({
      workshopName: 'Taller Norte',
      nitOrId: 'NIT-999',
      address: 'Av. Principal 10',
      phone: '5550000',
    });

    expect(rpc.mock.calls[0][1].p_specialties).toEqual([]);
  });

  it('ofrece el catálogo de especialidades esperado', () => {
    expect(WORKSHOP_SPECIALTIES).toContain('Mecánica general');
    expect(WORKSHOP_SPECIALTIES).toContain('Motos');
    expect(WORKSHOP_SPECIALTIES).toContain('Electricidad');
    expect(WORKSHOP_SPECIALTIES).toContain('Latonería');
  });

  it('lee los trabajos disponibles y las propuestas propias con RPC aisladas', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'job-1', client_is_club_member: true }], error: null });
    rpc.mockResolvedValueOnce({ data: [{ id: 'offer-1', labor_amount: 850 }], error: null });

    const jobs = await fetchAvailableServiceJobs();
    const proposals = await fetchMyServiceProposals();

    expect(rpc).toHaveBeenNthCalledWith(1, 'app_available_service_jobs');
    expect(rpc).toHaveBeenNthCalledWith(2, 'app_my_service_proposals');
    expect(jobs.items[0]).toMatchObject({ id: 'job-1', client_is_club_member: true });
    expect(proposals.items[0]).toMatchObject({ id: 'offer-1', labor_amount: 850 });
  });

  it('envía mano de obra, días y notas al crear una propuesta', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'offer-2' }], error: null });

    await createServiceProposal({
      requestId: 'req-1',
      laborAmount: 900,
      estimatedDays: 3,
      notes: 'Incluye mano de obra',
    });

    expect(rpc).toHaveBeenCalledWith('app_create_service_proposal', {
      p_request_id: 'req-1',
      p_labor_amount: 900,
      p_estimated_days: 3,
      p_notes: 'Incluye mano de obra',
    });
  });

  it('abre el chat de la propuesta y filtra el historial por placa', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'thread-1' }], error: null });
    rpc.mockResolvedValueOnce({ data: [{ id: 'req-3', vehicle_plate: 'ABC123' }], error: null });

    const chat = await openWorkshopOfferChat('offer-2');
    const history = await fetchWorkshopPlateHistory('abc123');

    expect(rpc).toHaveBeenNthCalledWith(1, 'app_open_workshop_offer_chat', {
      p_offer_id: 'offer-2',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'app_workshop_plate_history', {
      p_plate: 'abc123',
    });
    expect(chat.items[0]).toMatchObject({ id: 'thread-1' });
    expect(history.items[0]).toMatchObject({ vehicle_plate: 'ABC123' });
  });
});
