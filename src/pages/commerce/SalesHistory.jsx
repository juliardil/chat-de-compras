import React, { useState } from 'react';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import { Calendar, TrendingUp, Download, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SalesHistory() {
  const [period, setPeriod] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (period === 'day') newDate.setDate(currentDate.getDate() + direction);
    if (period === 'week') newDate.setDate(currentDate.getDate() + (direction * 7));
    if (period === 'month') newDate.setMonth(currentDate.getMonth() + direction);
    if (period === 'year') newDate.setFullYear(currentDate.getFullYear() + direction);
    setCurrentDate(newDate);
  };

  const getDateLabel = () => {
    if (period === 'day') return currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    if (period === 'week') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay() + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.getDate()} - ${end.getDate()} ${end.toLocaleDateString('es-ES', { month: 'short' })}.`;
    }
    if (period === 'month') return currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    if (period === 'year') return currentDate.getFullYear().toString();
  };

  const chartData = {
    day: {
      label: 'Ingresos',
      amount: '$ 450.00',
      data: [
        { h: 20, d: '10am', v: '$90' }, { h: 45, d: '12pm', v: '$202' }, { h: 30, d: '2pm', v: '$135' },
        { h: 80, d: '4pm', v: '$360' }, { h: 60, d: '6pm', v: '$270' }, { h: 20, d: '8pm', v: '$90' }
      ],
      best: '4pm - 6pm'
    },
    week: {
      label: 'Ingresos',
      amount: '$ 2,595.00',
      data: [
        { h: 30, d: 'L', v: '$350' }, { h: 40, d: 'M', v: '$420' }, { h: 35, d: 'Mi', v: '$380' },
        { h: 85, d: 'J', v: '$890' }, { h: 90, d: 'V', v: '$950' }, { h: 95, d: 'S', v: '$990' }, { h: 60, d: 'D', v: '$600' }
      ],
      best: 'Jueves, Viernes y Sábado'
    },
    month: {
      label: 'Ingresos',
      amount: '$ 12,450.00',
      data: [
        { h: 65, d: 'Sem 1', v: '$3,200' }, { h: 45, d: 'Sem 2', v: '$2,100' },
        { h: 90, d: 'Sem 3', v: '$4,500' }, { h: 75, d: 'Sem 4', v: '$3,800' }
      ],
      best: 'Semana 3'
    },
    year: {
      label: 'Ingresos',
      amount: '$ 145,200.00',
      data: [
        { h: 45, d: 'Ene', v: '$12k' }, { h: 55, d: 'Feb', v: '$14k' }, { h: 40, d: 'Mar', v: '$11k' }, 
        { h: 70, d: 'Abr', v: '$18k' }, { h: 60, d: 'May', v: '$15k' }, { h: 80, d: 'Jun', v: '$21k' },
        { h: 50, d: 'Jul', v: '$13k' }, { h: 65, d: 'Ago', v: '$17k' }, { h: 75, d: 'Sep', v: '$19k' }, 
        { h: 90, d: 'Oct', v: '$23k' }, { h: 85, d: 'Nov', v: '$22k' }, { h: 95, d: 'Dic', v: '$25k' }
      ],
      best: 'Octubre'
    }
  };

  const currentData = chartData[period];

  const allSales = [
    { id: 1, product: 'iPhone 15 Pro Max', date: '2026-02-04', time: '10:30 AM', amount: 1200, status: 'completed', buyer: 'Juan Pérez' },
    { id: 2, product: 'AirPods Pro 2', date: '2026-02-03', time: '4:15 PM', amount: 250, status: 'completed', buyer: 'María L.' },
    { id: 3, product: 'Samsung S24 Ultra', date: '2025-10-20', time: '2:00 PM', amount: 1100, status: 'completed', buyer: 'Carlos R.' },
    { id: 4, product: 'Funda MagSafe', date: '2025-10-18', time: '11:30 AM', amount: 45, status: 'completed', buyer: 'Ana S.' },
    { id: 5, product: 'MacBook Air M2', date: '2026-02-04', time: '3:45 PM', amount: 1050, status: 'completed', buyer: 'Elena G.' },
    { id: 6, product: 'iPad Air 5', date: '2026-02-02', time: '9:15 AM', amount: 550, status: 'completed', buyer: 'Roberto F.' },
    { id: 7, product: 'Apple Watch S9', date: '2026-01-28', time: '6:20 PM', amount: 399, status: 'completed', buyer: 'Lucía M.' },
    { id: 8, product: 'Cargador 20W', date: '2026-02-04', time: '1:10 PM', amount: 25, status: 'completed', buyer: 'Pedro S.' }
  ];

  const getFilteredSales = () => {
    return allSales.filter(sale => {
      const saleDate = new Date(sale.date);
      const saleYear = saleDate.getFullYear();
      const saleMonth = saleDate.getMonth();
      const saleDay = saleDate.getDate();

      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      const currentDay = currentDate.getDate();

      if (period === 'day') {
        return saleYear === currentYear && saleMonth === currentMonth && saleDay === currentDay;
      }
      if (period === 'week') {
        // Simple week check (same year and week number approximation or just range)
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDay - currentDate.getDay() + 1);
        startOfWeek.setHours(0,0,0,0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23,59,59,999);
        
        return saleDate >= startOfWeek && saleDate <= endOfWeek;
      }
      if (period === 'month') {
        return saleYear === currentYear && saleMonth === currentMonth;
      }
      if (period === 'year') {
        return saleYear === currentYear;
      }
      return true;
    });
  };

  const filteredSales = getFilteredSales();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white px-6 py-5 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-dark">Historial de Ventas</h1>
          <p className="text-sm text-gray-500">Tus transacciones cerradas</p>
        </div>
        <button className="p-2 bg-gray-50 rounded-lg text-gray-600 hover:bg-gray-100">
          <Download className="w-5 h-5" />
        </button>
      </header>

      {/* Chart Placeholder */}
      <div className="p-6 pb-2">
        <div className="bg-primary rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 opacity-80">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">{currentData.label}</span>
            </div>
            <div className="relative">
              <select 
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-white/20 text-white text-xs font-bold rounded-lg px-2 py-1 pr-6 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 border-none"
              >
                <option value="day" className="text-dark">Día</option>
                <option value="week" className="text-dark">Semana</option>
                <option value="month" className="text-dark">Mes</option>
                <option value="year" className="text-dark">Año</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-4 mb-4 bg-white/10 rounded-lg py-1.5 mx-auto max-w-[90%]">
            <button onClick={() => navigateDate(-1)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold capitalize min-w-[140px] text-center">
              {getDateLabel()}
            </span>
            <button onClick={() => navigateDate(1)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-3xl font-bold mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300" key={period}>
            {currentData.amount}
          </div>
          
          {/* Simple Bar Chart Visualization */}
          <div className="flex flex-col gap-2">
            <div className="relative h-32 mt-6">
              {/* Grid lines background */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="w-full border-t border-dashed border-white/20"></div>
                <div className="w-full border-t border-dashed border-white/10"></div>
                <div className="w-full border-t border-dashed border-white/10"></div>
                <div className="w-full border-t border-dashed border-white/10"></div>
                <div className="w-full border-t border-white/20"></div>
              </div>

              <div className="relative z-10 flex items-end gap-6 h-full px-2">
                {currentData.data.map((item, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative">
                    <div className="w-full bg-white/10 rounded-full h-full relative overflow-hidden">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${item.h}%` }}
                        transition={{ type: "spring", stiffness: 300, damping: 30, delay: i * 0.05 }}
                        className="absolute bottom-0 w-full bg-gradient-to-t from-white/60 to-white rounded-t-full opacity-90 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                    {/* Amount Label */}
                    <div className="absolute bottom-0 left-0 w-full flex justify-center pointer-events-none" style={{ height: `${item.h}%` }}>
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white/90 whitespace-nowrap">
                        {item.v}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/60 font-medium">{item.d}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/20">
              <p className="text-xs text-blue-100 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" />
                Mejor rendimiento: <span className="font-bold text-white">{currentData.best}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <h3 className="font-bold text-dark px-2">Transacciones recientes</h3>
        {filteredSales.length > 0 ? (
          filteredSales.map((sale) => (
            <div key={sale.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                  <span className="font-bold text-lg">$</span>
                </div>
                <div>
                  <h4 className="font-bold text-dark text-sm">{sale.product}</h4>
                  <p className="text-xs text-gray-500">
                    {new Date(sale.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}, {sale.time} • {sale.buyer}
                  </p>
                </div>
              </div>
              <span className="font-bold text-dark">${sale.amount}</span>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            No hay transacciones para este periodo
          </div>
        )}
      </div>

      <CommerceBottomNav />
    </div>
  );
}
