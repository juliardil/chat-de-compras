import React, { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  ImagePlus,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import Button from '../ui/Button';
import { DataNotice, EmptyModule, LoadingModule } from '../ui/ModuleState';
import { useModuleData } from '../../data/useModuleData';
import {
  createClubEvent,
  fetchClubEvents,
  rsvpClubEvent,
  uploadClubImage,
  validateClubImage,
} from '../../data/clubAdvanced';
import { formatRelativeDate } from '../../data/appData';

const inputClass =
  'w-full rounded-xl border border-[#4B227A]/20 bg-white/80 px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20';

const eventDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const eventTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const memberInitial = (name) => String(name || 'M').trim().slice(0, 1).toUpperCase() || 'M';

const canPreview = () =>
  typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

const confirmedMembers = (event) =>
  Array.isArray(event?.confirmed_members) ? event.confirmed_members : [];

// Actividades y rodadas del club con confirmación de asistencia y flyer.
export default function ClubEvents({ isOwner, groupId }) {
  const { items, loading, error, notice, reload } = useModuleData(fetchClubEvents, []);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(
    () => () => {
      if (imagePreview && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(imagePreview);
      }
    },
    [imagePreview]
  );

  const clearImage = () => {
    if (imagePreview && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      URL.revokeObjectURL(imagePreview);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    const validation = validateClubImage(file);
    if (validation) {
      setActionError(validation);
      clearImage();
      return;
    }

    clearImage();
    setImageFile(file);
    setImagePreview(file && canPreview() ? URL.createObjectURL(file) : null);
    setActionError(null);
  };

  const runAction = async (action) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      if (result?.error) {
        setActionError(result.error);
        return null;
      }
      reload();
      return result;
    } catch (err) {
      setActionError(err?.message || 'No se pudo completar la operación.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = (event) => {
    event.preventDefault();
    if (!startsAt || busy) return;
    runAction(async () => {
      let imageUrl = null;
      if (imageFile) {
        const upload = await uploadClubImage({ groupId, file: imageFile, kind: 'events' });
        if (upload.error) return { error: upload.error };
        imageUrl = upload.url;
      }

      const result = await createClubEvent({
        title,
        description,
        location,
        startsAt: new Date(startsAt).toISOString(),
        imageUrl,
      });

      if (!result.error) {
        setTitle('');
        setDescription('');
        setLocation('');
        setStartsAt('');
        clearImage();
        setCreating(false);
      }
      return result;
    });
  };

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#4B227A]/15 bg-white/70">
      <div className="flex items-center justify-between gap-2 border-b border-[#4B227A]/10 px-3 py-2.5">
        <p className="flex items-center gap-2 text-xs font-bold text-gray-700">
          <CalendarDays className="h-4 w-4 text-[#4B227A]" aria-hidden="true" />
          Actividades y rodadas
        </p>
        {isOwner ? (
          <button
            type="button"
            onClick={() => setCreating((value) => !value)}
            aria-expanded={creating}
            className="inline-flex items-center gap-1 rounded-lg border border-[#4B227A]/20 bg-white px-2 py-1 text-[11px] font-bold text-[#4B227A] transition hover:bg-[#4B227A]/5"
          >
            <CalendarPlus className="h-3 w-3" aria-hidden="true" />
            {creating ? 'Cerrar' : 'Crear actividad'}
          </button>
        ) : null}
      </div>

      <div className="p-3">
        {loading ? <LoadingModule label="Cargando actividades…" /> : null}

        {!loading && (error || notice) ? (
          <DataNotice tone={error ? 'error' : 'info'} className="mb-2">
            {error || notice}
          </DataNotice>
        ) : null}

        {!loading && actionError ? (
          <DataNotice tone="error" className="mb-2">
            {actionError}
          </DataNotice>
        ) : null}

        {!loading && items.length === 0 && !error ? (
          <EmptyModule
            icon={CalendarDays}
            title="No hay actividades próximas"
            description="Cuando el club programe una rodada o reunión podrás confirmar tu asistencia aquí."
          />
        ) : null}

        {items.length > 0 ? (
          <ul className="space-y-2">
            {items.map((event) => {
              const going = event.my_status === 'going';
              const attendees = confirmedMembers(event);
              return (
                <li
                  key={event.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={`Flyer de ${event.title}`}
                      className="mb-2.5 max-h-44 w-full rounded-xl border border-[#4B227A]/10 object-cover"
                    />
                  ) : null}

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800">{event.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[#006E7A]">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" aria-hidden="true" />
                          {eventDate(event.starts_at)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {eventTime(event.starts_at)}
                        </span>
                        <span className="text-gray-400">{formatRelativeDate(event.starts_at)}</span>
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#4B227A]/10 px-2 py-1 text-[10px] font-bold text-[#4B227A]">
                      <Users className="h-3 w-3" aria-hidden="true" />
                      {event.going_count || 0}
                    </span>
                  </div>

                  {event.description ? (
                    <p className="mt-1.5 text-xs text-gray-600">{event.description}</p>
                  ) : null}
                  {event.location ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                      <MapPin className="h-3 w-3" aria-hidden="true" /> {event.location}
                    </p>
                  ) : null}

                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="text-[10px] font-bold text-gray-500">
                      Confirmados del grupo ({attendees.length})
                    </p>
                    {attendees.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {attendees.slice(0, 6).map((member, index) => (
                          <span
                            key={member.user_id || `${member.display_name}-${index}`}
                            className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#4B227A]/10 px-2 py-0.5 text-[10px] font-semibold text-[#4B227A]"
                          >
                            {member.avatar_url ? (
                              <img
                                src={member.avatar_url}
                                alt=""
                                className="h-4 w-4 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0197AF]/15 text-[9px] font-bold text-[#006E7A]">
                                {memberInitial(member.display_name)}
                              </span>
                            )}
                            <span className="truncate">{member.display_name}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[10px] text-gray-400">
                        Aún no hay miembros confirmados.
                      </p>
                    )}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction(() => rsvpClubEvent(event.id, 'going'))}
                      className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${
                        going
                          ? 'bg-emerald-600 text-white'
                          : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      <Check className="h-3 w-3" aria-hidden="true" />
                      {going ? 'Asistencia confirmada' : 'Asistiré'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction(() => rsvpClubEvent(event.id, 'not_going'))}
                      aria-label={`No podré ir a ${event.title}`}
                      className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${
                        event.my_status === 'not_going'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-slate-200 bg-white text-gray-600 hover:bg-slate-50'
                      }`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                      No podré ir
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {creating ? (
          <form className="mt-3 space-y-2 border-t border-[#4B227A]/10 pt-3" onSubmit={handleCreate}>
            <label className="block">
              <span className="text-[11px] font-bold text-gray-600">Título de la actividad</span>
              <input
                className={`mt-1 ${inputClass}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Rodada sábado por la mañana"
                maxLength={120}
                required
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-bold text-gray-600">Fecha</span>
                <input
                  type="date"
                  className={`mt-1 ${inputClass}`}
                  value={startsAt ? startsAt.slice(0, 10) : ''}
                  onChange={(event) => {
                    const time = startsAt ? startsAt.slice(11, 16) : '09:00';
                    setStartsAt(event.target.value ? `${event.target.value}T${time}` : '');
                  }}
                  required
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-gray-600">Hora</span>
                <input
                  type="time"
                  className={`mt-1 ${inputClass}`}
                  value={startsAt ? startsAt.slice(11, 16) : ''}
                  onChange={(event) => {
                    const day = startsAt ? startsAt.slice(0, 10) : '';
                    setStartsAt(day ? `${day}T${event.target.value}` : '');
                  }}
                  required
                />
              </label>
            </div>
            <label className="block">
              <span className="text-[11px] font-bold text-gray-600">Punto de encuentro</span>
              <input
                className={`mt-1 ${inputClass}`}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Plaza principal"
                maxLength={120}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-gray-600">Descripción</span>
              <input
                className={`mt-1 ${inputClass}`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Detalles de la rodada"
                maxLength={240}
              />
            </label>
            <div>
              <span className="flex items-center gap-1 text-[11px] font-bold text-gray-600">
                <ImagePlus className="h-3 w-3 text-[#4B227A]" aria-hidden="true" />
                Flyer de la actividad (opcional)
              </span>
              <input
                ref={fileInputRef}
                id="club-event-flyer"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                aria-label="Flyer de la actividad"
                className="sr-only"
              />
              <label
                htmlFor="club-event-flyer"
                className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#4B227A]/25 bg-white/80 px-3 py-2.5 text-xs font-bold text-[#4B227A] transition hover:border-[#0197AF]/50 hover:bg-[#0197AF]/5"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                {imageFile ? 'Cambiar flyer' : 'Elegir flyer'}
              </label>
              <span className="mt-1 block text-[10px] text-gray-400">
                JPG, PNG o WEBP · máximo 5 MB
              </span>
              {imageFile ? (
                <div className="mt-2 overflow-hidden rounded-xl border border-[#4B227A]/10 bg-white/80">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Vista previa del flyer"
                      className="max-h-32 w-full object-cover"
                    />
                  ) : null}
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                    <span
                      className="min-w-0 truncate text-[10px] font-semibold text-gray-600"
                      title={imageFile.name}
                    >
                      {imageFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#4B227A]/20 bg-white px-2 py-1 text-[10px] font-bold text-[#4B227A] transition hover:bg-[#4B227A]/5"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                      Quitar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <Button type="submit" disabled={busy} className="w-full py-2 text-xs">
              {busy ? 'Guardando…' : 'Publicar actividad'}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
