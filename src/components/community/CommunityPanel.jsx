import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  Copy,
  KeyRound,
  LogOut,
  MessageCircle,
  Plus,
  Users,
} from 'lucide-react';
import Button from '../ui/Button';
import { DataNotice, EmptyModule, LoadingModule } from '../ui/ModuleState';
import { useModuleData } from '../../data/useModuleData';
import {
  createGroup,
  fetchMyGroup,
  joinGroup,
  leaveGroup,
} from '../../data/community';
import ClubIdentity from './ClubIdentity';
import ClubMembers from './ClubMembers';
import ClubSponsorAvatars from './ClubSponsorAvatars';

const inputClass =
  'w-full rounded-xl border border-[#4B227A]/20 bg-white/80 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20';

const progress = (count, minimum) => {
  if (!Number.isFinite(minimum) || minimum <= 0) return 0;
  return Math.min(100, Math.round((Math.max(0, count) / minimum) * 100));
};

// Sección "Mi Comunidad / Club" del perfil comprador.
// Toda la lectura y escritura pasa por RPCs del módulo de comunidades.
export default function CommunityPanel() {
  const navigate = useNavigate();
  const { items, loading, error, notice, reload } = useModuleData(fetchMyGroup, []);
  const group = items[0] || null;

  const [mode, setMode] = useState('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [copied, setCopied] = useState(false);

  const runAction = async (action) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setName('');
      setCode('');
      setCopied(false);
      reload();
    } catch (err) {
      setActionError(err?.message || 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!group?.invite_code) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(group.invite_code);
      }
      setCopied(true);
    } catch {
      setActionError('No se pudo copiar el código. Cópialo manualmente.');
    }
  };

  const count = Number(group?.member_count || 0);
  const minimum = Number(group?.min_members || 0);
  const missing = Math.max(0, minimum - count);
  const verified = Boolean(group?.is_verified);

  return (
    <section className="px-6 mt-8" aria-labelledby="community-panel-title">
      <div className="flex items-center gap-2 mb-4 ml-1">
        <Users className="w-4 h-4 text-[#4B227A]" aria-hidden="true" />
        <h3
          id="community-panel-title"
          className="text-sm font-bold text-gray-600 uppercase tracking-widest"
        >
          Mi Comunidad / Club
        </h3>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-sm overflow-hidden border border-white/30 p-4">
        {loading ? <LoadingModule label="Cargando tu club…" /> : null}

        {!loading && actionError ? (
          <DataNotice tone="error" className="mb-3">
            {actionError}
          </DataNotice>
        ) : null}

        {!loading && group ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Club actual
                </p>
                <h4 className="text-lg font-bold text-gray-800 break-words">{group.name}</h4>
              </div>
              {verified ? (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-[11px] font-bold text-green-700">
                  <Check className="w-3 h-3" aria-hidden="true" /> Verificado
                </span>
              ) : null}
            </div>

            <ClubIdentity group={group} onUpdated={reload} />
            <ClubSponsorAvatars />

            <div className="mt-4 rounded-2xl border border-[#4B227A]/15 bg-white/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Código de invitación
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="text-base font-bold tracking-[0.2em] text-[#4B227A] break-all">
                  {group.invite_code}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[#0197AF]/30 bg-[#0197AF]/10 px-2.5 py-1.5 text-xs font-bold text-[#006E7A] hover:bg-[#0197AF]/20"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="mt-4" aria-label="Progreso de miembros">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                <span>Miembros</span>
                <span className="flex items-center gap-2">
                  <span aria-live="polite">
                    {count} / {minimum}
                  </span>
                  <ClubMembers />
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#4B227A]/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00EED0] to-[#0197AF] transition-all"
                  style={{ width: `${progress(count, minimum)}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-gray-600">
                {verified
                  ? 'Tu club alcanzó el mínimo de participantes.'
                  : `Faltan ${missing} ${missing === 1 ? 'miembro' : 'miembros'} para verificar el club.`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/club-chat')}
              className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-[#0197AF]/25 bg-gradient-to-r from-white/85 to-[#0197AF]/10 p-3 text-left transition hover:border-[#0197AF]/50 hover:bg-white"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0197AF]/15 text-[#006E7A]">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-gray-800">Chat del club</span>
                <span className="block text-[11px] text-gray-600">
                  Abre el canal privado de tu club
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#006E7A]" aria-hidden="true" />
            </button>

            <Button
              type="button"
              variant="ghost"
              fullWidth
              disabled={busy}
              onClick={() =>
                runAction(() => leaveGroup())
              }
              className="mt-4 text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" /> Salir del club
            </Button>
          </div>
        ) : null}

        {!loading && !group ? (
          <EmptyModule
            icon={Users}
            title="Todavía no perteneces a un club"
            description="Crea el tuyo y comparte el código, o únete a uno existente con el código de invitación."
            notice={error || notice}
            tone={error ? 'error' : 'info'}
          >
            <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Acción de club">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'create'}
                onClick={() => {
                  setMode('create');
                  setActionError(null);
                }}
                className={`rounded-lg px-2 py-2 text-xs font-bold transition-colors ${
                  mode === 'create'
                    ? 'bg-[#4B227A] text-white'
                    : 'bg-white/70 text-[#4B227A] border border-[#4B227A]/20'
                }`}
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" /> Crear club
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'join'}
                onClick={() => {
                  setMode('join');
                  setActionError(null);
                }}
                className={`rounded-lg px-2 py-2 text-xs font-bold transition-colors ${
                  mode === 'join'
                    ? 'bg-[#4B227A] text-white'
                    : 'bg-white/70 text-[#4B227A] border border-[#4B227A]/20'
                }`}
              >
                <KeyRound className="mr-1 inline h-3.5 w-3.5" /> Unirme con código
              </button>
            </div>

            <form
              className="mt-3 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (busy) return;
                if (mode === 'create') {
                  runAction(() => createGroup({ name, inviteCode: code || null }));
                } else {
                  runAction(() => joinGroup({ inviteCode: code }));
                }
              }}
            >
              {mode === 'create' ? (
                <>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-700">Nombre del club</span>
                    <input
                      className={`mt-1 ${inputClass}`}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Ej. Club de repuestos del sur"
                      maxLength={80}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-700">
                      Código de invitación (opcional)
                    </span>
                    <input
                      className={`mt-1 ${inputClass}`}
                      value={code}
                      onChange={(event) => setCode(event.target.value.toUpperCase())}
                      placeholder="Se genera uno automáticamente"
                      maxLength={20}
                    />
                  </label>
                </>
              ) : (
                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">Código de invitación</span>
                  <input
                    className={`mt-1 ${inputClass}`}
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder="Ingresa el código que te compartieron"
                    maxLength={20}
                    required
                  />
                </label>
              )}

              <Button type="submit" fullWidth disabled={busy}>
                {mode === 'create' ? 'Crear club' : 'Unirme al club'}
              </Button>
            </form>
          </EmptyModule>
        ) : null}
      </div>
    </section>
  );
}
