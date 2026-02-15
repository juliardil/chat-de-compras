import React from 'react';
import { useNavigate } from 'react-router-dom';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { Shirt, Smartphone, Car, Search } from 'lucide-react';

export default function Categories() {
  const navigate = useNavigate();

  const categories = [
    { 
      id: 'fashion', 
      name: 'Moda', 
      icon: Shirt, 
      color: 'bg-pink-500', 
      gradient: 'from-pink-500 to-rose-500',
      image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=500' 
    },
    { 
      id: 'tech', 
      name: 'Tecnología', 
      icon: Smartphone, 
      color: 'bg-blue-500', 
      gradient: 'from-blue-500 to-indigo-600',
      image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=500'
    },
    { 
      id: 'auto', 
      name: 'Automotriz', 
      icon: Car, 
      color: 'bg-orange-500', 
      gradient: 'from-orange-500 to-red-600',
      image: 'https://images.unsplash.com/photo-1533473359331-0135ef1bcfb0?auto=format&fit=crop&q=80&w=500'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-dark">Explorar</h1>
          <p className="text-xs text-gray-500">Selecciona una categoría</p>
        </div>
      </header>

      {/* Categories Grid */}
      <div className="px-6 pt-4 grid grid-cols-1 gap-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => navigate('/niches', { state: { category: cat.id } })}
            className="relative h-40 rounded-2xl overflow-hidden shadow-md group active:scale-[0.98] transition-all"
          >
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors z-10" />
            <img 
              src={cat.image} 
              alt={cat.name} 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className={`absolute bottom-0 left-0 p-5 z-20 w-full bg-gradient-to-t from-black/80 to-transparent`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${cat.color} bg-opacity-90 backdrop-blur-sm`}>
                  <cat.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-white tracking-wide">{cat.name}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <UserBottomNav />
    </div>
  );
}
