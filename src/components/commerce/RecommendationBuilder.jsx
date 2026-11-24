import React, { useRef, useState } from 'react';
import {
  Gift,
  ImagePlus,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import SafeImage from '../ui/SafeImage';
import {
  fetchCommerceSavedRecommendations,
  formatCurrency,
  uploadRecommendationPhoto,
} from '../../data/appData';
import {
  MAX_RECOMMENDED_OPTIONS,
  emptyRecommendedOption,
} from '../../data/recommendations';
import { normalizeMatchingText } from '../../utils/matching';

// Constructor del mini-catálogo «Recomiéndame». Es aditivo: el flujo de
// referencia exacta sigue usando el editor de disponibilidad del dashboard.
export default function RecommendationBuilder({
  options = [],
  onChange,
  userId,
  commerceId,
  disabled = false,
}) {
  const fileInputs = useRef({});
  const savedLoaded = useRef(false);
  const [uploading, setUploading] = useState({});
  const [error, setError] = useState('');
  const [savedOpen, setSavedOpen] = useState(null);
  const [savedCards, setSavedCards] = useState([]);
  const [savedSearch, setSavedSearch] = useState('');
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState('');

  const patchOption = (key, patch) => {
    if (!Array.isArray(options)) return;
    onChange(
      options.map((option) => (option.key === key ? { ...option, ...patch } : option))
    );
  };

  const handlePhoto = async (key, event) => {
    const file = event.target.files?.[0];
    // Permite volver a elegir el mismo archivo después de quitarlo.
    event.target.value = '';
    if (!file) return;

    setError('');
    setUploading((current) => ({ ...current, [key]: true }));
    const result = await uploadRecommendationPhoto({ userId, file });
    setUploading((current) => ({ ...current, [key]: false }));

    if (result.error || !result.url) {
      setError(result.error || 'No se pudo subir la foto de la opción.');
      return;
    }
    patchOption(key, { image_url: result.url, file_name: file.name });
  };

  const clearPhoto = (key) => {
    if (fileInputs.current[key]) fileInputs.current[key].value = '';
    patchOption(key, { image_url: '', file_name: '' });
  };

  const addOption = () => {
    if (options.length >= MAX_RECOMMENDED_OPTIONS) return;
    onChange([...options, emptyRecommendedOption()]);
  };

  const removeOption = (key) => {
    if (options.length <= 1) return;
    delete fileInputs.current[key];
    onChange(options.filter((option) => option.key !== key));
  };

  // Biblioteca privada del comercio: solo se consultan las ofertas de su propio
  // perfil. Se carga una vez por sesión del constructor para no repetir lecturas.
  const toggleSaved = async (key) => {
    if (savedOpen === key) {
      setSavedOpen(null);
      return;
    }
    setSavedOpen(key);
    setSavedSearch('');
    setSavedError('');
    if (savedLoaded.current) return;

    setSavedLoading(true);
    const result = await fetchCommerceSavedRecommendations(commerceId);
    setSavedLoading(false);
    if (result.error || result.notice) {
      setSavedError(
        result.error || result.notice || 'No se pudieron cargar tus tarjetas guardadas.'
      );
      return;
    }
    setSavedCards(result.items);
    savedLoaded.current = true;
  };

  const visibleSavedCards = savedCards.filter((card) =>
    normalizeMatchingText(card.title).includes(normalizeMatchingText(savedSearch))
  );

  // La foto ya vive en Storage: se copia su URL tal cual. El comercio puede
  // seguir editando todos los campos (incluida la foto) antes de enviar.
  const reuseSavedCard = (card) => {
    if (!savedOpen) return;
    patchOption(savedOpen, {
      title: card.title,
      price: String(card.price),
      image_url: card.image_url,
      gift_promo: card.gift_promo || '',
      warranty: card.warranty || '',
    });
    setSavedOpen(null);
    setSavedSearch('');
  };

  return (
    <div className="rounded-2xl border border-[#00EED0]/40 bg-[#00EED0]/5 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-[#006E7A]" aria-hidden="true" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Mini-catálogo
            </p>
            <p className="text-sm font-bold text-gray-800">Opciones recomendadas</p>
            <p className="text-[11px] text-gray-600">
              Ideal de 3 a 5 opciones · {options.length}/{MAX_RECOMMENDED_OPTIONS}
            </p>
          </div>
        </div>
      </div>

      {options.map((option, index) => (
        <div
          key={option.key}
          className="rounded-xl bg-white/70 border border-white/40 p-3 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#4B227A] bg-[#4B227A]/10 border border-[#4B227A]/20 px-2 py-1 rounded-full">
              Opción {index + 1}
            </span>
            {options.length > 1 ? (
              <button
                type="button"
                aria-label={`Quitar opción ${index + 1}`}
                onClick={() => removeOption(option.key)}
                disabled={disabled}
                className="p-1 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-white/70"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            aria-label={`Reutilizar tarjeta anterior en la opción ${index + 1}`}
            onClick={() => toggleSaved(option.key)}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#0197AF]/30 bg-white px-3 py-1.5 text-[11px] font-bold text-[#006E7A] transition hover:border-[#00EED0] hover:bg-[#00EED0]/10 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/40"
          >
            <span aria-hidden="true">📋</span>
            Reutilizar tarjeta anterior
          </button>

          {savedOpen === option.key ? (
            <div className="rounded-xl border border-[#00EED0]/40 bg-white p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#006E7A]">
                  Mis opciones guardadas
                </p>
                <button
                  type="button"
                  aria-label={`Cerrar tarjetas guardadas de la opción ${index + 1}`}
                  onClick={() => setSavedOpen(null)}
                  className="p-1 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-[#00EED0]/10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-gray-500">
                Tus tarjetas anteriores con foto. Al elegir una podrás editar todos los datos.
              </p>
              <input
                type="search"
                aria-label={`Buscar tarjetas guardadas para la opción ${index + 1}`}
                placeholder="Buscar por nombre"
                value={savedSearch}
                onChange={(event) => setSavedSearch(event.target.value)}
                className="w-full rounded-lg border border-[#00EED0]/40 bg-white/80 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 focus:border-[#00EED0]"
              />
              {savedLoading ? (
                <p className="text-[11px] text-gray-600">Cargando tus tarjetas…</p>
              ) : null}
              {!savedLoading && savedError ? (
                <p role="alert" className="text-[11px] text-red-700">{savedError}</p>
              ) : null}
              {!savedLoading && !savedError && visibleSavedCards.length === 0 ? (
                <p className="text-[11px] text-gray-600">
                  No tienes tarjetas guardadas con ese nombre.
                </p>
              ) : null}
              {!savedLoading && !savedError && visibleSavedCards.length > 0 ? (
                <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  {visibleSavedCards.map((card) => (
                    <li key={card.id}>
                      <button
                        type="button"
                        aria-label={`Reutilizar ${card.title} en la opción ${index + 1}`}
                        onClick={() => reuseSavedCard(card)}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2 text-left transition hover:border-[#00EED0] hover:bg-[#00EED0]/5 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/40"
                      >
                        <SafeImage
                          src={card.image_url}
                          alt={`Foto de ${card.title}`}
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-gray-800">
                            {card.title}
                          </span>
                          <span className="block text-[11px] font-bold text-[#006E7A]">
                            {formatCurrency(card.price, 'MXN')}
                          </span>
                          <span className="block truncate text-[10px] text-gray-500">
                            {[card.gift_promo, card.warranty].filter(Boolean).join(' · ') ||
                              'Sin regalo ni garantía'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div>
            <input
              ref={(node) => {
                if (node) fileInputs.current[option.key] = node;
              }}
              id={`recommendation-photo-${option.key}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              aria-label={`Foto de la opción ${index + 1}`}
              onChange={(event) => handlePhoto(option.key, event)}
              disabled={disabled}
              className="sr-only"
            />
            <label
              htmlFor={`recommendation-photo-${option.key}`}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#4B227A]/25 bg-white/80 px-3 py-2.5 text-xs font-bold text-[#4B227A] transition hover:border-[#0197AF]/50 hover:bg-[#0197AF]/5"
            >
              <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {uploading[option.key]
                ? 'Subiendo foto…'
                : option.image_url
                  ? 'Cambiar foto'
                  : 'Elegir foto'}
            </label>

            {option.image_url ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-[#4B227A]/10 bg-white/80">
                <SafeImage
                  src={option.image_url}
                  alt={`Vista previa de la opción ${index + 1}`}
                  className="max-h-32 w-full object-cover"
                />
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                  <span
                    className="min-w-0 truncate text-[10px] font-semibold text-gray-600"
                    title={option.file_name || ''}
                  >
                    {option.file_name || 'Foto de la opción'}
                  </span>
                  <button
                    type="button"
                    aria-label={`Quitar foto de la opción ${index + 1}`}
                    onClick={() => clearPhoto(option.key)}
                    disabled={disabled}
                    className="text-[10px] font-bold text-[#4B227A] hover:underline"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <input
            type="text"
            aria-label={`Nombre del producto, opción ${index + 1}`}
            className="w-full bg-white/70 border border-[#4B227A]/20 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0197AF]/30 focus:border-[#0197AF]"
            placeholder="Ej. Casco integral talla M"
            value={option.title}
            onChange={(event) => patchOption(option.key, { title: event.target.value })}
            disabled={disabled}
          />

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-bold text-sm">
              $
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              aria-label={`Precio de la opción ${index + 1}`}
              className="w-full bg-white/70 border border-[#4B227A]/20 rounded-lg pl-7 pr-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0197AF]/30 focus:border-[#0197AF]"
              placeholder="Precio de esta opción"
              value={option.price}
              onChange={(event) => patchOption(option.key, { price: event.target.value })}
              disabled={disabled}
            />
          </div>

          <div className="rounded-lg border border-[#00EED0]/40 bg-[#00EED0]/10 p-2.5 space-y-2">
            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#006E7A]">
              <Gift className="w-3 h-3" aria-hidden="true" />
              Regalo o promoción
            </label>
            <input
              type="text"
              aria-label={`Regalo o promoción de la opción ${index + 1}`}
              className="w-full bg-white/80 border border-[#00EED0]/40 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0197AF]/30 focus:border-[#0197AF]"
              placeholder="Ej. Incluye guantes"
              value={option.gift_promo}
              onChange={(event) => patchOption(option.key, { gift_promo: event.target.value })}
              disabled={disabled}
            />
          </div>

          <div className="rounded-lg border border-[#4B227A]/20 bg-[#4B227A]/5 p-2.5">
            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#4B227A]">
              <ShieldCheck className="w-3 h-3" aria-hidden="true" />
              Garantía
            </label>
            <input
              type="text"
              aria-label={`Garantía de la opción ${index + 1}`}
              className="mt-1 w-full bg-white/80 border border-[#4B227A]/20 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0197AF]/30 focus:border-[#0197AF]"
              placeholder="Ej. 1 año de garantía"
              value={option.warranty}
              onChange={(event) => patchOption(option.key, { warranty: event.target.value })}
              disabled={disabled}
            />
          </div>
        </div>
      ))}

      {error ? (
        <p role="alert" className="text-xs text-red-700">{error}</p>
      ) : null}

      {options.length < MAX_RECOMMENDED_OPTIONS ? (
        <button
          type="button"
          onClick={addOption}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#006E7A] hover:underline"
        >
          <Plus className="w-3 h-3" />
          Agregar otra opción
        </button>
      ) : null}
    </div>
  );
}
