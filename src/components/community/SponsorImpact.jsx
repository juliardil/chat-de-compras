import React from 'react';
import { BarChart3, ShoppingBag, Users, Wrench } from 'lucide-react';
import { DataNotice, EmptyModule, LoadingModule } from '../ui/ModuleState';
import { useModuleData } from '../../data/useModuleData';
import { fetchSponsorImpact } from '../../data/clubAdvanced';
import { formatCurrency } from '../../data/appData';

// Reporte que visualiza la marca patrocinadora vinculada al comercio o taller:
// cuántos miembros del club compraron repuestos o contrataron servicios.
export default function SponsorImpact() {
  const { items, loading, error, notice } = useModuleData(fetchSponsorImpact, []);

  const totals = items.reduce(
    (accumulator, row) => ({
      buyers: accumulator.buyers + Number(row.club_buyers || 0),
      parts: accumulator.parts + Number(row.parts_orders || 0),
      services: accumulator.services + Number(row.service_orders || 0),
      amount: accumulator.amount + Number(row.purchase_amount || 0),
    }),
    { buyers: 0, parts: 0, services: 0, amount: 0 }
  );

  return (
    <section className="mt-5 rounded-2xl border border-[#0197AF]/20 bg-white/70 p-4" aria-labelledby="sponsor-impact-title">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#0197AF]" aria-hidden="true" />
        <h3
          id="sponsor-impact-title"
          className="text-xs font-bold uppercase tracking-widest text-gray-600"
        >
          Impacto de mi patrocinio
        </h3>
      </div>

      {loading ? <LoadingModule label="Cargando impacto…" /> : null}

      {!loading && (error || notice) ? (
        <DataNotice tone={error ? 'error' : 'info'} className="mt-2">
          {error || notice}
        </DataNotice>
      ) : null}

      {!loading && items.length === 0 && !error ? (
        <EmptyModule
          icon={BarChart3}
          title="Aún no tienes un patrocinio aprobado"
          description="Cuando una marca vinculada a tu negocio sea aprobada, aquí verás el impacto de tus beneficios en los clubes."
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-[#0197AF]/10 p-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#006E7A]">
                <Users className="h-3 w-3" aria-hidden="true" /> Compradores
              </p>
              <p className="mt-1 text-lg font-bold text-gray-800">{totals.buyers}</p>
            </div>
            <div className="rounded-xl bg-[#4B227A]/10 p-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#4B227A]">
                <ShoppingBag className="h-3 w-3" aria-hidden="true" /> Repuestos
              </p>
              <p className="mt-1 text-lg font-bold text-gray-800">{totals.parts}</p>
            </div>
            <div className="rounded-xl bg-[#4B227A]/10 p-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#4B227A]">
                <Wrench className="h-3 w-3" aria-hidden="true" /> Servicios
              </p>
              <p className="mt-1 text-lg font-bold text-gray-800">{totals.services}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5">
              <p className="text-[10px] font-bold uppercase text-emerald-700">Compras</p>
              <p className="mt-1 text-lg font-bold text-gray-800">{formatCurrency(totals.amount)}</p>
            </div>
          </div>

          <ul className="mt-3 space-y-2">
            {items.map((row) => (
              <li key={row.sponsor_id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{row.brand_name}</p>
                    <p className="text-[11px] text-gray-500">{row.group_name || 'Todos los clubes'}</p>
                  </div>
                  <p className="shrink-0 text-xs font-bold text-[#006E7A]">
                    {row.club_buyers} {row.club_buyers === 1 ? 'persona' : 'personas'}
                  </p>
                </div>
                <p className="mt-1.5 text-[11px] text-gray-600">
                  {row.parts_orders} compras de repuestos · {row.service_orders} servicios contratados
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
