import React from 'react';
import { BadgePercent, Handshake, ShieldCheck } from 'lucide-react';
import { DataNotice, EmptyModule, LoadingModule } from '../ui/ModuleState';
import { useModuleData } from '../../data/useModuleData';
import { fetchClubSponsors } from '../../data/clubAdvanced';

const LIFECYCLE_LABELS = {
  active: 'Vigente',
  expiring: 'Por vencer',
  scheduled: 'Próximamente',
  expired: 'Expirada',
};

const LIFECYCLE_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  expiring: 'bg-orange-50 text-orange-700 ring-orange-200',
  scheduled: 'bg-sky-50 text-sky-700 ring-sky-200',
  expired: 'bg-slate-100 text-slate-600 ring-slate-200',
};

// Marcas aprobadas que apoyan al club, con logos y beneficios para miembros.
export default function ClubSponsors() {
  const { items, loading, error, notice } = useModuleData(fetchClubSponsors, []);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#0197AF]/20 bg-white/70">
      <div className="flex items-center gap-2 border-b border-[#0197AF]/10 px-3 py-2.5">
        <Handshake className="h-4 w-4 text-[#0197AF]" aria-hidden="true" />
        <p className="text-xs font-bold text-gray-700">Marcas patrocinadoras</p>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#0197AF]/10 px-2 py-0.5 text-[10px] font-bold text-[#006E7A]">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Aprobadas
        </span>
      </div>

      <div className="p-3">
        {loading ? <LoadingModule label="Cargando patrocinadores…" /> : null}

        {!loading && (error || notice) ? (
          <DataNotice tone={error ? 'error' : 'info'}>{error || notice}</DataNotice>
        ) : null}

        {!loading && items.length === 0 && !error ? (
          <EmptyModule
            icon={Handshake}
            title="Todavía no hay marcas patrocinadoras"
            description="Cuando una marca sea aprobada para tu club, aquí verás su logo y sus beneficios exclusivos."
          />
        ) : null}

        {items.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((sponsor) => {
              const status = sponsor.lifecycle_status;
              return (
                <li
                  key={sponsor.id}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#4B227A]/10 text-xs font-bold text-[#4B227A]">
                    {sponsor.logo_url ? (
                      <img
                        src={sponsor.logo_url}
                        alt={`Logo de ${sponsor.brand_name}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      sponsor.brand_name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-bold text-gray-800">{sponsor.brand_name}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${
                          LIFECYCLE_STYLES[status] || LIFECYCLE_STYLES.active
                        }`}
                      >
                        {LIFECYCLE_LABELS[status] || status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-600">{sponsor.benefit || 'Beneficio para miembros'}</p>
                    {Number(sponsor.discount_percent) > 0 ? (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#006E7A]">
                        <BadgePercent className="h-3 w-3" aria-hidden="true" />
                        {sponsor.discount_percent}% de descuento para miembros
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
