import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { OFFER_SORT_OPTIONS } from '../../data/offerSort';

// Selector de orden para las ofertas recibidas. Solo cambia el orden de las
// ofertas ya cargadas; no vuelve a consultar el backend ni inventa datos.
export default function OfferSortBar({ value, onChange }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
        <ArrowUpDown className="w-3.5 h-3.5" />
        Ordenar por
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {OFFER_SORT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={value === option.key}
            onClick={() => onChange(option.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              value === option.key
                ? 'bg-[#006E7A] text-white border-[#006E7A]'
                : 'bg-white/70 text-[#006E7A] border-[#006E7A]/30 hover:bg-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
