import React, { useState } from 'react';
import { Crown, UserRound, Users, X } from 'lucide-react';
import SafeImage from '../ui/SafeImage';
import { DataNotice, EmptyModule, LoadingModule } from '../ui/ModuleState';
import { useModuleData } from '../../data/useModuleData';
import { fetchClubMembers } from '../../data/clubAdvanced';

const ROLE_LABELS = {
  owner: 'Responsable',
  member: 'Miembro',
};

const initials = (name) =>
  String(name || 'M')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'M';

// Enlace "Ver miembros" junto al progreso del club. El modal muestra únicamente
// los integrantes devueltos por la RPC app_group_members (nunca datos de ejemplo).
export default function ClubMembers() {
  const { items, loading, error, notice } = useModuleData(fetchClubMembers, []);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-[#4B227A]/20 bg-white px-2 py-1 text-[11px] font-bold text-[#4B227A] transition hover:bg-[#4B227A]/5"
      >
        <Users className="h-3 w-3" aria-hidden="true" />
        Ver miembros
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-members-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Tu club
                </p>
                <h3 id="club-members-title" className="text-base font-bold text-gray-800">
                  Miembros del club
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar lista de miembros"
                className="rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4">
              {loading ? <LoadingModule label="Cargando miembros…" /> : null}

              {!loading && (error || notice) ? (
                <DataNotice tone={error ? 'error' : 'info'}>
                  {error || notice}
                </DataNotice>
              ) : null}

              {!loading && items.length === 0 && !error ? (
                <EmptyModule
                  icon={Users}
                  title="Todavía no hay miembros"
                  description="Cuando alguien se una al club aparecerá aquí."
                />
              ) : null}

              {items.length > 0 ? (
                <ul className="space-y-2">
                  {items.map((member) => (
                    <li
                      key={member.user_id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#4B227A]/10 text-xs font-bold text-[#4B227A]">
                        {member.avatar_url ? (
                          <SafeImage
                            src={member.avatar_url}
                            alt={`Avatar de ${member.display_name}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials(member.display_name)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-gray-800">
                            {member.display_name}
                          </span>
                          {member.is_me ? (
                            <span className="shrink-0 rounded-full bg-[#0197AF]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#006E7A]">
                              Tú
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                          {member.role === 'owner' ? (
                            <Crown className="h-3 w-3 text-amber-500" aria-hidden="true" />
                          ) : (
                            <UserRound className="h-3 w-3" aria-hidden="true" />
                          )}
                          {ROLE_LABELS[member.role] || 'Miembro'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
