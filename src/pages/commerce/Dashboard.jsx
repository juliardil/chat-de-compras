import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import Button from '../../components/ui/Button';
import { TrendingUp, Users, DollarSign, Clock, Bell, Send, CheckCircle2, Eye, X, MessageSquare } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [offeringId, setOfferingId] = useState(null);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  const [price, setPrice] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleStartOffer = (id) => {
    setOfferingId(id);
    setPrice('');
  };

  const handleSendOffer = (opp) => {
    if (!price) return;
    
    // Simular envío
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setOfferingId(null);
      // Opcional: Navegar al chat o mostrar notificación
      // navigate('/chat/new'); 
    }, 2000);
  };

  const stats = [
    { label: 'Ventas hoy', value: '$2,450', icon: DollarSign, color: 'bg-green-100 text-green-600' },
    { label: 'Leads activos', value: '12', icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Conversión', value: '18%', icon: TrendingUp, color: 'bg-purple-100 text-purple-600' },
  ];

  const opportunities = [
    { 
      id: 1, 
      product: 'iPhone 15 Pro Max', 
      user: 'Juan P.', 
      time_left: '04:30', 
      budget: '$1,200', 
      details: 'Busco iPhone 15 Pro Max color Titanio Natural de 256GB. Nuevo o como nuevo, con caja y accesorios originales. Pago inmediato.',
      image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?q=80&w=800&auto=format&fit=crop'
    },
    { 
      id: 2, 
      product: 'MacBook Air M2', 
      user: 'Ana M.', 
      time_left: '01:15', 
      budget: '$1,100', 
      details: 'MacBook Air M2 13 pulgadas, 8GB RAM, 256GB SSD. Color Gris Espacial o Medianoche. Necesito factura para garantía.',
      image: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?q=80&w=800&auto=format&fit=crop'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white px-6 py-5 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-dark">Panel de Control</h1>
          <p className="text-sm text-gray-500">Hola, TechMaster 👋</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/chat-list')} className="p-2 bg-gray-50 rounded-full relative hover:bg-gray-100 transition-colors">
            <MessageSquare className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white"></span>
          </button>
          <button onClick={() => navigate('/notifications')} className="p-2 bg-gray-50 rounded-full relative hover:bg-gray-100 transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="px-4 py-2 grid grid-cols-3 gap-2">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center text-center">
            <div className={`p-1.5 rounded-md mb-1 ${stat.color}`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-dark">{stat.value}</span>
            <span className="text-[10px] text-gray-400">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="px-6 py-2">
        <h2 className="font-bold text-dark text-lg mb-4">Oportunidades activas</h2>
        <div className="flex flex-col gap-4">
          {opportunities.map((opp) => (
            <div key={opp.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-red-50 px-3 py-1 rounded-bl-xl text-xs font-bold text-red-600 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {opp.time_left}
              </div>

              <div className="mb-3 pr-20">
                <h3 className="font-bold text-dark text-lg">{opp.product}</h3>
                <p className="text-sm text-gray-500">{opp.details}</p>
              </div>

              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                      {opp.user.charAt(0)}
                    </div>
                    <span className="text-sm text-gray-600">{opp.user}</span>
                 </div>
                 <button 
                    onClick={() => setSelectedOpp(opp)}
                    className="font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-primary/20 transition-colors"
                 >
                   <Eye className="w-4 h-4" /> Ver detalles
                 </button>
              </div>

              {offeringId === opp.id ? (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {showSuccess ? (
                    <div className="bg-green-100 text-green-700 p-3 rounded-xl flex items-center justify-center gap-2 font-bold animate-pulse">
                      <CheckCircle2 className="w-5 h-5" />
                      ¡Oferta Enviada!
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                        <input 
                          type="number" 
                          className="w-full bg-gray-50 border border-primary rounded-xl pl-8 pr-4 py-3 text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-lg"
                          placeholder="Tu precio"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <Button 
                        fullWidth 
                        size="sm" 
                        onClick={() => handleSendOffer(opp)}
                        className="bg-green-600 hover:bg-green-700 text-white shadow-green-200"
                        disabled={!price}
                      >
                        LO TENGO <Send className="w-4 h-4 ml-1" />
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <Button fullWidth size="sm" onClick={() => handleStartOffer(opp.id)}>
                  OFERTAR AHORA
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Detalles */}
      {selectedOpp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedOpp(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
            
            <h2 className="text-xl font-bold text-dark mb-1">{selectedOpp.product}</h2>
            <p className="text-sm text-gray-500 mb-6 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Finaliza en {selectedOpp.time_left}
            </p>

            <div className="space-y-4 mb-6">
              {/* Imagen del producto */}
              {selectedOpp.image && (
                <div 
                  className="relative h-48 w-full rounded-xl overflow-hidden cursor-pointer group"
                  onClick={() => setViewImage(selectedOpp.image)}
                >
                  <img 
                    src={selectedOpp.image} 
                    alt={selectedOpp.product} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white font-bold flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm text-sm">
                      <Eye className="w-4 h-4" /> Ver foto completa
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-xl">
                <span className="text-xs text-gray-500 block mb-1">Descripción</span>
                <p className="text-dark font-medium">{selectedOpp.details}</p>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 p-3 rounded-xl">
                  <span className="text-xs text-green-600 block mb-1">Presupuesto</span>
                  <p className="text-green-700 font-bold text-lg">{selectedOpp.budget}</p>
                </div>
                <div className="flex-1 bg-blue-50 p-3 rounded-xl">
                  <span className="text-xs text-blue-600 block mb-1">Usuario</span>
                  <p className="text-blue-700 font-bold">{selectedOpp.user}</p>
                </div>
              </div>
            </div>

            <Button fullWidth onClick={() => {
              handleStartOffer(selectedOpp.id);
              setSelectedOpp(null);
            }}>
              OFERTAR AHORA
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Imagen Fullscreen */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <button 
            onClick={() => setViewImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={viewImage} 
            alt="Detalle" 
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-300"
          />
        </div>
      )}

      <CommerceBottomNav />
    </div>
  );
}
