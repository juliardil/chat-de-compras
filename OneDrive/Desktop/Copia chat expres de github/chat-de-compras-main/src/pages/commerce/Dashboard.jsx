import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import Button from '../../components/ui/Button';
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
  MessageSquare,
  ChevronRight,
  Flame,
  Zap,
  ShieldCheck,
  Star as StarIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

function diffLeft(expiresAtISO) {
  const t = Math.max(0, Math.floor((new Date(expiresAtISO) - Date.now()) / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  const total = Math.max(1, 15 * 60);
  const pct = Math.min(100, Math.max(0, Math.round((1 - t / total) * 100)));
  return {
    label: `${m}:${s < 10 ? '0' : ''}${s}`,
    progress: pct,
    expired: t <= 0,
  };
}

function formatCurrency(n) {
  if (n == null || Number.isNaN(Number(n))) return '$0';
  const v = Number(n);
  return v.toLocaleString('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 });
}

const DEFAULT_IMG =
  'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [offeringId, setOfferingId] = useState(null);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  const [price, setPrice] = useState('');
  const [closingMessage, setClosingMessage] = useState('');
  const [successId, setSuccessId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [opportunities, setOpportunities] = useState([]);
  const [stats, setStats] = useState([
    { label: 'Ventas hoy', value: '$0', icon: DollarSign, color: 'bg-gradient-to-br from-[#0197AF]/20 to-[#4B227A]/20 text-[#0197AF]' },
    { label: 'Leads activos', value: '0', icon: Users, color: 'bg-gradient-to-br from-[#4B227A]/20 to-[#00EED0]/20 text-[#4B227A]' },
    { label: 'Conversión', value: '0%', icon: TrendingUp, color: 'bg-gradient-to-br from-[#00EED0]/20 to-[#0197AF]/20 text-[#00EED0]' },
  ]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [tick, setTick] = useState(0);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setErrorMsg('');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayOrders, error: oErr } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('commerce_id', user.id)
        .gte('created_at', today.toISOString());
      if (oErr) throw oErr;
      const ventasHoy = (todayOrders || []).reduce((acc, o) => acc + Number(o.total_amount || 0), 0);

      const { count: leadsCount, error: lErr } = await supabase
        .from('responses')
        .select('*', { count: 'exact', head: true })
        .eq('commerce_id', user.id);
      if (lErr) throw lErr;

      const { count: ordersCountAll, error: ocErr } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('commerce_id', user.id);
      if (ocErr) throw ocErr;

      const totalLeads = Math.max(1, Number(leadsCount || 0) + Number(ordersCountAll || 0));
      const conv = Math.round((Number(ordersCountAll || 0) / totalLeads) * 100);

      setStats([
        {
          label: 'Ventas hoy',
          value: formatCurrency(ventasHoy),
          icon: DollarSign,
          color: 'bg-gradient-to-br from-[#0197AF]/20 to-[#4B227A]/20 text-[#0197AF]',
        },
        {
          label: 'Leads activos',
          value: `${Number(leadsCount || 0) || 0}`,
          icon: Users,
          color: 'bg-gradient-to-br from-[#4B227A]/20 to-[#00EED0]/20 text-[#4B227A]',
        },
        {
          label: 'Conversión',
          value: `${conv}%`,
          icon: TrendingUp,
          color: 'bg-gradient-to-br from-[#00EED0]/20 to-[#0197AF]/20 text-[#00EED0]',
        },
      ]);

      const { data: myResponses } = await supabase
        .from('responses')
        .select('request_id, accepted, created_at')
        .eq('commerce_id', user.id);
      const respondedIds = new Set((myResponses || []).map((r) => r.request_id));
      const acceptedMap = Object.fromEntries((myResponses || []).map((r) => [r.request_id, r.accepted]));

      const { data: rows, error: rErr } = await supabase
        .from('requests')
        .select(
          `
          id, status, budget, notes, expires_at, created_at,
          buyer:buyer_id (
            id, full_name, phone, avatar_url,
            user_profiles(rating, total_purchases, reviews_count)
          ),
          request_items(id, category, item, vehicle_type, vehicle_brand, vehicle_model, year_from, year_to, reference, brand, condition, quantity, notes, images)
        `
        )
        .in('status', ['open', 'matched', 'in_chat', 'negotiating'])
        .gte('expires_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .order('expires_at', { ascending: true });
      if (rErr) throw rErr;

      const formatted = (rows || []).map((r) => {
        const items = r.request_items || [];
        const firstItem = items[0] || {};
        const buyerProf = r.buyer?.user_profiles?.[0] || r.buyer?.user_profiles || {};
        const product =
          [firstItem.item, firstItem.vehicle_brand && `${firstItem.vehicle_brand} ${firstItem.vehicle_model || ''}`]
            .filter(Boolean)
            .join(' · ') || 'Solicitud automotriz';
        const details =
          r.notes ||
          [firstItem.category, firstItem.reference && `Ref: ${firstItem.reference}`, firstItem.notes]
            .filter(Boolean)
            .join(' · ') ||
          'Sin descripción adicional.';
        const budget = r.budget ? formatCurrency(r.budget) : 'Sin presupuesto';
        const buyerName = r.buyer?.full_name || 'Cliente';
        const buyerImage =
          r.buyer?.avatar_url ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(buyerName)}&backgroundColor=00EED0,0197AF`;
        const rating = Number(buyerProf.rating || 5) || 5;
        const transactions = Number(buyerProf.total_purchases || 0) || 0;
        const t = diffLeft(r.expires_at);
        const primaryImage = firstItem.images?.[0] || DEFAULT_IMG;

        return {
          id: r.id,
          request: r,
          items,
          product,
          user: buyerName,
          userImage: buyerImage,
          rating,
          transactions,
          time_left: t.label,
          progress: t.progress,
          expired: t.expired,
          budget,
          details,
          image: primaryImage,
          images: items.flatMap((i) => i.images || []),
          category: firstItem.category,
          vehicle: firstItem.vehicle_type,
          reference: firstItem.reference,
          responded: respondedIds.has(r.id),
          accepted: acceptedMap[r.id],
          status: r.status,
        };
      });

      setOpportunities(formatted);
    } catch (e) {
      setErrorMsg(e.message || 'No se pudieron cargar las oportunidades');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, tick]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const visibleOpps = useMemo(() => {
    return opportunities.map((o) => ({ ...o, ...diffLeft(o.request.expires_at) }));
  }, [opportunities, tick]);

  const handleStartOffer = (id) => {
    setOfferingId(id);
    setPrice('');
    setClosingMessage('');
  };

  const handleSendOffer = async (opp) => {
    const n = Number(price);
    if (!n || n <= 0) return;
    if (!user?.id) return;
    setBusyId(opp.id);
    try {
      const upsertPayload = {
        request_id: opp.id,
        commerce_id: user.id,
        price: n,
        closing_message: closingMessage || null,
        product_name: opp.product,
        product_image: opp.image || null,
        product_details: opp.details || null,
      };
      const { error: respErr } = await supabase
        .from('responses')
        .upsert(upsertPayload, { onConflict: 'request_id,commerce_id' });
      if (respErr) throw respErr;

      const { data: existingChat, error: ceErr } = await supabase
        .from('chats')
        .select('id')
        .eq('request_id', opp.id)
        .eq('buyer_id', opp.request.buyer.id)
        .eq('commerce_id', user.id)
        .maybeSingle();
      if (ceErr) throw ceErr;

      let chatId = existingChat?.id;
      if (!chatId) {
        const { data: nc, error: ncErr } = await supabase
          .from('chats')
          .insert({
            request_id: opp.id,
            buyer_id: opp.request.buyer.id,
            commerce_id: user.id,
          })
          .select('id')
          .single();
        if (ncErr) throw ncErr;
        chatId = nc.id;
      }

      await supabase.from('messages').insert({
        chat_id: chatId,
        sender: 'system',
        text: `El comercio ha enviado una oferta por ${formatCurrency(n)}${closingMessage ? `: "${closingMessage}"` : ''}`,
      });

      await supabase.from('requests').update({ status: 'matched' }).eq('id', opp.id);

      setSuccessId(opp.id);
      setTimeout(() => {
        setSuccessId(null);
        setOfferingId(null);
        fetchAll();
      }, 2200);
    } catch (e) {
      setErrorMsg(e.message || 'No se pudo enviar la oferta');
    } finally {
      setBusyId(null);
    }
  };

  const goChat = (opp) => {
    const responded = opportunities.find((o) => o.id === opp.id)?.responded;
    if (!responded) return;
    navigate(`/chat-list`);
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <header className="bg-white/70 backdrop-blur-md px-6 py-5 border-b border-white/30 flex justify-between items-center sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Panel de Oportunidades</h1>
          <p className="text-sm text-gray-600">
            Hola, {user?.profile?.trade_name || user?.name || 'Comercio'} 👋
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/chat-list')}
            className="p-2 bg-white/60 backdrop-blur-md rounded-full relative hover:bg-white/80 transition-colors border border-white/30"
          >
            <MessageSquare className="w-5 h-5 text-gray-700" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#0197AF] rounded-full border-2 border-white"></span>
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className="p-2 bg-white/60 backdrop-blur-md rounded-full relative hover:bg-white/80 transition-colors border border-white/30"
          >
            <Bell className="w-5 h-5 text-gray-700" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#4B227A] rounded-full border-2 border-white"></span>
          </button>
        </div>
      </header>

      <div className="px-4 py-2 grid grid-cols-3 gap-2">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="bg-white/70 backdrop-blur-md p-2 rounded-2xl shadow-sm border border-white/30 flex flex-col items-center text-center"
          >
            <div className={`p-1.5 rounded-xl mb-1 ${stat.color}`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-gray-800">{stat.value}</span>
            <span className="text-[10px] text-gray-600">{stat.label}</span>
          </div>
        ))}
      </div>

      {errorMsg && (
        <div className="mx-6 my-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 flex items-start gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      <div className="px-6 py-2">
        <h2 className="font-bold text-gray-800 text-lg mb-4">Oportunidades activas</h2>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#00EED0] animate-spin" />
          </div>
        ) : visibleOpps.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-md rounded-[24px] p-8 text-center border border-white/30 shadow-sm">
            <div className="w-14 h-14 mx-auto bg-[#00EED0]/20 rounded-2xl flex items-center justify-center mb-4 border border-[#00EED0]/30">
              <Zap className="w-7 h-7 text-[#4B227A]" />
            </div>
            <h3 className="font-bold text-gray-800 mb-1">Sin oportunidades</h3>
            <p className="text-sm text-gray-600 mb-4">
              En cuanto un cliente cree una solicitud aparecerá aquí.
            </p>
            <Button onClick={() => setTick((x) => x + 1)} variant="outline" className="w-full">
              Actualizar
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleOpps.map((opp) => (
              <div
                key={opp.id}
                className="bg-white/70 backdrop-blur-md p-4 rounded-[24px] shadow-sm border border-white/30 relative overflow-hidden transition-all hover:shadow-md"
              >
                <div
                  className={`absolute top-2 right-4 text-[13px] font-bold flex items-center gap-1 ${
                    opp.expired ? 'text-red-600' : 'text-[#0197AF]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" /> {opp.label || opp.time_left}
                </div>

                <div className="absolute bottom-0 left-0 h-1 bg-[#00EED0]/50" style={{ width: `${100 - opp.progress}%` }} />

                <div className="flex gap-4 mt-4 mb-4">
                  <div
                    className="w-24 h-24 shrink-0 rounded-2xl overflow-hidden bg-white/50 border border-white/30 cursor-pointer"
                    onClick={() => setViewImage(opp.image)}
                  >
                    <img src={opp.image} alt={opp.product} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-xl mb-1">{opp.product}</h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {!opp.responded ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-[#0197AF]/20 to-[#4B227A]/20 text-[#4B227A] rounded-lg text-[10px] font-bold uppercase border border-[#4B227A]/30">
                          <Flame className="w-3 h-3 fill-current" /> {opp.vehicle || opp.category || 'Solicitud'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-[#00EED0]/20 to-[#0197AF]/20 text-[#4B227A] rounded-lg text-[10px] font-bold uppercase border border-[#4B227A]/30">
                          <CheckCircle2 className="w-3 h-3 fill-current" /> Oferta enviada
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-white/70 text-gray-700 rounded-lg text-[10px] font-semibold border border-white/30">
                        {opp.status.toUpperCase()}
                      </span>
                      {opp.reference && (
                        <span className="px-2 py-0.5 bg-white/70 text-gray-700 rounded-lg text-[10px] font-medium border border-white/30">
                          Ref: {opp.reference}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3">{opp.details}</p>
                  </div>
                </div>

                <div className="bg-white/60 backdrop-blur-md rounded-2xl p-3 mb-4 border border-white/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={opp.userImage}
                          className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                          alt={opp.user}
                        />
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#00EED0] fill-current" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-800 text-sm">{opp.user}</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00EED0] fill-current" />
                          <div className="flex items-center gap-0.5">
                            <StarIcon className="w-3 h-3 text-amber-400 fill-current" />
                            <span className="text-[11px] font-bold text-gray-700">{opp.rating.toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-gray-600">
                          <TrendingUp className="w-3 h-3" /> {opp.transactions} | Transacciones
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedOpp(opp)}
                      className="font-bold text-[#0197AF] bg-[#0197AF]/10 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 hover:bg-[#0197AF]/20 transition-colors border border-[#0197AF]/30"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver detalles
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 bg-gradient-to-r from-[#00EED0]/20 to-[#0197AF]/20 text-[#4B227A] rounded-md text-[9px] font-bold uppercase tracking-widest border border-[#4B227A]/30">
                      ⚡ Presupuesto: {opp.budget}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {offeringId === opp.id ? (
                    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {successId === opp.id ? (
                        <div className="bg-[#00EED0]/20 text-[#4B227A] p-3 rounded-xl flex items-center justify-center gap-2 font-bold animate-pulse border border-[#00EED0]/30">
                          <CheckCircle2 className="w-5 h-5" />
                          ¡Oferta Enviada!
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
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 font-bold text-lg">
                              $
                            </span>
                            <input
                              type="number"
                              className="w-full bg-white/70 backdrop-blur-md border border-[#4B227A]/30 rounded-xl pl-10 pr-4 py-3 text-gray-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#0197AF]/30 focus:border-[#0197AF]"
                              placeholder="Ingresa tu precio"
                              value={price}
                              onChange={(e) => setPrice(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="flex-1 border-[#0197AF]/30 text-[#0197AF]"
                              onClick={() => setOfferingId(null)}
                              disabled={busyId === opp.id}
                            >
                              Cancelar
                            </Button>
                            <Button
                              className="flex-2 flex items-center gap-2"
                              onClick={() => handleSendOffer(opp)}
                              disabled={busyId === opp.id || !price}
                            >
                              {busyId === opp.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                              Enviar Oferta
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {opp.responded ? (
                        <Button
                          variant="outline"
                          className="flex-1 border-[#4B227A]/20 text-[#4B227A] flex items-center gap-2"
                          onClick={() => goChat(opp)}
                        >
                          <MessageSquare className="w-4 h-4" />
                          Ver chats
                        </Button>
                      ) : (
                        <Button
                          className="flex-1 flex items-center gap-2"
                          onClick={() => handleStartOffer(opp.id)}
                          disabled={opp.expired}
                        >
                          {opp.expired ? 'Expirada' : 'Iniciar Oferta'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedOpp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200" onClick={() => setSelectedOpp(null)}>
          <div
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-800">{selectedOpp.product}</h3>
              <button onClick={() => setSelectedOpp(null)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden mb-4 bg-gray-100">
              <img src={selectedOpp.image} alt={selectedOpp.product} className="w-full h-48 object-cover" />
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                ['Vehículo', selectedOpp.vehicle],
                ['Categoría', selectedOpp.category],
                ['Referencia', selectedOpp.reference],
                ['Presupuesto', selectedOpp.budget],
                ['Cliente', selectedOpp.user],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <span
                    key={k}
                    className="px-3 py-1 bg-gray-100 rounded-xl text-xs text-gray-700 font-medium"
                  >
                    <span className="text-gray-500">{k}:</span> {v}
                  </span>
                ))}
            </div>
            <h4 className="font-bold text-gray-800 mb-2">Detalle completo</h4>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">{selectedOpp.details}</p>
            {selectedOpp.items?.length > 1 && (
              <>
                <h4 className="font-bold text-gray-800 mb-2">Productos adicionales ({selectedOpp.items.length})</h4>
                <ul className="space-y-2 mb-4">
                  {selectedOpp.items.slice(1).map((it, i) => (
                    <li key={it.id || i} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700">
                      <span className="font-semibold text-[#4B227A]">#{i + 2}</span>{' '}
                      {[it.item, it.category, `${it.quantity}x`].filter(Boolean).join(' · ')}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                fullWidth
                className="border-[#0197AF]/30 text-[#0197AF] flex items-center justify-center gap-2"
                onClick={() => {
                  handleStartOffer(selectedOpp.id);
                  setSelectedOpp(null);
                }}
              >
                <Send className="w-4 h-4" /> Ofertar
              </Button>
              <ChevronRight className="hidden" />
            </div>
          </div>
        </div>
      )}

      {viewImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setViewImage(null)}>
          <button onClick={() => setViewImage(null)} className="absolute top-5 right-5 text-white p-2 bg-white/10 rounded-full hover:bg-white/20">
            <X className="w-6 h-6" />
          </button>
          <img src={viewImage} alt="preview" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" />
        </div>
      )}

      <CommerceBottomNav />
    </div>
  );
}
