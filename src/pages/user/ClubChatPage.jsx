import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, X } from 'lucide-react';
import ClubChat from '../../components/community/ClubChat';
import ClubEvents from '../../components/community/ClubEvents';
import { useModuleData } from '../../data/useModuleData';
import { fetchClubIdentity } from '../../data/clubAdvanced';

// Pantalla dedicada del chat del club. La cabecera mantiene el contexto del
// club y permite abrir las actividades encima de la conversación sin salir del
// canal. El cuerpo y la barra de envío son los de ClubChat reutilizable.
export default function ClubChatPage() {
  const navigate = useNavigate();
  const { items } = useModuleData(fetchClubIdentity, []);
  const [eventsOpen, setEventsOpen] = useState(false);

  const identity = items[0] || null;
  const title = identity?.name ? `${identity.name} Chat` : 'Chat del club';

  return (
    <div className="flex h-screen flex-col bg-[#E7E7E7]">
      <header className="z-20 shrink-0 rounded-b-2xl border-b border-white/40 bg-white/90 px-4 pb-3 pt-10 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/profile-user')}
            aria-label="Volver al perfil"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#4B227A]/20 bg-white text-[#4B227A] transition hover:bg-[#4B227A]/5"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Canal privado
            </p>
            <h1 className="truncate text-base font-bold text-gray-800">{title}</h1>
          </div>

          <button
            type="button"
            onClick={() => setEventsOpen((value) => !value)}
            aria-expanded={eventsOpen}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#4B227A]/25 bg-[#4B227A]/10 px-2.5 py-2 text-[11px] font-bold text-[#4B227A] transition hover:bg-[#4B227A]/20"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Actividades y rodadas
          </button>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col px-4 py-4">
        {eventsOpen ? (
          <section
            aria-label="Actividades y rodadas"
            className="absolute inset-x-4 inset-y-2 z-10 overflow-y-auto rounded-2xl bg-[#E7E7E7] p-2 shadow-2xl"
          >
            <div className="mb-2 flex items-center justify-between rounded-2xl border border-[#4B227A]/15 bg-white/90 px-3 py-2.5">
              <h2 className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <CalendarDays className="h-4 w-4 text-[#4B227A]" aria-hidden="true" />
                Actividades y rodadas
              </h2>
              <button
                type="button"
                onClick={() => setEventsOpen(false)}
                aria-label="Cerrar actividades"
                className="rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <ClubEvents isOwner={Boolean(identity?.is_owner)} groupId={identity?.group_id} />
          </section>
        ) : null}

        <ClubChat full groupId={identity?.group_id} />
      </main>
    </div>
  );
}
