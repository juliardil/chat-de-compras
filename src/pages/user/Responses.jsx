import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Star, MessageCircle, MapPin, Package, LogOut, Check, X as XIcon } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white px-4 py-3 flex items-center gap-4 shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate('/categories')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-dark">Respuestas</h1>
          <p className="text-xs text-green-600 font-medium">2 ofertas recibidas</p>
        </div>
      </header>

      {/* Fixed Request Summary */}
      <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
        <div className="flex items-start gap-3">
          <div className="bg-white p-2 rounded-lg shadow-sm">
            <span className="text-2xl">📱</span>
          </div>
          <div>
            <h3 className="font-semibold text-dark">iPhone 15 Pro Max</h3>
            <p className="text-sm text-gray-600">Busco color Titanio, 256GB...</p>
          </div>
        </div>
      </div>

      {/* Offers List */}
      <div className="flex-1 p-4 flex flex-col gap-4">
        {OFFERS.map((offer) => (
          <div key={offer.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex gap-4">
              <img src={offer.image} className="w-20 h-20 rounded-xl object-cover bg-gray-100" alt={offer.store} />
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-dark">{offer.store}</h3>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button 
                      onClick={() => setSelectedAvailability(offer.availability)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors hover:opacity-80 ${
                      offer.availability.found === offer.availability.total 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      <Package className="w-3 h-3" />
                      {offer.availability.found}/{offer.availability.total}
                    </button>
                    <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      <MapPin className="w-3 h-3" />
                      {offer.distance}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      {offer.time}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 mb-2">
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  <span className="text-xs font-medium">{offer.rating}</span>
                </div>

                <div className="text-lg font-bold text-primary mb-2">
                  ${offer.price}
                </div>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-4 line-clamp-2 bg-gray-50 p-2 rounded-lg">
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
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedAvailability(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <XIcon className="w-6 h-6" />
            </button>
            
            <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Disponibilidad de Productos
            </h3>

            <div className="space-y-3">
              {selectedAvailability.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  {item.status === 'available' ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                      <Check className="w-3 h-3" /> Disponible
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg">
                      <XIcon className="w-3 h-3" /> No disponible
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm text-gray-500">Resumen</span>
              <span className="font-bold text-dark">
                {selectedAvailability.found} de {selectedAvailability.total} encontrados
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
