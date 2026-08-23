
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Clock, ChevronRight, User } from 'lucide-react';
import clsx from 'clsx';
import UserBottomNav from '../../components/layout/UserBottomNav';

// Actualización estética Junio 2026

export default function ChatList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('open'); // 'open' | 'new'

  const openChats = [
    {
      id: 1,
      user: 'Juan P.',
      product: 'iPhone 15 Pro Max',
      lastMessage: '¿Podemos cerrar en $1150?',
      time: 'Hace 5 min',
      unread: 2,
      avatar: 'JP'
    },
    {
      id: 2,
      user: 'Ana M.',
      product: 'MacBook Air M2',
      lastMessage: 'Perfecto, mañana paso por él.',
      time: 'Hace 2h',
      unread: 0,
      avatar: 'AM'
    }
  ];

  const newChats = [
    {
      id: 3,
      user: 'Carlos R.',
      product: 'Sony WH-1000XM5',
      lastMessage: 'Hola, vi tu oferta. Me interesa.',
      time: 'Hace 10 min',
      unread: 1,
      avatar: 'CR'
    }
  ];

  const currentList = activeTab === 'open' ? openChats : newChats;

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <header className="bg-white/80 backdrop-blur-md px-4 py-4 border-b border-white/30 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/70 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Mis Chats</h1>
      </header>

      {/* Tabs */}
      <div className="bg-white/80 backdrop-blur-md px-4 pt-2 pb-0 flex border-b border-white/30">
        <button
          onClick={() => setActiveTab('open')}
          className={clsx(
            "flex-1 py-3 text-sm font-bold border-b-2 transition-colors",
            activeTab === 'open' 
              ? "border-[#00EED0] text-[#00EED0]" 
              : "border-transparent text-gray-600 hover:text-[#0197AF]"
          )}
        >
          Abiertos ({openChats.length})
        </button>
        <button
          onClick={() => setActiveTab('new')}
          className={clsx(
            "flex-1 py-3 text-sm font-bold border-b-2 transition-colors",
            activeTab === 'new' 
              ? "border-[#0197AF] text-[#0197AF]" 
              : "border-transparent text-gray-600 hover:text-[#4B227A]"
          )}
        >
          Nuevos ({newChats.length})
        </button>
      </div>

      <div className="flex flex-col">
        {currentList.map((chat) => (
          <div 
            key={chat.id} 
            onClick={() => navigate(`/chat/${chat.id}`)} // Navegaría al chat individual
            className="bg-white/80 backdrop-blur-md p-4 border-b border-white/30 flex gap-4 hover:bg-white/90 transition-colors cursor-pointer"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-[#00EED0]/30 to-[#4B227A]/30 rounded-full flex items-center justify-center shrink-0 font-bold text-gray-700 relative">
              {chat.avatar}
              {chat.unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#00EED0] text-black text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                  {chat.unread}
                </span>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-gray-800 text-sm truncate">{chat.user}</h3>
                <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">{chat.time}</span>
              </div>
              <p className="text-xs font-medium text-[#0197AF] mb-1 truncate">{chat.product}</p>
              <p className={clsx(
                "text-sm truncate",
                chat.unread > 0 ? "text-gray-800 font-medium" : "text-gray-500"
              )}>
                {chat.lastMessage}
              </p>
            </div>
            
            <div className="self-center">
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        ))}

        {currentList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center mb-4 border border-white/30">
              <MessageSquare className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-700">No hay chats aquí</h3>
            <p className="text-sm text-gray-500 mt-1">
              {activeTab === 'open' ? 'No tienes conversaciones activas.' : 'No tienes mensajes nuevos.'}
            </p>
          </div>
        )}
      </div>
      
      <UserBottomNav />
    </div>
  );
}

