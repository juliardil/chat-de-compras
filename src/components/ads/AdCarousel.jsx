import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car } from 'lucide-react';
import SafeImage from '../ui/SafeImage';
import {
  fetchActiveAds,
  getAdViewerKey,
  recordAdClick,
  recordAdImpression,
} from '../../data/appData';

const safeTargetPath = (value) =>
  typeof value === 'string' && /^\/(?!\/)/.test(value) ? value : '/request';

// Carrusel de campañas vigentes para /categories. Mantiene exactamente la
// tarjeta, los degradados y la tipografía del hero anterior; si no hay anuncios
// (o falla la consulta) devuelve el hero recibido por props sin inventar datos.
export default function AdCarousel({ fallback = null }) {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const viewerKeyRef = useRef(null);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetchActiveAds()
      .then(({ items }) => {
        if (!mounted) return;
        setAds(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!mounted) return;
        setAds([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Una impresión por campaña y visitante. El backend deduplica con la clave
  // local, así que reintentos o renders adicionales no inflan el contador.
  useEffect(() => {
    if (!ads.length) return undefined;
    const viewerKey = viewerKeyRef.current || getAdViewerKey();
    if (!viewerKey) return undefined;
    viewerKeyRef.current = viewerKey;
    ads.forEach((ad) => {
      void recordAdImpression(ad.id, viewerKey);
    });
    return undefined;
  }, [ads]);

  const handleScroll = (event) => {
    const node = event.currentTarget;
    if (!node || !ads.length || node.scrollWidth <= node.clientWidth) return;
    const cardWidth = node.scrollWidth / ads.length;
    setActiveIndex(
      Math.max(0, Math.min(ads.length - 1, Math.round(node.scrollLeft / cardWidth)))
    );
  };

  const goTo = (index) => {
    const node = scrollRef.current;
    if (!node || !ads.length) return;
    const target = Math.max(0, Math.min(ads.length - 1, index));
    const cardWidth = node.scrollWidth / ads.length;
    if (typeof node.scrollTo === 'function') {
      node.scrollTo({ left: cardWidth * target, behavior: 'smooth' });
    }
    setActiveIndex(target);
  };

  const handleAdClick = (ad) => {
    const viewerKey = viewerKeyRef.current || getAdViewerKey();
    viewerKeyRef.current = viewerKey;
    void recordAdClick(ad.id, viewerKey);
    navigate(safeTargetPath(ad.targetPath));
  };

  if (loading || ads.length === 0) return fallback;

  return (
    <div className="w-full max-w-sm">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="region"
        aria-roledescription="carrusel"
        aria-label="Anuncios destacados"
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 no-scrollbar"
      >
        {ads.map((ad) => (
          <motion.button
            key={ad.id}
            type="button"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={() => handleAdClick(ad)}
            aria-label={`Anuncio: ${ad.headline || ad.name}`}
            className="snap-start shrink-0 w-full rounded-[40px] overflow-hidden shadow-2xl aspect-[4/5] relative text-left"
          >
            <SafeImage
              src={ad.imageUrl}
              alt={ad.name || 'Anuncio destacado'}
              className="w-full h-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#00EED0]/90 to-[#4B227A]/70 via-black/20 to-transparent" />

            <div className="absolute inset-0 p-10 flex flex-col justify-end items-start">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 rounded-2xl bg-[#00EED0] flex items-center justify-center shadow-lg border-2 border-white/30">
                  <Car className="w-8 h-8 text-white" aria-hidden="true" />
                </div>
                <h2 className="text-4xl font-black text-white leading-tight">
                  {ad.headline || ad.name}
                </h2>
              </div>

              {ad.description ? (
                <p className="text-white/90 text-lg font-medium leading-tight max-w-[200px]">
                  {ad.description}
                </p>
              ) : null}

              {ad.ctaLabel ? (
                <span className="mt-3 inline-flex items-center rounded-full border border-white/40 bg-white/20 px-3 py-1 text-xs font-bold text-white">
                  {ad.ctaLabel}
                </span>
              ) : null}
            </div>
          </motion.button>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-2">
        <span className="text-[10px] font-semibold text-[#006E7A]" aria-hidden="true">
          {activeIndex + 1}/{ads.length}
        </span>
        <div className="flex items-center gap-1.5" role="group" aria-label="Indicadores de anuncios">
          {ads.map((ad, index) => (
            <button
              key={ad.id}
              type="button"
              aria-label={`Ir al anuncio ${index + 1}`}
              aria-current={activeIndex === index}
              onClick={() => goTo(index)}
              className={`h-2 rounded-full transition-all ${
                activeIndex === index ? 'w-5 bg-[#006E7A]' : 'w-2 bg-[#00EED0]/60'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
