import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, ChevronRight } from 'lucide-react';
import UserBottomNav from '../../components/layout/UserBottomNav';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import { EmptyModule, LoadingModule } from '../../components/ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import { useModuleData } from '../../data/useModuleData';
import { fetchChatThreads, mapChatThread, NOTICES } from '../../data/appData';

// Actualización estética Junio 2026

export default function ChatList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { items, loading, error, notice } = useModuleData(
    () => fetchChatThreads({ userId: user?.id, role: user?.role }),
    [user?.id, user?.role]
  );

  const chats = items.map(mapChatThread);

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <header className="bg-white/80 backdrop-blur-md px-4 py-4 border-b border-white/30 flex items-center gap-4 sticky top-0 z-10">
        <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/70 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Mis Chats</h1>
      </header>

      <div className="flex flex-col">
        {loading ? <LoadingModule label="Cargando conversaciones…" /> : null}

        {!loading && chats.map((chat) => (
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
            <div className="w-12 h-12 bg-gradient-to-br from-[#00EED0]/30 to-[#4B227A]/30 rounded-full flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-gray-700" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-gray-800 text-sm truncate">{chat.subject}</h3>
                <span className="text-[10px] text-gray-600 whitespace-nowrap ml-2">{chat.time}</span>
              </div>
              <p className="text-xs font-medium text-[#006E7A] capitalize">{chat.status}</p>
            </div>

            <div className="self-center">
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </div>
          </div>
        ))}

        {!loading && chats.length === 0 && (
          <div className="p-4">
            <EmptyModule
              icon={MessageSquare}
              title="Sin chats"
              description="Cuando inicies una conversación con un comercio aparecerá aquí."
              notice={error || notice || NOTICES.chats}
              tone={error ? 'error' : 'info'}
            />
          </div>
        )}
      </div>

      {user?.role === 'commerce' ? <CommerceBottomNav /> : <UserBottomNav />}
    </div>
  );
}
