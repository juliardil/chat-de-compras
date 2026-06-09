
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Star, MessageCircle, MapPin, Package, LogOut, Check, X as XIcon } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

// Actualización estética Junio 2026

const OFFERS = [
  {
    id: 1,
    store: 'TechMaster',
    price: 1200,
    time: '2 min',
    distance: '1.2 km',
    rating: 4.8,
    availability: { 
      found: 3, 
      total: 3,
      items: [
        { name: 'iPhone 15 Pro Max', status: 'available' },
        { name: 'Funda MagSafe', status: 'available' },
        { name: 'Protector de Pantalla', status: 'available' }
      ]
    },
    image: 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?auto=format&fit=crop&q=80&w=200',
    description: 'iPhone 15 Pro Max 256GB - Nuevo Sellado. Garantía 1 año Apple.'
  },
  {
    id: 2,
    store: 'iShop Center',
    price: 1150,
    time: '5 min',
    distance: '3.5 km',
    rating: 4.5,
    availability: { 
      found: 2, 
      total: 3,
      items: [
        { name: 'iPhone 15 Pro Max', status: 'available' },
        { name: 'Funda MagSafe', status: 'available' },
        { name: 'Protector de Pantalla', status: 'missing' }
      ]
    },
    image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&q=80&w=200',
    description: 'Disponible en Titanio Natural. Entrega inmediata.'
  }
];

export default function Responses() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [selectedAvailability, setSelectedAvailability] = useState(null);

  return (
    <div className="min-h-screen bg-[#E7E7E7] flex flex-col">
      <header className="bg-white/80 backdrop-blur-md px-4 py-3 flex items-center gap-4 shadow-sm sticky top-0 z-10 border-b border-white/30">
        <button onClick={() => navigate('/categories')} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Respuestas</h1>
          <p className="text-xs text-[#00EED0] font-medium">2 ofertas recibidas</p>
        </div>
      </header>

      {/* Fixed Request Summary */}
      <div className="bg-[#0197AF]/10 px-6 py-4 border-b border-[#0197AF]/20">
        <div className="flex items-start gap-3">
          <div className="bg-white/80 p-2 rounded-lg shadow-sm border border-white/30">
            <span className="text-2xl">📱</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">iPhone 15 Pro Max</h3>
            <p className="text-sm text-gray-600">Busco color Titanio, 256GB...</p>
          </div>
        </div>
      </div>

      {/* Offers List */}
      <div className="flex-1 p-4 flex flex-col gap-4">
        {OFFERS.map((offer) => (
          <div key={offer.id} className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white/30">
            <div className="flex gap-4">
              <img src={offer.image} className="w-20 h-20 rounded-xl object-cover bg-white/70" alt={offer.store} />
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-gray-800">{offer.store}</h3>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button 
                      onClick={() => setSelectedAvailability(offer.availability)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors hover:opacity-80 border ${
                      offer.availability.found === offer.availability.total 
                        ? 'bg-[#00EED0]/20 text-[#4B227A] border-[#00EED0]/30' 
                        : 'bg-[#4B227A]/20 text-[#4B227A] border-[#4B227A]/30'
                    }`}>
                      <Package className="w-3 h-3" />
                      {offer.availability.found}/{offer.availability.total}
                    </button>
                    <div className="flex items-center gap-1 text-xs text-gray-600 bg-white/70 px-2 py-1 rounded-full border border-white/30">
                      <MapPin className="w-3 h-3" />
                      {offer.distance}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600 bg-white/70 px-2 py-1 rounded-full border border-white/30">
                      <Clock className="w-3 h-3" />
                      {offer.time}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 mb-2">
                  <Star className="w-3 h-3 text-[#00EED0] fill-current" />
                  <span className="text-xs font-medium">{offer.rating}</span>
                </div>

                <div className="text-lg font-bold text-[#00EED0] mb-2">
                  ${offer.price}
                </div>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-4 line-clamp-2 bg-white/70 p-2 rounded-lg border border-white/30">
              {offer.description}
            </p>

            <Button 
              fullWidth 
              size="sm"
              onClick={() => navigate(`/chat/${offer.id}`)}
              className="py-2.5"
            >
              <MessageCircle className="w-4 h-4" />
              CHATEAR
            </Button>
          </div>
        ))}
      </div>
      {/* Availability Modal */}
      {selectedAvailability && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white/80 backdrop-blur-md w-full max-w-sm rounded-2xl p-6 shadow-xl border border-white/30 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedAvailability(null)}
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-800"
            >
              <XIcon className="w-6 h-6" />
            </button>
            
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#00EED0]" />
              Disponibilidad de Productos
            </h3>

            <div className="space-y-3">
              {selectedAvailability.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/70 border border-white/30">
                  <span className="text-sm font-medium text-gray-800">{item.name}</span>
                  {item.status === 'available' ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-[#4B227A] bg-[#00EED0]/20 px-2 py-1 rounded-lg border border-[#00EED0]/30">
                      <Check className="w-3 h-3" /> Disponible
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-gray-800 bg-[#4B227A]/20 px-2 py-1 rounded-lg border border-[#4B227A]/30">
                      <XIcon className="w-3 h-3" /> No disponible
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/30 flex justify-between items-center">
              <span className="text-sm text-gray-600">Resumen</span>
              <span className="font-bold text-gray-800">
                {selectedAvailability.found} de {selectedAvailability.total} encontrados
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

