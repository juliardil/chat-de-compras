import React, { useState } from 'react';
import { CalendarPlus, CalendarDays, Check, MapPin, Users, X } from 'lucide-react';
import Button from '../ui/Button';
import { DataNotice, EmptyModule, LoadingModule } from '../ui/ModuleState';
import { useModuleData } from '../../data/useModuleData';
import { createClubEvent, fetchClubEvents, rsvpClubEvent } from '../../data/clubAdvanced';
import { formatRelativeDate } from '../../data/appData';

const inputClass =
  'w-full rounded-xl border border-[#4B227A]/20 bg-white/80 px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20';

const eventDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Actividades y rodadas del club con confirmación de asistencia.
export default function ClubEvents({ isOwner }) {
  const { items, loading, error, notice, reload } = useModuleData(fetchClubEvents, []);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const runAction = async (action) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      if (result.error) {
        setActionError(result.error);
        return;
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
    if (!startsAt) return;
    runAction(async () => {
      const result = await createClubEvent({
        title,
        description,
        location,
        startsAt: new Date(startsAt).toISOString(),
      });
      if (!result.error) {
        setTitle('');
        setDescription('');
        setLocation('');
        setStartsAt('');
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
              return (
                <li
                  key={event.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800">{event.title}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-[#006E7A]">
                        {eventDate(event.starts_at)} · {formatRelativeDate(event.starts_at)}
                      </p>
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
                      {going ? 'Asistencia confirmada' : 'Voy'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction(() => rsvpClubEvent(event.id, 'not_going'))}
                      aria-label={`No asistir a ${event.title}`}
                      className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${
                        event.my_status === 'not_going'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-slate-200 bg-white text-gray-600 hover:bg-slate-50'
                      }`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                      No voy
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
                <span className="text-[11px] font-bold text-gray-600">Fecha y hora</span>
                <input
                  type="datetime-local"
                  className={`mt-1 ${inputClass}`}
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-gray-600">Lugar</span>
                <input
                  className={`mt-1 ${inputClass}`}
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Plaza principal"
                  maxLength={120}
                />
              </label>
            </div>
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
            <Button type="submit" disabled={busy} className="w-full py-2 text-xs">
              {busy ? 'Guardando…' : 'Publicar actividad'}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
