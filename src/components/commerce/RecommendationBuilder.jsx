import React, { useRef, useState } from 'react';
import {
  Folder,
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
  ALL_RECOMMENDATION_GROUPS,
  MAX_RECOMMENDED_OPTIONS,
  buildRecommendationGroups,
  emptyRecommendedOption,
  getSavedRecommendationGroup,
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
  const savedRequest = useRef(null);
  const [uploading, setUploading] = useState({});
  const [error, setError] = useState('');
  const [savedOpen, setSavedOpen] = useState(null);
  const [savedCards, setSavedCards] = useState([]);
  const [savedSearch, setSavedSearch] = useState('');
  const [savedGroup, setSavedGroup] = useState(ALL_RECOMMENDATION_GROUPS);
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

  const savedGroups = buildRecommendationGroups(savedCards);
  const groupInputListId = 'recommendation-category-groups';
  const savedTabClass = (active) =>
    `inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition focus:outline-none focus:ring-2 focus:ring-[#00EED0]/40 ${
      active
        ? 'border-[#006E7A] bg-[#006E7A] text-white'
        : 'border-[#00EED0]/40 bg-white text-[#006E7A] hover:border-[#0197AF] hover:bg-[#00EED0]/10'
    }`;

  // Biblioteca privada del comercio: solo se consultan las ofertas de su propio
  // perfil. Se carga una vez por sesión del constructor y también alimenta las
  // sugerencias del campo «Grupo / Carpeta» al enfocarlo.
  const ensureSavedCards = () => {
    if (savedLoaded.current || savedRequest.current) return savedRequest.current;

    setSavedLoading(true);
    setSavedError('');
    const request = fetchCommerceSavedRecommendations(commerceId)
      .then((result) => {
        setSavedLoading(false);
        if (result.error || result.notice) {
          setSavedError(
            result.error || result.notice || 'No se pudieron cargar tus tarjetas guardadas.'
          );
          return [];
        }
        setSavedCards(result.items);
        savedLoaded.current = true;
        return result.items;
      })
      .catch(() => {
        setSavedLoading(false);
        setSavedError('No se pudieron cargar tus tarjetas guardadas.');
        return [];
      })
      .finally(() => {
        savedRequest.current = null;
      });

    savedRequest.current = request;
    return request;
  };

  const toggleSaved = (key) => {
    if (savedOpen === key) {
      setSavedOpen(null);
      return;
    }
    setSavedOpen(key);
    setSavedSearch('');
    setSavedGroup(ALL_RECOMMENDATION_GROUPS);
    ensureSavedCards();
  };

  const visibleSavedCards = savedCards.filter(
    (card) =>
      (savedGroup === ALL_RECOMMENDATION_GROUPS ||
        getSavedRecommendationGroup(card) === savedGroup) &&
      normalizeMatchingText(card.title).includes(normalizeMatchingText(savedSearch))
  );

  // La foto ya vive en Storage: se copia su URL tal cual. El comercio puede
  // seguir editando todos los campos (incluido el grupo) antes de enviar.
  const reuseSavedCard = (card) => {
    if (!savedOpen) return;
    patchOption(savedOpen, {
      title: card.title,
      price: String(card.price),
      image_url: card.image_url,
      gift_promo: card.gift_promo || '',
      warranty: card.warranty || '',
      category_group: getSavedRecommendationGroup(card),
    });
    setSavedOpen(null);
    setSavedSearch('');
    setSavedGroup(ALL_RECOMMENDATION_GROUPS);
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
              <div
                className="flex gap-1.5 overflow-x-auto pb-1"
                aria-label={`Grupos de tarjetas guardadas para la opción ${index + 1}`}
              >
                <button
                  type="button"
                  aria-label={`Grupo ${ALL_RECOMMENDATION_GROUPS} (${savedCards.length})`}
                  aria-pressed={savedGroup === ALL_RECOMMENDATION_GROUPS}
                  onClick={() => setSavedGroup(ALL_RECOMMENDATION_GROUPS)}
                  className={savedTabClass(savedGroup === ALL_RECOMMENDATION_GROUPS)}
                >
                  {ALL_RECOMMENDATION_GROUPS}
                  <span className="rounded-full bg-[#00EED0]/25 px-1.5">{savedCards.length}</span>
                </button>
                {savedGroups.map((group) => (
                  <button
                    key={group.name}
                    type="button"
                    aria-label={`Grupo ${group.name} (${group.count})`}
                    aria-pressed={savedGroup === group.name}
                    onClick={() => setSavedGroup(group.name)}
                    className={savedTabClass(savedGroup === group.name)}
                  >
                    {group.name}
                    <span className="rounded-full bg-[#00EED0]/25 px-1.5">{group.count}</span>
                  </button>
                ))}
              </div>
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
                  No tienes tarjetas guardadas con ese nombre en este grupo.
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

          <div>
            <label
              htmlFor={`recommendation-group-${option.key}`}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#4B227A]"
            >
              <Folder className="w-3 h-3" aria-hidden="true" />
              Grupo / Carpeta (ej. Baterías, Bombillos)
            </label>
            <input
              id={`recommendation-group-${option.key}`}
              type="text"
              list={groupInputListId}
              aria-label={`Grupo / Carpeta de la opción ${index + 1}`}
              className="mt-1 w-full bg-white/70 border border-[#4B227A]/20 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0197AF]/30 focus:border-[#0197AF]"
              placeholder="Opcional · Ej. Baterías, Bombillos"
              value={option.category_group || ''}
              onChange={(event) => patchOption(option.key, { category_group: event.target.value })}
              onFocus={ensureSavedCards}
              disabled={disabled}
            />
            {savedGroups.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {savedGroups.map((group) => (
                  <button
                    key={group.name}
                    type="button"
                    aria-label={`Usar grupo ${group.name} en la opción ${index + 1}`}
                    onClick={() => patchOption(option.key, { category_group: group.name })}
                    disabled={disabled}
                    className="rounded-full border border-[#00EED0]/40 bg-white px-2 py-0.5 text-[10px] font-bold text-[#006E7A] transition hover:border-[#0197AF] hover:bg-[#00EED0]/10 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/40"
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

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

      <datalist id={groupInputListId}>
        {savedGroups.map((group) => (
          <option key={group.name} value={group.name} />
        ))}
      </datalist>

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
