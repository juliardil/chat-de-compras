import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, CheckCircle2, Truck, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import frenosImg from '../../assets/repuesto-frenos.svg';
import bateriaImg from '../../assets/repuesto-bateria.svg';
import filtroImg from '../../assets/repuesto-filtro.svg';

export default function Orders() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'completed'
  const [expandedOrder, setExpandedOrder] = useState(null);

  const activeOrders = [
    {
      id: 1,
      product: 'Pastillas de freno delanteras',
      price: '$120',
      status: 'En camino',
      statusDetail: 'Llega hoy antes de las 6 PM',
      address: 'Av. Principal 123, Apto 402, Ciudad de México',
      image: frenosImg,
      tracking: 'TRK-89234912'
    }
  ];

  const completedOrders = [
    {
      id: 2,
      product: 'Batería 12V 60Ah',
      price: '$145',
      status: 'Entregado',
      statusDetail: 'Entregado el 12 Oct, 2026',
      address: 'Av. Principal 123, Apto 402, Ciudad de México',
      image: bateriaImg,
      completedAt: '12/10/2026 14:30'
    },
    {
      id: 3,
      product: 'Filtro de aceite',
      price: '$18',
      status: 'Entregado',
      statusDetail: 'Entregado el 08 Oct, 2026',
      address: 'Oficina Central, Piso 5, Ciudad de México',
      image: filtroImg,
      completedAt: '08/10/2026 09:15'
    }
  ];

  const currentList = activeTab === 'active' ? activeOrders : completedOrders;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-4 py-4 border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
        <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
        <h1 className="text-xl font-bold text-dark">Mis Pedidos</h1>
      </header>

      {/* Tabs */}
      <div className="bg-white px-4 pt-2 pb-0 flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('active')}
          className={clsx(
            "flex-1 py-3 text-sm font-bold border-b-2 transition-colors",
            activeTab === 'active' 
              ? "border-primary text-primary" 
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Activos ({activeOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={clsx(
            "flex-1 py-3 text-sm font-bold border-b-2 transition-colors",
            activeTab === 'completed' 
              ? "border-green-600 text-green-600" 
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Cerrados ({completedOrders.length})
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {currentList.map((order) => (
          <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            {/* Header del pedido */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-3">
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                  <img src={order.image} alt={order.product} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-bold text-dark text-base">{order.product}</h3>
                  <p className="text-gray-500 text-sm">{order.price}</p>
                  {order.tracking && (
                    <p className="text-xs text-gray-400 mt-1">Guía: {order.tracking}</p>
                  )}
                </div>
              </div>
              <div className={clsx(
                "px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1",
                activeTab === 'active' ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
              )}>
                {activeTab === 'active' ? <Truck className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                {order.status}
              </div>
            </div>

            <div className="border-t border-gray-50 my-3"></div>

            {/* Detalles de envío */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-blue-50 rounded-full mt-0.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Dirección de entrega</span>
                  <p className="text-sm text-gray-700 leading-tight">{order.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={clsx(
                  "p-1.5 rounded-full mt-0.5",
                  activeTab === 'active' ? "bg-orange-50" : "bg-green-50"
                )}>
                  {activeTab === 'active' ? (
                    <Truck className="w-4 h-4 text-orange-600" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  )}
                </div>
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Estado del envío</span>
                  <p className="text-sm font-medium text-dark">{order.statusDetail}</p>
                </div>
              </div>
            </div>

            {activeTab === 'active' && (
              <>
                <button
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  className="w-full mt-4 py-2.5 bg-gray-50 text-dark font-semibold text-sm rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                  {expandedOrder === order.id ? 'Ocultar seguimiento' : 'Ver seguimiento completo'}
                  <ChevronRight className={`w-4 h-4 transition-transform ${expandedOrder === order.id ? 'rotate-90' : ''}`} />
                </button>

                {expandedOrder === order.id && (
                  <ol className="mt-3 space-y-2 border-t border-gray-50 pt-3">
                    {[
                      { label: 'Pedido confirmado', done: true },
                      { label: 'En preparación', done: true },
                      { label: 'En camino', done: true, current: true },
                      { label: 'Entregado', done: false }
                    ].map((step) => (
                      <li key={step.label} className="flex items-center gap-2 text-sm">
                        <span className={`w-2.5 h-2.5 rounded-full ${step.done ? 'bg-green-500' : 'bg-gray-200'}`} />
                        <span className={step.current ? 'font-bold text-dark' : step.done ? 'text-gray-700' : 'text-gray-400'}>
                          {step.label}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
            
            {activeTab === 'completed' && (
              <button
                onClick={() => navigate('/request')}
                className="w-full mt-4 py-2.5 border border-primary text-primary font-semibold text-sm rounded-lg hover:bg-primary/5 transition-colors"
              >
                Volver a comprar
              </button>
            )}
          </div>
        ))}

        {currentList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-600">No tienes pedidos aquí</h3>
            <p className="text-sm text-gray-400 mt-1">Tus pedidos aparecerán cuando realices compras.</p>
          </div>
        )}
      </div>
    </div>
  );
}