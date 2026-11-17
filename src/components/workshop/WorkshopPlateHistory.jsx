import React, { useState } from 'react';
import {
  Car,
  ClipboardList,
  Search,
  Wrench,
} from 'lucide-react';
import { DataNotice, EmptyModule, LoadingModule } from '../ui/ModuleState';
import Button from '../ui/Button';
import { fetchWorkshopPlateHistory } from '../../data/workshop';

const formatMoney = (value) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

// Historial rápido por placa del taller. La búsqueda es parcial y se envía a la
// RPC app_workshop_plate_history, que solo devuelve solicitudes del taller.
export default function WorkshopPlateHistory() {
  const [plate, setPlate] = useState('');
  const [appliedPlate, setAppliedPlate] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async (value) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWorkshopPlateHistory(value);
      setRows(Array.isArray(result.items) ? result.items : []);
      if (result.error) setError(result.error);
    } catch (err) {
      setRows([]);
      setError(err?.message || 'No se pudo cargar el historial por placa.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = plate.trim().toUpperCase();
    setAppliedPlate(value);
    load(value);
  };

  return (
    <section className="mt-5 border-t border-[#4B227A]/15 pt-5" aria-label="Historial por placa">
      <div className="flex items-center gap-2 mb-3">
        <Car className="w-4 h-4 text-[#4B227A]" aria-hidden="true" />
        <h4 className="text-sm font-bold text-gray-800">Historial por placa</h4>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar por placa"
            placeholder="Ej. ABC1234"
            maxLength={15}
            value={plate}
            onChange={(event) => setPlate(event.target.value.toUpperCase())}
            className="w-full rounded-xl border border-[#4B227A]/20 bg-white/80 pl-9 pr-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20"
          />
        </div>
        <Button type="submit" disabled={loading}>
          Buscar
        </Button>
      </form>

      {loading ? <LoadingModule label="Buscando historial…" /> : null}
      {!loading && error ? <DataNotice tone="error" className="mt-3">{error}</DataNotice> : null}

      {!loading && !error && rows.length === 0 ? (
        <EmptyModule
          icon={ClipboardList}
          title={appliedPlate ? 'Sin resultados' : 'Busca una placa para ver su historial'}
          description={
            appliedPlate
              ? `No encontramos solicitudes con placa que contenga «${appliedPlate}».`
              : 'Ingresa una placa completa o parcial para consultar las solicitudes y cotizaciones.'
          }
        />
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-gray-500">
            {rows.length} {rows.length === 1 ? 'resultado' : 'resultados'} para «{appliedPlate || 'todas las placas'}»
          </p>
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-[#4B227A]/10 bg-white/70 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 break-words">
                    {row.title || 'Solicitud'}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-semibold">
                      <Car className="w-3 h-3" /> {row.vehicle_plate}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 capitalize">
                      <Wrench className="w-3 h-3" /> {row.request_type === 'service' ? 'Servicio' : 'Repuesto'}
                    </span>
                    <span className="capitalize">{row.status}</span>
                  </p>
                </div>
                <span className="shrink-0 text-[10px] text-gray-500">
                  {row.created_at ? new Date(row.created_at).toLocaleDateString('es-MX') : ''}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-gray-600">
                {Number(row.offer_count || 0)} {Number(row.offer_count) === 1 ? 'cotización' : 'cotizaciones'}
                {row.accepted_total != null ? ` · Aceptada por ${formatMoney(row.accepted_total)}` : ''}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
