import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function CalendarPopup({ currentDate, onDateChange, onClose }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const today = new Date();
  const isToday = (day) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const handlePrevMonth = () => {
    onDateChange(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    onDateChange(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (day) => {
    onDateChange(new Date(year, month, day));
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Mes anterior"
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>

          <h3 className="font-black text-lg text-slate-800">
            {currentDate
              .toLocaleString('es-ES', { month: 'long', year: 'numeric' })
              .replace(/^\w/, (c) => c.toUpperCase())}
          </h3>

          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Mes siguiente"
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center mb-2">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2 text-center">
          {Array.from({ length: firstDayOfMonth }, (_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {daysArray.map((day) => {
            const selected =
              day === currentDate.getDate() && month === currentDate.getMonth() && year === currentDate.getFullYear();

            return (
              <button
                key={day}
                type="button"
                onClick={() => handleSelectDay(day)}
                className={`h-9 w-9 mx-auto rounded-full text-sm font-semibold transition-colors ${
                  selected
                    ? 'bg-[#4B227A] text-white'
                    : isToday(day)
                      ? 'bg-[#00EED0]/20 text-[#4B227A]'
                      : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-6 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
}
