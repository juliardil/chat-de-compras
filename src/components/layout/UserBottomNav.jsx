
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Tags, User } from 'lucide-react';

// Actualización estética Junio 2026

export default function UserBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { icon: Search, label: 'Buscador', path: '/categories' },
    { icon: Tags, label: 'Ofertas', path: '/offers' },
    { icon: User, label: 'Perfil', path: '/profile-user' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-white/30 px-6 py-3 flex justify-between items-center z-50 max-w-md mx-auto">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          aria-current={isActive(item.path) ? 'page' : undefined}
          className={`flex flex-col items-center gap-1 transition-colors ${
            isActive(item.path) ? 'text-[#006E7A]' : 'text-gray-600 hover:text-[#006E7A]'
          }`}
        >
          <item.icon className={`w-6 h-6 ${isActive(item.path) ? 'fill-current opacity-30' : ''}`} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

