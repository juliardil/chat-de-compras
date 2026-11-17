import React, { useState } from 'react';
import { BadgePercent, Handshake, ShieldCheck, X } from 'lucide-react';
import { DataNotice } from '../ui/ModuleState';
import { useModuleData } from '../../data/useModuleData';
import { fetchClubSponsors } from '../../data/clubAdvanced';

const LIFECYCLE_LABELS = {
  active: 'Vigente',
  expiring: 'Por vencer',
  scheduled: 'Próximamente',
  expired: 'Expirada',
};

const initials = (name) =>
  String(name || 'M')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'M';

// Fila horizontal de logos circulares, ubicada justo debajo de la identidad
// visual. Al tocar una insignia se abre el beneficio real de esa marca.
export default function ClubSponsorAvatars() {
  const { items, loading, error, notice } = useModuleData(fetchClubSponsors, []);
  const [selected, setSelected] = useState(null);

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <Handshake className="h-3.5 w-3.5 text-[#0197AF]" aria-hidden="true" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Marcas patrocinadoras
        </p>
        {items.length > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#0197AF]/10 px-2 py-0.5 text-[9px] font-bold text-[#006E7A]">
            <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" /> Aprobadas
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-2 flex gap-2" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span key={index} className="h-10 w-10 animate-pulse rounded-full bg-white/70" />
          ))}
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
          {items.map((sponsor) => (
            <button
              key={sponsor.id}
              type="button"
              onClick={() => setSelected(sponsor)}
              aria-label={`Ver beneficio de ${sponsor.brand_name}`}
              title={sponsor.brand_name}
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#0197AF]/10 text-[11px] font-bold text-[#006E7A] shadow-sm ring-1 ring-[#0197AF]/25 transition hover:scale-105 hover:ring-[#0197AF]/60"
            >
              {sponsor.logo_url ? (
                <img
                  src={sponsor.logo_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials(sponsor.brand_name)
              )}
            </button>
          ))}
        </div>
      ) : null}

      {!loading && (error || notice) ? (
        <DataNotice className="mt-2" tone={error ? 'error' : 'info'}>
          {error || notice}
        </DataNotice>
      ) : null}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-sponsor-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0197AF]/10 text-xs font-bold text-[#006E7A]">
                  {selected.logo_url ? (
                    <img
                      src={selected.logo_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(selected.brand_name)
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Marca patrocinadora
                  </p>
                  <h3
                    id="club-sponsor-title"
                    className="truncate text-base font-bold text-gray-800"
                  >
                    {selected.brand_name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Cerrar beneficio"
                className="rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {selected.lifecycle_status ? (
              <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                {LIFECYCLE_LABELS[selected.lifecycle_status] || selected.lifecycle_status}
              </span>
            ) : null}

            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              {selected.benefit || 'Beneficio exclusivo para miembros del club.'}
            </p>

            {Number(selected.discount_percent) > 0 ? (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-[#0197AF]/10 px-3 py-2 text-sm font-bold text-[#006E7A]">
                <BadgePercent className="h-4 w-4" aria-hidden="true" />
                {selected.discount_percent}% de descuento para miembros
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
