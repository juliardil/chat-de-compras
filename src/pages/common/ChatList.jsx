import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, ChevronRight } from 'lucide-react';
import UserBottomNav from '../../components/layout/UserBottomNav';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import { EmptyModule, LoadingModule } from '../../components/ui/ModuleState';
import SafeImage from '../../components/ui/SafeImage';
import { useAuth } from '../../context/auth-context';
import { useModuleData } from '../../data/useModuleData';
import { fetchChatStageBoard, fetchChatThreads, mapChatThread, NOTICES } from '../../data/appData';

// Actualización estética Junio 2026

const CHAT_STAGE_TABS = [
  { key: 'negotiating', label: 'Negociando' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'delivered', label: 'Entregados' },
];

const initialsOf = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

export default function ChatList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSalesInbox = ['commerce', 'seller'].includes(user?.role);
  const [activeStage, setActiveStage] = useState(null);
  const [stageBoard, setStageBoard] = useState({ counts: null, stages: {}, error: null });

  const { items, loading, error, notice } = useModuleData(
    () => fetchChatThreads({ userId: user?.id, role: user?.role }),
    [user?.id, user?.role]
  );

  // Los contadores y la etapa de cada hilo se leen de InsForge. Se refrescan
  // al volver a la pestaña (navegar de vuelta desde el chat remonta la vista)
  // y mientras la bandeja permanece abierta, sin cambiar el estado local.
  useEffect(() => {
    if (!isSalesInbox) return undefined;
    let cancelled = false;

    const loadBoard = () => {
      fetchChatStageBoard().then((board) => {
        if (!cancelled) setStageBoard(board);
      });
    };

    loadBoard();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') loadBoard();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const interval = window.setInterval(refreshWhenVisible, 30000);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, [isSalesInbox]);

  const chats = useMemo(() => items.map(mapChatThread), [items]);
  const stageCounts = useMemo(() => {
    const fallback = { negotiating: 0, pending: 0, delivered: 0 };
    chats.forEach((chat) => {
      const stage = stageBoard.stages?.[chat.id] || chat.salesStage;
      if (fallback[stage] !== undefined) fallback[stage] += 1;
    });
    return stageBoard.counts || fallback;
  }, [chats, stageBoard.counts, stageBoard.stages]);
  const visibleChats = useMemo(
    () => (activeStage
      ? chats.filter((chat) => (stageBoard.stages?.[chat.id] || chat.salesStage) === activeStage)
      : chats),
    [chats, stageBoard.stages, activeStage]
  );

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <header className="bg-white/80 backdrop-blur-md px-4 py-4 border-b border-white/30 flex items-center gap-4 sticky top-0 z-10">
        <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/70 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-800">Mis Chats</h1>
          {user?.role === 'seller' && user?.sellerCommerceName ? (
            <p className="truncate text-[11px] font-semibold text-[#006E7A]">
              Vendedor · {user.sellerCommerceName}
            </p>
          ) : null}
        </div>
      </header>

      {isSalesInbox ? (
        <div className="px-4 py-2 border-b border-white/30">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Etapas de conversación">
            {CHAT_STAGE_TABS.map((tab) => {
              const active = activeStage === tab.key;
              const count = Number(stageCounts[tab.key]) || 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${tab.label} (${count})`}
                  title={active ? 'Ver todas las conversaciones' : `Filtrar por ${tab.label}`}
                  onClick={() => setActiveStage(active ? null : tab.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#00EED0]/40 ${
                    active
                      ? 'bg-[#00EED0] text-[#006E7A] border-[#00EED0] font-bold'
                      : 'bg-white/80 text-[#006E7A] border-[#0197AF]/20 font-semibold hover:bg-white'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-black ${
                      active ? 'bg-white/70 text-[#006E7A]' : 'bg-[#00EED0]/25 text-[#006E7A]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col">
        {loading ? <LoadingModule label="Cargando conversaciones…" /> : null}

        {!loading && visibleChats.map((chat) => (
          <div
            key={chat.id}
            role="button"
            tabIndex={0}
            aria-label={`Abrir conversación ${chat.subject}`}
            onClick={() => navigate(`/chat/${chat.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/chat/${chat.id}`);
              }
            }}
            className="bg-white/80 backdrop-blur-md p-4 border-b border-white/30 flex gap-4 hover:bg-white/90 transition-colors cursor-pointer"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-[#00EED0]/30 to-[#4B227A]/30 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
              {chat.avatar ? (
                <SafeImage
                  src={chat.avatar}
                  alt={`Foto de ${chat.counterpartName || chat.subject}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-[#4B227A]">
                  {initialsOf(chat.counterpartName) || <MessageSquare className="w-6 h-6 text-gray-700" />}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-gray-800 text-sm truncate">
                  {chat.counterpartName || chat.subject}
                </h3>
                <span className="text-[10px] text-gray-600 whitespace-nowrap ml-2">{chat.time}</span>
              </div>
              {chat.counterpartRole === 'seller' ? (
                <p className="text-xs font-medium text-[#006E7A] truncate">
                  {chat.sellerName || chat.counterpartName} · Vendedor de{' '}
                  {chat.storeName || chat.subject}
                </p>
              ) : (
                <p className="text-xs font-medium text-[#006E7A] truncate">
                  {chat.counterpartName ? chat.subject : chat.status}
                </p>
              )}
            </div>

            <div className="self-center">
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </div>
          </div>
        ))}

        {!loading && visibleChats.length === 0 && (
          <div className="p-4">
            <EmptyModule
              icon={MessageSquare}
              title="Sin chats"
              description={activeStage
                ? 'No hay conversaciones en esta etapa.'
                : 'Cuando inicies una conversación con un comercio aparecerá aquí.'}
              notice={error || notice || NOTICES.chats}
              tone={error ? 'error' : 'info'}
            />
          </div>
        )}
      </div>

      {['commerce', 'seller'].includes(user?.role) ? <CommerceBottomNav /> : <UserBottomNav />}
    </div>
  );
}
