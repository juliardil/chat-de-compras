import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Package, Tag, MessageSquare, Truck, CheckCircle } from 'lucide-react';

export default function Notifications() {
  const navigate = useNavigate();

  const notifications = [
    { id: 1, type: 'promo', title: 'Promociones de hoy', text: '¡Flash Sale! 30% de descuento en Tecnología y Moda hasta medianoche.', time: 'Hace 5 min', read: false },
    { id: 5, type: 'shipping', title: 'Pedidos', text: 'Tienes 1 pedido en camino y 2 entregados. Toca para ver detalles.', time: 'Actualizado hoy', read: false },
    { id: 2, type: 'chat', title: 'Mensaje nuevo', text: 'Tienes un mensaje sin leer de ModaUrbana.', time: 'Hace 1h', read: true },
    { id: 3, type: 'system', title: 'Bienvenido a Chat Express', text: 'Completa tu perfil para obtener mejores resultados.', time: 'Ayer', read: true },
  ];

  const getIcon = (type) => {
    switch(type) {
      case 'offer': return <Tag className="w-5 h-5 text-blue-500" />;
      case 'promo': return <Tag className="w-5 h-5 text-pink-500" />;
      case 'chat': return <MessageSquare className="w-5 h-5 text-green-500" />;
      case 'confirmed': return <CheckCircle className="w-5 h-5 text-purple-500" />;
      case 'shipping': return <Truck className="w-5 h-5 text-orange-500" />;
      default: return <Bell className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="px-4 py-4 border-b border-gray-100 flex items-center gap-4 sticky top-0 bg-white z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
        <h1 className="text-xl font-bold text-dark">Notificaciones</h1>
      </header>

      <div className="flex flex-col">
        {notifications.map((notif) => (
          <div 
            key={notif.id} 
            onClick={() => notif.type === 'shipping' ? navigate('/orders') : null}
            className={`p-4 border-b border-gray-50 flex gap-4 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.read ? 'bg-blue-50/50' : ''}`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${!notif.read ? 'bg-white shadow-sm' : 'bg-gray-100'}`}>
              {getIcon(notif.type)}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h3 className={`text-sm ${!notif.read ? 'font-bold text-dark' : 'font-medium text-gray-700'}`}>
                  {notif.title}
                </h3>
                <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{notif.time}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {notif.text}
              </p>
            </div>
            {!notif.read && (
              <div className="self-center">
                <div className="w-2 h-2 bg-primary rounded-full" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
