import React, { useState } from 'react';
import { ImagePlus, Pencil, Sparkles } from 'lucide-react';
import Button from '../ui/Button';
import { DataNotice } from '../ui/ModuleState';
import { useModuleData } from '../../data/useModuleData';
import {
  fetchClubIdentity,
  updateClubIdentity,
  uploadClubAvatar,
} from '../../data/clubAdvanced';

const inputClass =
  'w-full rounded-xl border border-[#4B227A]/20 bg-white/80 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20';

const BADGE_OPTIONS = ['🏁', '🔧', '🏍️', '⚙️', '🛞', '⭐', '🛠️', '🚗'];
const COLOR_OPTIONS = ['#4B227A', '#0197AF', '#00A676', '#D97706', '#DC2626', '#2563EB'];
const FALLBACK_BADGE = '🏁';
const FALLBACK_COLOR = '#4B227A';

// Identidad visual del club: avatar o insignia, color y descripción.
// Solo el responsable del club puede editarla (validado también en la RPC).
export default function ClubIdentity({ group, onUpdated }) {
  const { items, loading, notice, reload } = useModuleData(fetchClubIdentity, [group?.group_id]);
  const identity = items[0] || null;
  const badge = identity?.badge_emoji || FALLBACK_BADGE;
  const color = identity?.color || FALLBACK_COLOR;

  const [editing, setEditing] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(badge);
  const [selectedColor, setSelectedColor] = useState(color);
  const [description, setDescription] = useState(identity?.description || '');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const openEditor = () => {
    setSelectedBadge(badge);
    setSelectedColor(color);
    setDescription(identity?.description || '');
    setFile(null);
    setError(null);
    setEditing(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      let avatarUrl = identity?.avatar_url || null;
      if (file) {
        const upload = await uploadClubAvatar({
          groupId: group?.group_id || identity?.group_id,
          file,
        });
        if (upload.error) {
          setError(upload.error);
          return;
        }
        avatarUrl = upload.url;
      }

      const result = await updateClubIdentity({
        avatarUrl,
        badgeEmoji: selectedBadge,
        color: selectedColor,
        description,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setEditing(false);
      setFile(null);
      reload();
      if (typeof onUpdated === 'function') onUpdated();
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la identidad del club.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="mt-4 h-16 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />;
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#4B227A]/15 bg-gradient-to-r from-white/80 to-[#0197AF]/5 p-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl shadow-sm ring-2 ring-white"
          style={{ backgroundColor: `${color}1A` }}
          aria-label="Insignia del club"
        >
          {identity?.avatar_url ? (
            <img
              src={identity.avatar_url}
              alt="Avatar del club"
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{badge}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            <Sparkles className="h-3 w-3" aria-hidden="true" /> Identidad visual
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-700">
            {identity?.description || 'Personaliza la insignia, el color y la imagen representativa de tu club.'}
          </p>
        </div>
        {group?.is_owner ? (
          <button
            type="button"
            onClick={openEditor}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[#4B227A]/20 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#4B227A] transition hover:bg-[#4B227A]/5"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" /> Editar
          </button>
        ) : null}
      </div>

      {notice ? (
        <DataNotice className="mt-3" tone="info">
          {notice}
        </DataNotice>
      ) : null}

      {error ? (
        <DataNotice className="mt-3" tone="error">
          {error}
        </DataNotice>
      ) : null}

      {editing ? (
        <form className="mt-3 space-y-3 border-t border-[#4B227A]/10 pt-3" onSubmit={handleSave}>
          <div>
            <p className="text-[11px] font-bold text-gray-600">Insignia</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {BADGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={`Insignia ${option}`}
                  aria-pressed={selectedBadge === option}
                  onClick={() => setSelectedBadge(option)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-base transition ${
                    selectedBadge === option
                      ? 'border-[#0197AF] bg-[#0197AF]/10'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-600">Color del club</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {COLOR_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={`Color ${option}`}
                  aria-pressed={selectedColor === option}
                  onClick={() => setSelectedColor(option)}
                  style={{ backgroundColor: option }}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    selectedColor === option ? 'border-gray-800 scale-110' : 'border-white'
                  }`}
                />
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold text-gray-600">Imagen del club (opcional)</span>
            <span className="mt-1 flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-[#0197AF]" aria-hidden="true" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="text-[11px] text-gray-600"
              />
            </span>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold text-gray-600">Descripción</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Rodadas los sábados y descuentos para miembros"
              maxLength={240}
            />
          </label>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" disabled={busy} onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar identidad'}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
