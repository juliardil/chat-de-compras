import React, { useState } from 'react';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ShoppingBag,
  Receipt,
  Star,
  Trophy,
  CreditCard,
  Wallet,
  MoreVertical
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function SalesHistory() {
  const [period, setPeriod] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre'
  ];

  const getWeekRangeLabel = (date) => {
    const baseDate = new Date(date);
    const day = baseDate.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const sameMonth = monday.getMonth() === sunday.getMonth();
    const sameYear = monday.getFullYear() === sunday.getFullYear();

    if (sameMonth && sameYear) {
      return `${monday.getDate()} - ${sunday.getDate()} ${monthNames[monday.getMonth()]} ${monday.getFullYear()}`;
    }

    if (sameYear) {
      return `${monday.getDate()} ${monthNames[monday.getMonth()]} - ${sunday.getDate()} ${monthNames[sunday.getMonth()]} ${monday.getFullYear()}`;
    }

    return `${monday.getDate()} ${monthNames[monday.getMonth()]} ${monday.getFullYear()} - ${sunday.getDate()} ${monthNames[sunday.getMonth()]} ${sunday.getFullYear()}`;
  };

  const handlePreviousWeek = () => {
    const previousWeek = new Date(currentDate);
    previousWeek.setDate(currentDate.getDate() - 7);
    setCurrentDate(previousWeek);
  };

  const handleNextWeek = () => {
    const nextWeek = new Date(currentDate);
    nextWeek.setDate(currentDate.getDate() + 7);
    setCurrentDate(nextWeek);
  };

  const kpis = [
    { label: 'Ingresos Totales', value: '$2,595.00', change: '+24% vs. semana anterior', icon: DollarSign, color: 'text-emerald-500' },
    { label: 'Ventas Cerradas', value: '21', change: '+8 esta semana', icon: ShoppingBag, color: 'text-blue-500' },
    { label: 'Ticket Promedio', value: '$123.57', change: 'Promedio por venta', icon: Receipt, color: 'text-orange-500' },
    { label: 'Mejor Día', value: '$990', change: 'Sábado', icon: Trophy, color: 'text-indigo-600' },
  ];



  const days = [
    { name: 'Lun', value: 350, height: 35, color: 'bg-slate-200' },
    { name: 'Mar', value: 420, height: 42, color: 'bg-blue-300' },
    { name: 'Mié', value: 380, height: 38, color: 'bg-blue-200' },
    { name: 'Jue', value: 890, height: 85, color: 'bg-indigo-400', best: true },
    { name: 'Vie', value: 950, height: 90, color: 'bg-indigo-500', best: true },
    { name: 'Sáb', value: 990, height: 95, color: 'bg-gradient-to-t from-blue-600 to-indigo-600', best: true, star: true },
    { name: 'Dom', value: 600, height: 60, color: 'bg-blue-400' },
  ];

  const recentTransactions = [
    { 
      id: 1, 
      product: 'iPhone 15 Pro Max', 
      user: 'Juan P.', 
      userImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100',
      date: '22 Mar, 14:30',
      amount: '$890.00',
      method: 'Transferencia',
      status: 'Completada',
      image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?q=80&w=200&auto=format&fit=crop'
    },
    { 
      id: 2, 
      product: 'MacBook Air M2', 
      user: 'Mariá L.', 
      userImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100',
      date: '21 Mar, 11:45',
      amount: '$1,250.00',
      method: 'Tarjeta •••• 3456',
      status: 'Completada',
      image: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?q=80&w=200&auto=format&fit=crop'
    },
    { 
      id: 3, 
      product: 'Samsung Galaxy S24', 
      user: 'Carlos R.', 
      userImage: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=100',
      date: '20 Mar, 09:20',
      amount: '$650.00',
      method: 'Efectivo',
      status: 'Completada',
      image: 'https://images.unsplash.com/photo-1707223516608-211202447a12?q=80&w=200&auto=format&fit=crop'
    },
    { 
      id: 4, 
      product: 'AirPods Pro 2', 
      user: 'Lucia M.', 
      userImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100',
      date: '19 Mar, 16:10',
      amount: '$195.00',
      method: 'Transferencia',
      status: 'Completada',
      image: 'https://images.unsplash.com/photo-1588423770574-91993ca0a85a?q=80&w=200&auto=format&fit=crop'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans overflow-x-hidden">
      {/* Top Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 pt-10 pb-6 flex justify-between items-center border-b border-slate-50">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estadísticas</h1>
          <p className="text-sm text-gray-500">Resumen de la semana</p>
        </div>

      </div>



      {/* Chart Main Card */}
      <div className="px-4 mb-8">
        <div className="bg-white rounded-[32px] p-6 shadow-2xl shadow-slate-200/60 border border-slate-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
          
          {/* Chart Header */}
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-50 rounded-full p-1 border border-slate-100">
                <button
                  onClick={handlePreviousWeek}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-400 hover:text-indigo-600"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-black text-slate-800 text-[11px] uppercase tracking-wider">
                  {getWeekRangeLabel(currentDate)}
                </span>
                <button
                  onClick={handleNextWeek}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-400 hover:text-indigo-600"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex bg-slate-100/80 p-1 rounded-2xl backdrop-blur-sm">
              <button
                onClick={() => setPeriod('week')}
                className={`px-4 py-2 rounded-xl text-[10px] tracking-widest uppercase transition-all ${
                  period === 'week'
                    ? 'bg-white text-indigo-600 font-black shadow-sm'
                    : 'text-slate-400 font-bold'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setPeriod('month')}
                className={`px-4 py-2 rounded-xl text-[10px] tracking-widest uppercase transition-all ${
                  period === 'month'
                    ? 'bg-white text-indigo-600 font-black shadow-sm'
                    : 'text-slate-400 font-bold'
                }`}
              >
                Mes
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-8 relative z-10">
            {/* Main Bar Chart */}
            <div className="h-56 flex items-end justify-between gap-3 relative">
              {/* Trend Lines */}
              <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none opacity-[0.03]">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="border-t-2 border-slate-900 w-full"></div>
                ))}
              </div>
              
              {days.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                  <div className="w-full relative">
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: `${day.height}%`, opacity: 1 }}
                      transition={{ delay: i * 0.05, duration: 0.5, ease: "easeOut" }}
                      className={`w-full rounded-2xl ${day.color} shadow-sm relative overflow-hidden min-h-[4px] group-hover:brightness-110 transition-all cursor-pointer`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/10"></div>
                      {day.star && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2">
                          <Star className="w-3 h-3 text-white fill-current animate-bounce" />
                        </div>
                      )}
                    </motion.div>
                    
                    {/* Tooltip on hover */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-black py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-20">
                      ${day.value}
                    </div>
                  </div>
                  <span className={`text-[10px] font-black tracking-tighter uppercase ${day.star ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {day.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="px-6 grid grid-cols-2 gap-4 mb-8">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${kpi.color.replace('text','bg').replace('-500', '-100')}`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <span className="text-xs font-bold text-slate-500">{kpi.label}</span>
            </div>
            <span className="text-2xl font-black text-slate-800">{kpi.value}</span>
            <span className="text-[10px] font-medium text-slate-400">{kpi.change}</span>
          </div>
        ))}
      </div>

      {/* Transactions List */}
      <div className="px-6 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Transacciones</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Últimos 7 días</p>
          </div>
          <button className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {recentTransactions.map((tx) => (
            <div key={tx.id} className="bg-white rounded-[28px] p-4 shadow-sm border border-slate-50 flex items-center justify-between transition-all hover:shadow-md hover:translate-y-[-2px] active:scale-[0.98] group">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0 relative">
                  <img src={tx.image} alt={tx.product} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h4 className="font-black text-slate-800 text-[13px] tracking-tight leading-none">{tx.product}</h4>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <img src={tx.userImage} className="w-6 h-6 rounded-full border-2 border-white shadow-sm" alt={tx.user} />
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">{tx.user}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">{tx.date}</span>
                    <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{tx.status}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-black text-slate-800 text-lg tracking-tighter">{tx.amount}</span>
                <div className="flex items-center gap-1.5 text-slate-400 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                  {tx.method.includes('Transferencia') ? <Wallet className="w-3 h-3 text-indigo-500" /> : 
                   tx.method.includes('Tarjeta') ? <CreditCard className="w-3 h-3 text-blue-500" /> : 
                   <DollarSign className="w-3 h-3 text-emerald-500" />}
                  <span className="text-[9px] font-black uppercase tracking-tighter">{tx.method.split(' ')[0]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* View All Button */}
        <button className="w-full mt-8 py-4 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98]">
          Ver todo el historial
        </button>
      </div>

      <CommerceBottomNav />
    </div>
  );
}
