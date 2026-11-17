import React from 'react';
import { Star } from 'lucide-react';

// Selector de marcas compartido por «Ofertas» y «Respuestas». Cada opción es un
// radio real (accesible con teclado y lectores de pantalla); la opción marcada
// es la que se guarda como acuerdo inicial de la conversación.
export default function BrandOptionPicker({
  options = [],
  selectedId = null,
  onSelect,
  busy = false,
  name = 'brand-option',
  label = 'Opciones de marca',
}) {
  if (!Array.isArray(options) || options.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
        {label}
      </p>
      <div role="radiogroup" aria-label={label} className="space-y-1.5">
        {options.map((option) => {
          const checked = selectedId === option.id;
          const disabled = option.available === false || busy;

          return (
            <label
              key={option.id}
              className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 transition-colors ${
                checked
                  ? 'bg-[#0197AF]/10 border-[#0197AF]/50'
                  : 'bg-white/70 border-white/40 hover:bg-white'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={checked}
                disabled={disabled}
                onChange={() => onSelect?.(option)}
                className="mt-0.5 accent-[#006E7A]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="text-sm font-semibold text-gray-800 break-words">
                      {option.brand}
                    </span>
                    {option.isRecommended ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4B227A] bg-[#4B227A]/10 border border-[#4B227A]/20 px-1.5 py-0.5 rounded-full">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        Recomendada
                      </span>
                    ) : null}
                    {option.available === false ? (
                      <span className="text-[10px] font-bold text-gray-600 bg-gray-200/80 px-1.5 py-0.5 rounded-full">
                        No disponible
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-[#006E7A]">
                    {option.priceLabel}
                  </span>
                </span>
                {option.note ? (
                  <span className="block text-xs text-gray-600 mt-0.5 break-words">
                    {option.note}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
