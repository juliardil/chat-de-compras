import React, { useEffect, useMemo, useRef, useState } from 'react';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileText,
  Filter,
  MoreVertical,
  Receipt,
  ShoppingBag,
  Star,
  Trophy,
  X,
  BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import SafeImage from '../../components/ui/SafeImage';
import { EmptyModule, LoadingModule, DataNotice } from '../../components/ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import { useModuleData } from '../../data/useModuleData';
import {
  fetchCommerceIdForUser,
  fetchCommerceSales,
  formatCurrency,
  NOTICES,
} from '../../data/appData';
import {
  SALES_DATE_FILTERS,
  SALES_STATUS_FILTERS,
  buildSalesCsv,
  buildSalesJson,
  csvDateStamp,
  downloadTextFile,
  filterSales,
  filterSalesLabel,
  normalizeSale,
  saleDate,
} from './salesHistoryHelpers';

// Actualización estética Junio 2026

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_COLORS = [
  'bg-[#4B227A]/30',
  'bg-[#4B227A]/50',
  'bg-[#0197AF]/50',
  'bg-[#0197AF]/70',
  'bg-[#00EED0]/60',
  'bg-gradient-to-t from-[#4B227A]/80 to-[#00EED0]/80',
  'bg-[#4B227A]/40',
];

const DATE_FILTER_ICONS = {
  today: CalendarDays,
  last7: Clock,
  last30: CalendarDays,
};

function DetailItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">{label}</p>
      <p className="mt-1 text-[13px] font-black text-gray-800">{value || '—'}</p>
    </div>
  );
}

const startOfWeek = (date) => {
  const base = new Date(date);
  const day = base.getDay();
  base.setDate(base.getDate() + (day === 0 ? -6 : 1 - day));
  base.setHours(0, 0, 0, 0);
  return base;
};

export default function SalesHistory() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterKey, setFilterKey] = useState('all');
  const [detailTx, setDetailTx] = useState(null);
  const menuRef = useRef(null);
  const detailDialogRef = useRef(null);

  // El menú ⋮ se cierra al elegir una opción, con Escape o al hacer clic fuera.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!detailTx) return undefined;

    detailDialogRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setDetailTx(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [detailTx]);

  const { items, loading, error, notice, extra, reload } = useModuleData(async () => {
    const commerce = await fetchCommerceIdForUser(user?.id);
    if (!commerce.item) {
      return {
        items: [],
        error: commerce.error,
        notice: commerce.notice || NOTICES.commerceMetrics,
        extra: null,
      };
    }

    if (commerce.item.status && commerce.item.status !== 'approved') {
      return {
        items: [],
        error: null,
        notice: NOTICES.commercePending,
        extra: { access: false, commerceStatus: commerce.item.status },
      };
    }

    const sales = await fetchCommerceSales(commerce.item.id);
    return {
      items: sales.items,
      error: sales.error,
      notice: sales.notice,
      extra: { access: !sales.error },
    };
  }, [user?.id]);

  const hasAccess = Boolean(extra?.access);
  const sales = items;

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
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

  // Ventas de la semana visible, calculadas con purchase_orders reales.
  const monday = startOfWeek(currentDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const completedSales = sales.filter((sale) => ['completed', 'delivered'].includes(sale.status));
  const weekSales = completedSales.filter((sale) => {
    const date = new Date(saleDate(sale));
    return !Number.isNaN(date.getTime()) && date >= monday && date <= sunday;
  });

  const totalRevenue = weekSales.reduce((total, sale) => total + Number(sale.total_amount || 0), 0);
  const averageTicket = weekSales.length > 0 ? totalRevenue / weekSales.length : null;

  const dayTotals = DAY_LABELS.map(() => 0);
  weekSales.forEach((sale) => {
    const date = new Date(saleDate(sale));
    const index = date.getDay() === 0 ? 6 : date.getDay() - 1;
    dayTotals[index] += Number(sale.total_amount || 0);
  });

  const maxDay = Math.max(...dayTotals, 0);
  const days = dayTotals.map((value, index) => ({
    name: DAY_LABELS[index],
    value,
    height: maxDay > 0 ? Math.max(4, Math.round((value / maxDay) * 95)) : 0,
    color: DAY_COLORS[index],
    best: maxDay > 0 && value === maxDay,
    star: maxDay > 0 && value === maxDay,
  }));
  const bestDayIndex = dayTotals.indexOf(maxDay);
  const hasWeekData = weekSales.length > 0;

  const kpis = [
    {
      label: 'Ingresos Totales',
      value: hasAccess ? formatCurrency(totalRevenue) : '—',
      change: hasWeekData ? `${weekSales.length} ventas esta semana` : 'Sin ventas en la semana',
      icon: DollarSign,
      color: 'text-[#006E7A]',
    },
    {
      label: 'Ventas Cerradas',
      value: hasAccess ? String(weekSales.length) : '—',
      change: 'Pedidos completados',
      icon: ShoppingBag,
      color: 'text-[#006E7A]',
    },
    {
      label: 'Ticket Promedio',
      value: hasAccess && averageTicket !== null ? formatCurrency(averageTicket) : '—',
      change: 'Promedio por venta',
      icon: Receipt,
      color: 'text-[#4B227A]',
    },
    {
      label: 'Mejor Día',
      value: hasAccess && maxDay > 0 ? formatCurrency(maxDay) : '—',
      change: hasAccess && maxDay > 0 ? DAY_LABELS[bestDayIndex] : 'Sin datos',
      icon: Trophy,
      color: 'text-gray-700',
    },
  ];

  const transactions = useMemo(() => sales.map(normalizeSale), [sales]);
  const visibleTransactions = useMemo(
    () => filterSales(transactions, filterKey),
    [transactions, filterKey]
  );
  const recentTransactions = visibleTransactions.slice(0, 20);
  const hasFilter = filterKey !== 'all';

  const closeMenu = () => setMenuOpen(false);

  const selectFilter = (key) => {
    setFilterKey(key);
    closeMenu();
  };

  const openDetail = (transaction) => {
    if (!transaction) return;
    setDetailTx(transaction);
    closeMenu();
  };

  const exportVisible = (format) => {
    const stamp = csvDateStamp();
    const exported = format === 'csv'
      ? downloadTextFile(
        `transacciones-${stamp}.csv`,
        buildSalesCsv(visibleTransactions, filterKey),
        'text/csv;charset=utf-8',
        true
      )
      : downloadTextFile(
        `transacciones-${stamp}.json`,
        buildSalesJson(visibleTransactions, filterKey),
        'application/json;charset=utf-8'
      );
    closeMenu();
    return exported;
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-24 font-sans overflow-x-hidden">
      {/* Top Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 pt-10 pb-6 flex justify-between items-center border-b border-white/30">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Estadísticas</h1>
          <p className="text-sm text-gray-600">Resumen de la semana</p>
        </div>
      </div>

      {!loading && (error || notice) ? (
        <div className="px-4 pt-4">
          <DataNotice tone={error ? 'error' : 'info'}>{error || notice}</DataNotice>
        </div>
      ) : null}

      {/* Chart Main Card */}
      <div className="px-4 mt-4 mb-8">
        <div className="bg-white/80 backdrop-blur-md rounded-[32px] p-6 shadow-xl shadow-[#4B227A]/10 border border-white/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00EED0]/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>

          {/* Chart Header */}
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white/70 rounded-full p-1 border border-white/30">
                <button
                  aria-label="Semana anterior"
                  onClick={handlePreviousWeek}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-full transition-all text-gray-600 hover:text-[#4B227A]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-black text-gray-800 text-[11px] uppercase tracking-wider">
                  {getWeekRangeLabel(currentDate)}
                </span>
                <button
                  aria-label="Semana siguiente"
                  onClick={handleNextWeek}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-full transition-all text-gray-600 hover:text-[#4B227A]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex bg-white/70 p-1 rounded-2xl backdrop-blur-sm border border-white/30">
              <button
                onClick={handlePreviousWeek}
                className="px-4 py-2 rounded-xl text-[10px] tracking-widest uppercase transition-all text-gray-600 font-bold"
              >
                Semana
              </button>
            </div>
          </div>

          {loading ? <LoadingModule label="Cargando ventas…" /> : null}

          {!loading && hasWeekData ? (
            <div className="h-56 flex items-end justify-between gap-3 relative">
              <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none opacity-[0.03]">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="border-t-2 border-gray-900 w-full"></div>
                ))}
              </div>

              {days.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                  <div className="w-full relative">
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: `${day.height}%`, opacity: 1 }}
                      transition={{ delay: i * 0.05, duration: 0.5, ease: 'easeOut' }}
                      className={`w-full rounded-2xl ${day.color} shadow-sm relative overflow-hidden min-h-[4px] group-hover:brightness-110 transition-all cursor-pointer`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/10"></div>
                      {day.star && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2">
                          <Star className="w-3 h-3 text-white fill-current animate-bounce" />
                        </div>
                      )}
                    </motion.div>

                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#4B227A] text-white text-[10px] font-black py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-20">
                      {formatCurrency(day.value)}
                    </div>
                  </div>
                  <span className={`text-[10px] font-black tracking-tighter uppercase ${day.star ? 'text-[#006E7A]' : 'text-gray-600'}`}>
                    {day.name}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {!loading && !hasWeekData ? (
            <EmptyModule
              icon={BarChart3}
              title="Sin ventas esta semana"
              description="No hay pedidos completados en la semana seleccionada."
            />
          ) : null}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="px-6 grid grid-cols-2 gap-4 mb-8">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-white/30 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${kpi.color.replace('text-', '')}20` }}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <span className="text-xs font-bold text-gray-600">{kpi.label}</span>
            </div>
            <span className="text-2xl font-black text-gray-800">{kpi.value}</span>
            <span className="text-[10px] font-medium text-gray-600">{kpi.change}</span>
          </div>
        ))}
      </div>

      {/* Transactions List */}
      <div className="px-6 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-black text-gray-800 tracking-tight">Transacciones</h2>
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1">Últimos pedidos</p>
          </div>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="Opciones de transacciones"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="p-2 bg-white/80 rounded-xl shadow-sm border border-white/30 text-gray-600 hover:text-[#4B227A] transition-all"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                aria-label="Opciones de transacciones"
                className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-white/40 bg-white/90 shadow-xl backdrop-blur-md"
              >
                <p className="px-4 pb-1 pt-3 text-[9px] font-black uppercase tracking-widest text-[#006E7A]">
                  Filtrar por estado
                </p>
                {SALES_STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={filterKey === filter.key}
                    onClick={() => selectFilter(filter.key)}
                    className="flex w-full items-center gap-2 border-b border-white/40 px-4 py-2.5 text-left text-[11px] font-bold text-gray-800 transition-colors hover:bg-white"
                  >
                    {filterKey === filter.key ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-[#4B227A]" aria-hidden="true" />
                    ) : (
                      <Filter className="h-3.5 w-3.5 shrink-0 text-[#0197AF]" aria-hidden="true" />
                    )}
                    <span className="flex-1">{filter.label}</span>
                  </button>
                ))}

                <p className="px-4 pb-1 pt-3 text-[9px] font-black uppercase tracking-widest text-[#006E7A]">
                  Filtrar por fecha
                </p>
                {SALES_DATE_FILTERS.map((filter) => {
                  const Icon = DATE_FILTER_ICONS[filter.key] || CalendarDays;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={filterKey === filter.key}
                      onClick={() => selectFilter(filter.key)}
                      className="flex w-full items-center gap-2 border-b border-white/40 px-4 py-2.5 text-left text-[11px] font-bold text-gray-800 transition-colors hover:bg-white"
                    >
                      {filterKey === filter.key ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-[#4B227A]" aria-hidden="true" />
                      ) : (
                        <Icon className="h-3.5 w-3.5 shrink-0 text-[#0197AF]" aria-hidden="true" />
                      )}
                      <span className="flex-1">{filter.label}</span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => selectFilter('all')}
                  disabled={!hasFilter}
                  className="flex w-full items-center gap-2 border-b border-white/40 px-4 py-2.5 text-left text-[11px] font-bold text-[#006E7A] transition-colors hover:bg-white disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="flex-1">Limpiar filtro</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openDetail(visibleTransactions[0])}
                  disabled={visibleTransactions.length === 0}
                  className="flex w-full items-center gap-2 border-b border-white/40 px-4 py-2.5 text-left text-[11px] font-bold text-gray-800 transition-colors hover:bg-white disabled:opacity-40"
                >
                  <Eye className="h-3.5 w-3.5 shrink-0 text-[#006E7A]" aria-hidden="true" />
                  <span className="flex-1">Ver detalle</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => exportVisible('csv')}
                  className="flex w-full items-center gap-2 border-b border-white/40 px-4 py-2.5 text-left text-[11px] font-bold text-gray-800 transition-colors hover:bg-white"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[#006E7A]" aria-hidden="true" />
                  <span className="flex-1">Exportar CSV</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => exportVisible('json')}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[11px] font-bold text-gray-800 transition-colors hover:bg-white"
                >
                  <Download className="h-3.5 w-3.5 shrink-0 text-[#006E7A]" aria-hidden="true" />
                  <span className="flex-1">Exportar JSON</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {hasFilter ? (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#0197AF]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#006E7A]">
            <Filter className="h-3 w-3" aria-hidden="true" />
            <span>{filterSalesLabel(filterKey)} · {visibleTransactions.length}</span>
            <button
              type="button"
              onClick={() => setFilterKey('all')}
              aria-label="Limpiar filtro"
              className="rounded-full p-0.5 transition-colors hover:bg-white/70"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="space-y-4">
          {recentTransactions.map((tx) => (
            <button
              key={tx.id}
              type="button"
              onClick={() => openDetail(tx)}
              aria-label={`Ver detalle de ${tx.product}`}
              className="w-full bg-white/80 backdrop-blur-md rounded-[28px] p-4 shadow-sm border border-white/30 flex items-center justify-between transition-all hover:shadow-md hover:translate-y-[-2px] active:scale-[0.98] group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/70 border border-white/30 shrink-0 relative flex items-center justify-center">
                  {tx.image ? (
                    <SafeImage src={tx.image} alt={tx.product} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <ShoppingBag className="w-6 h-6 text-[#4B227A]/50" aria-hidden="true" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <h4 className="font-black text-gray-800 text-[13px] tracking-tight leading-none">{tx.product}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest bg-white/70 px-2 py-0.5 rounded-md border border-white/30">{tx.dateLabel}</span>
                    <div className="flex items-center gap-1 bg-[#00EED0]/20 px-2 py-0.5 rounded-md border border-[#00EED0]/30">
                      <div className="w-1 h-1 rounded-full bg-[#00EED0]"></div>
                      <span className="text-[9px] font-black text-[#4B227A] uppercase tracking-widest">{tx.statusLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-black text-gray-800 text-lg tracking-tighter">{tx.amountLabel}</span>
              </div>
            </button>
          ))}
        </div>

        {!loading && recentTransactions.length === 0 ? (
          <EmptyModule
            icon={Receipt}
            title="Sin transacciones"
            description={hasFilter
              ? `No hay pedidos que coincidan con «${filterSalesLabel(filterKey)}».`
              : 'Los pedidos del comercio aparecerán aquí.'}
            notice={error || notice || NOTICES.commerceMetrics}
            tone={error ? 'error' : 'info'}
          />
        ) : null}

        <button
          onClick={reload}
          disabled={loading}
          className="w-full mt-8 py-4 bg-[#00EED0] text-gray-900 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-[#00EED0]/30 hover:bg-[#00EED0]/90 transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? 'Actualizando…' : 'Actualizar historial'}
        </button>
      </div>

      {detailTx ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailTx(null);
          }}
        >
          <div
            ref={detailDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sales-detail-title"
            tabIndex={-1}
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-[28px] border border-white/40 bg-white/95 p-6 shadow-xl outline-none backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/40 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#006E7A]">
                  Detalle del pedido
                </p>
                <h3 id="sales-detail-title" className="mt-1 text-xl font-black text-gray-800">
                  {detailTx.product}
                </h3>
                <p className="mt-1 text-[10px] font-bold text-gray-600">{detailTx.orderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailTx(null)}
                aria-label="Cerrar detalle"
                className="rounded-xl border border-white/40 bg-white/80 p-2 text-gray-600 transition-colors hover:text-[#4B227A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <DetailItem label="Estado" value={detailTx.statusLabel} />
              <DetailItem label="Fecha" value={detailTx.dateLabel} />
              <DetailItem label="Monto" value={detailTx.amountLabel} />
              <DetailItem label="Moneda" value={detailTx.currency} />
              <DetailItem label="Vendedor" value={detailTx.seller} />
              <DetailItem
                label="Artículos"
                value={detailTx.items.length ? String(detailTx.items.length) : '—'}
              />
            </div>

            {detailTx.items.length ? (
              <div className="mt-4 rounded-2xl border border-white/40 bg-white/70 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#006E7A]">
                  Productos del pedido
                </p>
                <ul className="mt-2 space-y-2">
                  {detailTx.items.map((item, index) => (
                    <li
                      key={item.id || `${detailTx.id}-${index}`}
                      className="flex items-center justify-between gap-3 border-b border-white/40 pb-2 text-[11px] font-bold text-gray-700 last:border-b-0 last:pb-0"
                    >
                      <span>{item.name || item.item || 'Artículo'}</span>
                      <span className="text-[#4B227A]">
                        {item.quantity ? `× ${item.quantity}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {detailTx.raw?.status_reason ? (
              <p className="mt-4 rounded-xl border border-[#0197AF]/30 bg-[#0197AF]/10 px-3 py-2 text-[11px] font-semibold text-[#006E7A]">
                {detailTx.raw.status_reason}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setDetailTx(null)}
              className="mt-5 w-full rounded-2xl bg-[#00EED0] py-3 text-[11px] font-black uppercase tracking-[0.2em] text-gray-900 transition-colors hover:bg-[#00EED0]/90"
            >
              Cerrar detalle
            </button>
          </div>
        </div>
      ) : null}

      <CommerceBottomNav />
    </div>
  );
}
