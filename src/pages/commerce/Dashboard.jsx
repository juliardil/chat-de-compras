import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import Button from '../../components/ui/Button';
import SafeImage from '../../components/ui/SafeImage';
import { EmptyModule, LoadingModule, DataNotice } from '../../components/ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import { useModuleData } from '../../data/useModuleData';
import {
  fetchCommerceIdForUser,
  fetchOpenRequests,
  fetchCommerceSales,
  mapOpportunity,
  createOffer,
  formatCurrency,
  NOTICES,
} from '../../data/appData';
import {
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  Bell,
  Send,
  CheckCircle2,
  Eye,
  X,
  ChevronRight,
  Flame,
  Menu,
  Settings,
  History,
  Package,
  Store,
  User,
} from 'lucide-react';

// Actualización estética Junio 2026

const startedToday = (value) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [offeringId, setOfferingId] = useState(null);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [price, setPrice] = useState('');
  const [closingMessage, setClosingMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [offerError, setOfferError] = useState('');
  const [offerSuccess, setOfferSuccess] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const menuItems = [
    { icon: Settings, label: 'Ajustes', path: '/niche-config' },
    { icon: History, label: 'Estadísticas', path: '/sales-history' },
    { icon: Bell, label: 'Notificaciones', path: '/notifications' },
  ];

  const { items, loading, error, notice, extra } = useModuleData(async () => {
    const commerce = await fetchCommerceIdForUser(user?.id);
    if (!commerce.item) {
      return {
        items: [],
        error: commerce.error,
        notice: commerce.notice || NOTICES.commerceMetrics,
        extra: null,
      };
    }

    // RLS solo muestra solicitudes abiertas a comercios aprobados: si el
    // perfil sigue pendiente, la lista llegaría vacía sin explicar el motivo.
    if (commerce.item.status && commerce.item.status !== 'approved') {
      return {
        items: [],
        error: null,
        notice: NOTICES.commercePending,
        extra: {
          commerceId: commerce.item.id,
          commerceName: commerce.item.trade_name,
          sales: [],
          access: false,
          commerceStatus: commerce.item.status,
        },
      };
    }

    const [requests, sales] = await Promise.all([
      fetchOpenRequests(commerce.item.id),
      fetchCommerceSales(commerce.item.id),
    ]);

    return {
      items: requests.items.map(mapOpportunity),
      error: requests.error || sales.error,
      notice: requests.notice || sales.notice,
      extra: {
        commerceId: commerce.item.id,
        commerceName: commerce.item.trade_name,
        sales: sales.items,
        access: !requests.error && !sales.error,
      },
    };
  }, [user?.id]);

  const opportunities = items;
  const hasAccess = Boolean(extra?.access);
  const sales = Array.isArray(extra?.sales) ? extra.sales : [];
  const completedSales = sales.filter((sale) => ['completed', 'delivered'].includes(sale.status));
  const todaySales = completedSales.filter((sale) => startedToday(sale.completed_at || sale.placed_at));
  const todayTotal = todaySales.reduce((total, sale) => total + Number(sale.total_amount || 0), 0);
  const conversion = sales.length > 0 ? Math.round((completedSales.length / sales.length) * 100) : null;

  const stats = [
    {
      label: 'Ventas hoy',
      value: hasAccess ? formatCurrency(todayTotal) : '—',
      icon: DollarSign,
      color: 'bg-gradient-to-br from-[#0197AF]/20 to-[#4B227A]/20 text-[#006E7A]',
    },
    {
      label: 'Leads activos',
      value: hasAccess ? String(opportunities.length) : '—',
      icon: Users,
      color: 'bg-gradient-to-br from-[#4B227A]/20 to-[#00EED0]/20 text-[#4B227A]',
    },
    {
      label: 'Conversión',
      value: hasAccess && conversion !== null ? `${conversion}%` : '—',
      icon: TrendingUp,
      color: 'bg-gradient-to-br from-[#00EED0]/20 to-[#0197AF]/20 text-[#006E7A]',
    },
  ];

  const commerceName =
    extra?.commerceName || user?.business?.tradeName || user?.name || 'Mi comercio';

  const handleMenuNavigate = (path) => {
    setIsMenuOpen(false);
    navigate(path);
  };

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleStartOffer = (id) => {
    setOfferingId(id);
    setPrice('');
    setClosingMessage('');
    setOfferError('');
    setOfferSuccess(false);
  };

  const handleSendOffer = async () => {
    const opportunity = opportunities.find((opp) => opp.id === offeringId);
    if (!opportunity) return;

    if (!price) {
      setOfferError('Escribe un precio para enviar la oferta.');
      return;
    }

    if (!extra?.commerceId) {
      setOfferError(
        'No se pudo identificar tu perfil de comercio. Vuelve a iniciar sesión o completa los datos de tu comercio.'
      );
      return;
    }

    setSending(true);
    setOfferError('');

    const result = await createOffer({
      request_id: opportunity.id,
      commerce_id: extra.commerceId,
      total_amount: Number(price),
      currency: 'MXN',
      conditions: closingMessage.trim() || null,
      status: 'active',
    });

    setSending(false);

    if (!result.ok) {
      setOfferError(result.error);
      return;
    }

    setOfferSuccess(true);
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      {/* Header con glassmorphism - Actualización estética Junio 2026 */}
      <header className="bg-white/70 backdrop-blur-md px-6 py-5 border-b border-white/30 flex justify-between items-center sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Panel de Oportunidades</h1>
          <p className="text-sm text-gray-600">Hola, {commerceName} 👋</p>
        </div>
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            className="p-2 bg-white/60 backdrop-blur-md rounded-full hover:bg-white/80 transition-colors border border-white/30"
          >
            {isMenuOpen
              ? <X className="w-5 h-5 text-gray-700" />
              : <Menu className="w-5 h-5 text-gray-700" />}
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-52 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 overflow-hidden z-50"
            >
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  role="menuitem"
                  onClick={() => handleMenuNavigate(item.path)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:bg-white transition-colors border-b border-white/40 last:border-b-0"
                >
                  <item.icon className="w-4 h-4 text-[#006E7A]" />
                  <span className="flex-1">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* KPIs con glassmorphism - Actualización estética Junio 2026 */}
      <div className="px-4 py-2 grid grid-cols-3 gap-2">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white/70 backdrop-blur-md p-2 rounded-2xl shadow-sm border border-white/30 flex flex-col items-center text-center">
            <div className={`p-1.5 rounded-xl mb-1 ${stat.color}`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-gray-800">{stat.value}</span>
            <span className="text-[10px] text-gray-600">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="px-6 py-2">
        <h2 className="font-bold text-gray-800 text-lg mb-4">Oportunidades activas</h2>

        {loading ? <LoadingModule label="Cargando oportunidades…" /> : null}

        {!loading && (error || notice) && opportunities.length > 0 ? (
          <DataNotice tone={error ? 'error' : 'info'} className="mb-4">
            {error || notice}
          </DataNotice>
        ) : null}

        <div className="flex flex-col gap-4">
          {!loading && opportunities.map((opp) => (
            <div key={opp.id} className="bg-white/70 backdrop-blur-md p-4 rounded-[24px] shadow-sm border border-white/30 relative overflow-hidden transition-all hover:shadow-md">
              <div className="absolute top-2 right-4 text-[13px] font-bold text-[#006E7A] flex items-center gap-1">
                {opp.timeLeft}
              </div>

              {/* Header Content: Image + Text */}
              <div className="flex gap-4 mt-4 mb-4">
                <div className="w-24 h-24 shrink-0 rounded-2xl overflow-hidden bg-white/50 border border-white/30 flex items-center justify-center">
                  {opp.image ? (
                    <SafeImage src={opp.image} alt={opp.product} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-8 h-8 text-[#4B227A]/60" aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 text-xl mb-1">{opp.product}</h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-[#0197AF]/20 to-[#4B227A]/20 text-[#4B227A] rounded-lg text-[10px] font-bold uppercase border border-[#4B227A]/30">
                      <Flame className="w-3 h-3 fill-current" /> Solicitud abierta
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {opp.details || 'Sin descripción.'}
                  </p>
                </div>
              </div>

              {/* User Section (Glass Box) - Actualización estética Junio 2026 */}
              <div className="bg-white/60 backdrop-blur-md rounded-2xl p-3 mb-4 border border-white/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#4B227A]/10 border-2 border-white shadow-sm flex items-center justify-center">
                      <User className="w-5 h-5 text-[#4B227A]" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-800 text-sm">Comprador</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-600">
                        <Store className="w-3 h-3" /> Presupuesto: {opp.budget}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedOpp(opp)}
                    className="font-bold text-[#006E7A] bg-[#0197AF]/10 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 hover:bg-[#0197AF]/20 transition-colors border border-[#0197AF]/30"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver detalles
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 bg-gradient-to-r from-[#00EED0]/20 to-[#0197AF]/20 text-[#4B227A] rounded-md text-[9px] font-bold uppercase tracking-widest border border-[#4B227A]/30">
                    ⚡ Datos reales
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {/* Offer Section - Actualización estética Junio 2026 */}
                {offeringId === opp.id ? (
                  <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {offerSuccess ? (
                      <div className="bg-[#00EED0]/20 text-[#4B227A] p-3 rounded-xl flex items-center justify-center gap-2 font-bold border border-[#00EED0]/30">
                        <CheckCircle2 className="w-5 h-5" />
                        Oferta enviada
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <textarea
                            className="w-full bg-white/70 backdrop-blur-md border border-[#4B227A]/30 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0197AF]/30 focus:border-[#0197AF] font-medium"
                            placeholder="Mensaje de cierre (opcional)..."
                            rows="2"
                            value={closingMessage}
                            onChange={(e) => setClosingMessage(e.target.value)}
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-bold text-sm">$</span>
                          <input
                            type="number"
                            className="w-full bg-white/70 backdrop-blur-md border border-[#4B227A]/30 rounded-xl pl-7 pr-4 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0197AF]/30 focus:border-[#0197AF] font-bold text-sm"
                            placeholder="Tu precio"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            autoFocus
                          />
                        </div>
                        {offerError ? (
                          <DataNotice tone="error">{offerError}</DataNotice>
                        ) : null}
                        <Button
                          fullWidth
                          onClick={handleSendOffer}
                          disabled={!price || sending}
                          className="bg-[#00EED0] hover:bg-[#00EED0]/90 text-black shadow-[0_0_20px_rgba(0,238,208,0.4)] py-2.5 text-sm"
                        >
                          {sending ? 'Enviando…' : 'Enviar oferta'} <Send className="w-4 h-4 ml-1" />
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartOffer(opp.id)}
                    className="w-full bg-[#00EED0] hover:bg-[#00EED0]/90 text-black font-bold py-3 rounded-xl shadow-[0_0_20px_rgba(0,238,208,0.4)] flex items-center justify-center gap-2 transition-all active:scale-[0.97] group text-sm"
                  >
                    <span className="tracking-wide">OFERTAR AHORA</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {!loading && opportunities.length === 0 ? (
          <EmptyModule
            icon={Package}
            title="Sin oportunidades"
            description="Las solicitudes abiertas de compradores aparecerán aquí."
            notice={error || notice || NOTICES.commerceMetrics}
            tone={error ? 'error' : 'info'}
          />
        ) : null}
      </div>

      {/* Modal de Detalles con glassmorphism - Actualización estética Junio 2026 */}
      {selectedOpp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white/80 backdrop-blur-md w-full max-w-sm rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 duration-200 border border-white/30">
            <button
              aria-label="Cerrar detalles de la oportunidad"
              onClick={() => setSelectedOpp(null)}
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-800"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-xl font-bold text-gray-800 mb-1">{selectedOpp.product}</h2>
            <p className="text-sm text-gray-600 mb-6 flex items-center gap-2">
              <Clock className="w-4 h-4" /> {selectedOpp.timeLeft}
            </p>

            <div className="space-y-4 mb-6">
              <div className="bg-white/70 backdrop-blur-md p-4 rounded-xl border border-white/30">
                <span className="text-xs text-gray-600 block mb-1">Descripción</span>
                <p className="text-gray-800 font-medium">{selectedOpp.details || 'Sin descripción.'}</p>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 bg-gradient-to-br from-[#00EED0]/20 to-[#0197AF]/20 p-3 rounded-xl border border-[#0197AF]/30">
                  <span className="text-xs text-[#006E7A] block mb-1">Presupuesto</span>
                  <p className="text-[#4B227A] font-bold text-lg">{selectedOpp.budget}</p>
                </div>
                <div className="flex-1 bg-gradient-to-br from-[#4B227A]/20 to-[#00EED0]/20 p-3 rounded-xl border border-[#4B227A]/30">
                  <span className="text-xs text-[#4B227A] block mb-1">Estado</span>
                  <p className="text-[#006E7A] font-bold">Abierta</p>
                </div>
              </div>
            </div>

            <Button fullWidth onClick={() => {
              handleStartOffer(selectedOpp.id);
              setSelectedOpp(null);
            }} className="bg-[#00EED0] hover:bg-[#00EED0]/90 text-black shadow-[0_0_20px_rgba(0,238,208,0.4)]">
              OFERTAR AHORA
            </Button>
          </div>
        </div>
      )}

      <CommerceBottomNav />
    </div>
  );
}
