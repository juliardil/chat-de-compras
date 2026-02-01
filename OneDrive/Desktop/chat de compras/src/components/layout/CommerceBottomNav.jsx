import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, History, User, Settings } from 'lucide-react';

export default function CommerceBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { icon: LayoutDashboard, label: 'Panel', path: '/dashboard' },
    { icon: History, label: 'Ventas', path: '/sales-history' },
    { icon: Settings, label: 'Nichos', path: '/niche-config' },
    { icon: User, label: 'Perfil', path: '/profile' },
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
