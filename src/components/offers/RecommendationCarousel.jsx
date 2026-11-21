import React, { useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Gift,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import SafeImage from '../ui/SafeImage';

// Carrusel horizontal del mini-catálogo «Recomiéndame». Cada tarjeta usa la
// selección de oferta existente al llamar a `onSelect(option)`.
export default function RecommendationCarousel({
  options = [],
  selectedId = null,
  onSelect,
  busy = false,
}) {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!Array.isArray(options) || options.length === 0) return null;

  const handleScroll = (event) => {
    const node = event.currentTarget;
    if (!node || node.scrollWidth <= node.clientWidth) return;
    const cardWidth = node.scrollWidth / options.length;
    setActiveIndex(
      Math.max(0, Math.min(options.length - 1, Math.round(node.scrollLeft / cardWidth)))
    );
  };

  const goTo = (index) => {
    const node = scrollRef.current;
    if (!node) return;
    const target = Math.max(0, Math.min(options.length - 1, index));
    const cardWidth = node.scrollWidth / options.length;
    node.scrollTo({ left: cardWidth * target, behavior: 'smooth' });
    setActiveIndex(target);
  };

  return (
    <div className="mt-3 rounded-2xl border border-[#00EED0]/40 bg-[#00EED0]/5 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#006E7A]">
          <Sparkles className="w-3 h-3" aria-hidden="true" />
          Opciones recomendadas
        </p>
        <span className="text-[10px] font-semibold text-gray-600">
          {activeIndex + 1}/{options.length}
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 no-scrollbar"
      >
        {options.map((option) => {
          const selected = selectedId === option.id;
          return (
            <article
              key={option.id}
              className={`snap-start shrink-0 w-[210px] rounded-2xl bg-white/80 border p-3 shadow-sm transition-colors ${
                selected ? 'border-[#0197AF]/60 bg-[#0197AF]/5' : 'border-white/40'
              }`}
            >
              <SafeImage
                src={option.image_url || option.photo}
                alt={`Foto de ${option.title}`}
                className="h-28 w-full rounded-xl object-cover border border-white/40 bg-white/70"
              />

              <h4 className="mt-2 text-sm font-bold text-gray-800 line-clamp-2">
                {option.title}
              </h4>

              <p className="mt-1 text-lg font-bold text-[#006E7A]">
                {option.priceLabel}
              </p>

              {option.gift_promo ? (
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#4B227A] bg-[#00EED0]/20 border border-[#00EED0]/30 px-2 py-0.5 rounded-full">
                  <Gift className="w-2.5 h-2.5" aria-hidden="true" />
                  {option.gift_promo}
                </span>
              ) : null}

              {option.warranty ? (
                <p className="mt-1 flex items-start gap-1 text-[11px] text-gray-600">
                  <ShieldCheck className="w-3 h-3 shrink-0 text-[#006E7A]" aria-hidden="true" />
                  {option.warranty}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => onSelect?.(option)}
                disabled={busy || selected}
                aria-pressed={selected}
                className={`mt-3 w-full py-2 rounded-xl text-xs font-bold transition-colors ${
                  selected
                    ? 'bg-[#4B227A]/15 text-[#4B227A] border border-[#4B227A]/30'
                    : 'bg-[#00EED0] hover:bg-[#00EED0]/90 text-black shadow-[0_0_20px_rgba(0,238,208,0.4)]'
                }`}
              >
                {selected ? 'Opción elegida' : 'Elegir esta opción'}
              </button>
            </article>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Opción anterior"
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          className="p-1.5 rounded-full bg-white/70 border border-white/40 text-[#006E7A] disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5" role="group" aria-label="Indicadores de opciones">
          {options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              aria-label={`Ir a la opción ${index + 1}`}
              aria-current={activeIndex === index}
              onClick={() => goTo(index)}
              className={`h-2 rounded-full transition-all ${
                activeIndex === index ? 'w-5 bg-[#006E7A]' : 'w-2 bg-[#00EED0]/60'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="Siguiente opción"
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex >= options.length - 1}
          className="p-1.5 rounded-full bg-white/70 border border-white/40 text-[#006E7A] disabled:opacity-40"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
