import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, List, History, User } from 'lucide-react';

export default function UserBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { icon: Home, label: 'Inicio', path: '/categories' },
    { icon: List, label: 'Solicitudes', path: '/tracking' },
    { icon: History, label: 'Historial', path: '/history' },
    // { icon: User, label: 'Perfil', path: '/profile-user' }, // Not explicitly requested but good practice
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 max-w-md mx-auto">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center gap-1 transition-colors ${
            isActive(item.path) ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <item.icon className={`w-6 h-6 ${isActive(item.path) ? 'fill-current opacity-20' : ''}`} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
