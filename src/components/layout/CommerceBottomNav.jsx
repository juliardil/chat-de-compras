
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, History, User, Settings } from 'lucide-react';

// Actualización estética Junio 2026

export default function CommerceBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { icon: LayoutDashboard, label: 'Panel', path: '/dashboard' },
    { icon: History, label: 'Estadísticas', path: '/sales-history' },
    { icon: Settings, label: 'Ajustes', path: '/niche-config' },
    { icon: User, label: 'Perfil', path: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-white/30 px-6 py-3 flex justify-between items-center z-50 max-w-md mx-auto">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center gap-1 transition-colors ${
            isActive(item.path) ? 'text-[#00EED0]' : 'text-gray-600 hover:text-[#0197AF]'
          }`}
        >
          <item.icon className={`w-6 h-6 ${isActive(item.path) ? 'fill-current opacity-30' : ''}`} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

