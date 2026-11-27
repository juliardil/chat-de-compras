import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MessageSquare, ChevronRight, History } from 'lucide-react';
import UserBottomNav from '../../components/layout/UserBottomNav';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import { EmptyModule, LoadingModule } from '../../components/ui/ModuleState';
import SafeImage from '../../components/ui/SafeImage';
import { useAuth } from '../../context/auth-context';
import { useModuleData } from '../../data/useModuleData';
import {
  fetchChatStageBoard,
  fetchChatThreads,
  fetchDeliveredPurchaseHistory,
  formatCurrency,
  formatRelativeDate,
  mapChatThread,
  NOTICES,
} from '../../data/appData';

// Actualización estética Junio 2026

const CHAT_STAGE_TABS = [
  { key: 'negotiating', label: 'Negociando' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'delivered', label: 'Entregados' },
];

// La sesión de un dueño/comercio trae `commerce` y la de un afiliado activo
// trae `seller`. La membresía activa es un respaldo para sesiones cuyo perfil
// todavía no reflejó el rol; nunca habilita la bandeja de ventas a compradores.
const resolveSalesInboxRole = (user, sellerMembership) => {
  if (['commerce', 'seller'].includes(user?.role)) return user.role;
  if (sellerMembership?.is_active !== true) return null;
  if (sellerMembership.role === 'seller') return 'seller';
  if (sellerMembership.role === 'owner') return 'commerce';
  return null;
};

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
  const { user, sellerMembership } = useAuth();
  const salesRole = resolveSalesInboxRole(user, sellerMembership);
  const isSalesInbox = Boolean(salesRole);
  const dataRole = salesRole || user?.role;
  const [activeStage, setActiveStage] = useState(null);
  const [stageBoard, setStageBoard] = useState({ counts: null, stages: {}, deliveredIds: [], error: null });
  const [showBuyerHistory, setShowBuyerHistory] = useState(false);
  const [deliveryHistory, setDeliveryHistory] = useState({ items: [], loading: false, error: null });

  const { items, loading, error, notice } = useModuleData(
    () => fetchChatThreads({ userId: user?.id, role: dataRole }),
    [user?.id, dataRole]
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

  // La píldora «Entregados» y el acceso del comprador leen el historial real
  // de InsForge. Los hilos entregados siguen fuera de la bandeja activa.
  const showHistoryView = isSalesInbox
    ? activeStage === 'delivered'
    : showBuyerHistory;

  useEffect(() => {
    if (!showHistoryView) return undefined;
    let cancelled = false;
    setDeliveryHistory({ items: [], loading: true, error: null });

    fetchDeliveredPurchaseHistory().then((result) => {
      if (cancelled) return;
      setDeliveryHistory({
        items: result.items,
        loading: false,
        error: result.error || result.notice || null,
      });
    });

    return () => { cancelled = true; };
  }, [showHistoryView]);

  // Doble respaldo de la regla del backend: aunque una respuesta en caché
  // todavía traiga un hilo entregado, no debe aparecer en la bandeja activa.
  const chats = useMemo(
    () => items.map(mapChatThread).filter((chat) => chat.status !== 'archived' && chat.salesStage !== 'delivered'),
    [items]
  );
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
          {salesRole === 'seller' && user?.sellerCommerceName ? (
            <p className="truncate text-[11px] font-semibold text-[#006E7A]">
              Vendedor · {user.sellerCommerceName}
            </p>
          ) : null}
        </div>
        {!isSalesInbox ? (
          <button
            type="button"
            aria-label="Ver historial de entregas"
            aria-pressed={showBuyerHistory}
            onClick={() => setShowBuyerHistory((visible) => !visible)}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#0197AF]/20 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#006E7A] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#00EED0]/40"
          >
            <History className="w-3.5 h-3.5" />
            Historial
          </button>
        ) : null}
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
        {showHistoryView ? (
          <div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/30">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-gray-800">Entregas confirmadas</h2>
                <p className="text-[10px] font-bold text-[#006E7A] uppercase tracking-widest mt-1">
                  Historial de compras
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setActiveStage(null); setShowBuyerHistory(false); }}
                className="shrink-0 rounded-full border border-[#0197AF]/20 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#006E7A] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#00EED0]/40"
              >
                Ver conversaciones
              </button>
            </div>

            {deliveryHistory.loading ? <LoadingModule label="Cargando historial…" /> : null}

            {!deliveryHistory.loading && deliveryHistory.items.map((item) => {
              const openable = Boolean(item.chatId);
              return (
                <div
                  key={`${item.chatId || item.orderId || item.subject}`}
                  role={openable ? 'button' : undefined}
                  tabIndex={openable ? 0 : undefined}
                  aria-label={openable ? `Abrir historial ${item.subject}` : undefined}
                  onClick={openable ? () => navigate(`/chat/${item.chatId}`) : undefined}
                  onKeyDown={openable ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/chat/${item.chatId}`);
                    }
                  } : undefined}
                  className={`bg-white/80 backdrop-blur-md p-4 border-b border-white/30 flex gap-4 ${
                    openable ? 'hover:bg-white/90 transition-colors cursor-pointer' : ''
                  }`}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-[#00EED0]/30 to-[#4B227A]/30 rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-[#006E7A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-bold text-gray-800 text-sm truncate">
                        {item.store || item.seller || item.subject}
                      </h3>
                      <span className="text-[10px] text-gray-600 whitespace-nowrap ml-2">
                        {formatRelativeDate(item.deliveredAt)}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#006E7A] truncate">{item.subject}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="rounded-full bg-[#00EED0]/25 px-2 py-0.5 text-[10px] font-black text-[#006E7A]">
                        Entregado
                      </span>
                      {Number.isFinite(item.total) ? (
                        <span className="text-[11px] font-bold text-[#4B227A]">
                          {formatCurrency(item.total, item.currency)}
                        </span>
                      ) : null}
                      {item.seller ? (
                        <span className="text-[10px] text-gray-600 truncate">
                          Vendedor: {item.seller}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {openable ? (
                    <div className="self-center">
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </div>
                  ) : null}
                </div>
              );
            })}

            {!deliveryHistory.loading && deliveryHistory.items.length === 0 ? (
              <div className="p-4">
                <EmptyModule
                  icon={History}
                  title="Sin entregas todavía"
                  description="Cuando confirmes que el producto llegó y todo está bien, la compra aparecerá aquí."
                  notice={deliveryHistory.error}
                  tone={deliveryHistory.error ? 'error' : 'info'}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {['commerce', 'seller'].includes(dataRole) ? <CommerceBottomNav /> : <UserBottomNav />}
    </div>
  );
}
