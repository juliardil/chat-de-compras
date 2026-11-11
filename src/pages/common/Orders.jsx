import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, CheckCircle2, Truck, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import SafeImage from '../../components/ui/SafeImage';
import { EmptyModule, LoadingModule } from '../../components/ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import { useModuleData } from '../../data/useModuleData';
import { fetchBuyerOrders, mapOrder, splitOrders, NOTICES } from '../../data/appData';

const ORDER_STEPS = ['pending', 'confirmed', 'in_progress', 'shipped', 'completed'];

export default function Orders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'completed'
  const [expandedOrder, setExpandedOrder] = useState(null);

  const { items, loading, error, notice } = useModuleData(
    () => fetchBuyerOrders(user?.id),
    [user?.id]
  );

  const { active: activeOrders, completed: completedOrders } = splitOrders(items.map(mapOrder));
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
              : "border-transparent text-gray-600 hover:text-gray-700"
          )}
        >
          Activos ({activeOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={clsx(
            "flex-1 py-3 text-sm font-bold border-b-2 transition-colors",
            activeTab === 'completed'
              ? "border-green-600 text-green-700"
              : "border-transparent text-gray-600 hover:text-gray-700"
          )}
        >
          Cerrados ({completedOrders.length})
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {loading ? <LoadingModule label="Cargando pedidos…" /> : null}

        {!loading && currentList.map((order) => {
          const stepIndex = ORDER_STEPS.indexOf(order.status);
          const isActive = activeTab === 'active';

          return (
            <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              {/* Header del pedido */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                    <SafeImage src={order.image} alt={order.product} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-bold text-dark text-base">{order.product}</h3>
                    <p className="text-gray-600 text-sm">{order.price}</p>
                    {order.tracking && (
                      <p className="text-xs text-gray-500 mt-1">Guía: {order.tracking}</p>
                    )}
                  </div>
                </div>
                <div className={clsx(
                  "px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1",
                  isActive ? "bg-orange-50 text-orange-700" : "bg-green-50 text-green-700"
                )}>
                  {isActive ? <Truck className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                  {order.statusLabel}
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
                    <span className="text-xs text-gray-500 block mb-0.5">Dirección de entrega</span>
                    <p className="text-sm text-gray-700 leading-tight">
                      {order.address || 'Sin dirección registrada'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={clsx(
                    "p-1.5 rounded-full mt-0.5",
                    isActive ? "bg-orange-50" : "bg-green-50"
                  )}>
                    {isActive ? (
                      <Truck className="w-4 h-4 text-orange-700" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-700" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-0.5">Estado del envío</span>
                    <p className="text-sm font-medium text-dark">
                      {order.statusDetail || order.statusLabel}
                    </p>
                  </div>
                </div>
              </div>

              {isActive && (
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
                      {ORDER_STEPS.map((step, index) => {
                        const done = stepIndex >= index;
                        const current = stepIndex === index;
                        return (
                          <li key={step} className="flex items-center gap-2 text-sm">
                            <span className={`w-2.5 h-2.5 rounded-full ${done ? 'bg-green-500' : 'bg-gray-200'}`} />
                            <span className={current ? 'font-bold text-dark' : done ? 'text-gray-700' : 'text-gray-500'}>
                              {step === 'pending' ? 'Pedido confirmado' : null}
                              {step === 'confirmed' ? 'Confirmado por el comercio' : null}
                              {step === 'in_progress' ? 'En preparación' : null}
                              {step === 'shipped' ? 'En camino' : null}
                              {step === 'completed' ? 'Entregado' : null}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </>
              )}

              {!isActive && (
                <button
                  onClick={() => navigate('/request')}
                  className="w-full mt-4 py-2.5 border border-primary text-primary font-semibold text-sm rounded-lg hover:bg-primary/5 transition-colors"
                >
                  Volver a comprar
                </button>
              )}
            </div>
          );
        })}

        {!loading && currentList.length === 0 && (
          <EmptyModule
            icon={Package}
            title="No tienes pedidos aquí"
            description="Tus pedidos aparecerán cuando realices compras."
            notice={error || notice || NOTICES.orders}
            tone={error ? 'error' : 'info'}
          />
        )}
      </div>
    </div>
  );
}
