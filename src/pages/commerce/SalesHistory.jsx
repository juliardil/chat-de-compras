import React from 'react';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import { Calendar, TrendingUp, Download } from 'lucide-react';

export default function SalesHistory() {
  const sales = [
    { id: 1, product: 'iPhone 15 Pro Max', date: 'Hoy, 10:30 AM', amount: 1200, status: 'completed', buyer: 'Juan Pérez' },
    { id: 2, product: 'AirPods Pro 2', date: 'Ayer, 4:15 PM', amount: 250, status: 'completed', buyer: 'María L.' },
    { id: 3, product: 'Samsung S24 Ultra', date: '20 Oct', amount: 1100, status: 'completed', buyer: 'Carlos R.' },
    { id: 4, product: 'Funda MagSafe', date: '18 Oct', amount: 45, status: 'completed', buyer: 'Ana S.' },
  ];

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
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Ingresos este mes</span>
          </div>
          <div className="text-3xl font-bold mb-4">$ 2,595.00</div>
          
          {/* Simple Bar Chart Visualization */}
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2 h-24 mt-4">
              {[
                { h: 30, d: 'L' }, 
                { h: 40, d: 'M' }, 
                { h: 35, d: 'M' }, 
                { h: 85, d: 'J' }, 
                { h: 90, d: 'V' }, 
                { h: 95, d: 'S' }, 
                { h: 60, d: 'D' }
              ].map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full bg-white/20 rounded-t-sm hover:bg-white/40 transition-colors relative h-full flex items-end">
                    <div style={{ height: `${item.h}%` }} className="w-full bg-white rounded-t-sm"></div>
                  </div>
                  <span className="text-[10px] text-white/80 font-medium">{item.d}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-white/20">
              <p className="text-xs text-blue-100 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" />
                Tus mejores días son <span className="font-bold text-white">Jueves, Viernes y Sábado</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <h3 className="font-bold text-dark px-2">Transacciones recientes</h3>
        {sales.map((sale) => (
          <div key={sale.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                <span className="font-bold text-lg">$</span>
              </div>
              <div>
                <h4 className="font-bold text-dark text-sm">{sale.product}</h4>
                <p className="text-xs text-gray-500">{sale.date} • {sale.buyer}</p>
              </div>
            </div>
            <span className="font-bold text-dark">${sale.amount}</span>
          </div>
        ))}
      </div>

      <CommerceBottomNav />
    </div>
  );
}
