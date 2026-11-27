// Helpers del historial de ventas del comercio.
// Solo transforman datos reales devueltos por `fetchCommerceSales`: nunca
// inventan pedidos ni reemplazan valores ausentes por datos de ejemplo.

import { ORDER_STATUS_LABELS, formatCurrency } from '../../data/appData';

const DONE_STATUSES = new Set(['confirmed', 'delivered', 'completed']);
const PENDING_STATUSES = new Set(['pending', 'preparing', 'shipped']);

export const SALES_STATUS_FILTERS = [
  { key: 'all', label: 'Todas las transacciones' },
  { key: 'done', label: 'Entregadas y confirmadas' },
  { key: 'pending', label: 'Pendientes' },
];

export const SALES_DATE_FILTERS = [
  { key: 'today', label: 'Hoy' },
  { key: 'last7', label: 'Últimos 7 días' },
  { key: 'last30', label: 'Últimos 30 días' },
];

export const SALES_FILTERS = [...SALES_STATUS_FILTERS, ...SALES_DATE_FILTERS];

export const filterSalesLabel = (key) =>
  SALES_FILTERS.find((filter) => filter.key === key)?.label || 'Todas las transacciones';

export const saleDate = (sale) =>
  sale?.completed_at
  || sale?.delivered_at
  || sale?.placed_at
  || sale?.created_at;

export const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function normalizeSale(sale) {
  const snapshot = sale?.snapshot && typeof sale.snapshot === 'object' ? sale.snapshot : {};
  const items = Array.isArray(sale?.items) ? sale.items : [];
  const dateValue = saleDate(sale);
  const date = new Date(dateValue);
  const hasDate = dateValue && !Number.isNaN(date.getTime());

  return {
    id: sale?.id || null,
    orderNumber: sale?.order_number || sale?.id || 'Pedido',
    raw: sale,
    product: snapshot.product || items[0]?.name || sale?.order_number || 'Pedido',
    dateLabel: formatDateTime(dateValue),
    dateIso: hasDate ? date.toISOString() : null,
    timestamp: hasDate ? date.getTime() : null,
    amount: Number(sale?.total_amount || 0),
    amountLabel: formatCurrency(sale?.total_amount, sale?.currency),
    currency: sale?.currency || 'MXN',
    statusKey: sale?.status || '',
    statusLabel: ORDER_STATUS_LABELS[sale?.status] || sale?.status || 'Sin estado',
    image: snapshot.image || null,
    seller: sale?.sold_by_name || '',
    items,
    snapshot,
  };
}

export function filterSales(transactions, key, now = new Date()) {
  if (!key || key === 'all') return transactions;

  if (key === 'done') {
    return transactions.filter((transaction) => DONE_STATUSES.has(transaction.statusKey));
  }

  if (key === 'pending') {
    return transactions.filter((transaction) => PENDING_STATUSES.has(transaction.statusKey));
  }

  const reference = now instanceof Date ? now : new Date(now);
  const nowMs = reference.getTime();
  if (Number.isNaN(nowMs)) return transactions;

  let cutoffMs = null;
  if (key === 'today') {
    cutoffMs = new Date(nowMs);
    cutoffMs.setHours(0, 0, 0, 0);
    cutoffMs = cutoffMs.getTime();
  } else if (key === 'last7') {
    cutoffMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  } else if (key === 'last30') {
    cutoffMs = nowMs - 30 * 24 * 60 * 60 * 1000;
  }

  if (cutoffMs === null) return transactions;
  return transactions.filter(
    (transaction) => transaction.timestamp !== null && transaction.timestamp >= cutoffMs
  );
}

const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

export const csvDateStamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toExportRow = (transaction) => ({
  pedido: transaction.orderNumber,
  producto: transaction.product,
  fecha: transaction.dateIso || '',
  estado: transaction.statusLabel,
  monto: transaction.amount,
  moneda: transaction.currency,
  vendedor: transaction.seller,
  articulos: Array.isArray(transaction.items) ? transaction.items.length : 0,
});

export function buildSalesCsv(transactions, filterKey = 'all') {
  const rows = transactions.map(toExportRow);
  const columns = [
    { key: 'pedido', label: 'Pedido' },
    { key: 'producto', label: 'Producto' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'estado', label: 'Estado' },
    { key: 'monto', label: 'Monto' },
    { key: 'moneda', label: 'Moneda' },
    { key: 'vendedor', label: 'Vendedor' },
    { key: 'articulos', label: 'Artículos' },
  ];

  return [
    `# Filtro: ${filterSalesLabel(filterKey)}`,
    columns.map((column) => escapeCsvCell(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvCell(row[column.key])).join(',')),
  ].join('\r\n');
}

export function buildSalesJson(transactions, filterKey = 'all') {
  return JSON.stringify(
    {
      exportado_en: new Date().toISOString(),
      filtro: filterSalesLabel(filterKey),
      total: transactions.length,
      transacciones: transactions.map(toExportRow),
    },
    null,
    2
  );
}

export function downloadTextFile(filename, content, mime, withBom = false) {
  if (
    typeof document === 'undefined'
    || typeof Blob === 'undefined'
    || typeof URL === 'undefined'
    || typeof URL.createObjectURL !== 'function'
  ) {
    return false;
  }

  const blob = new Blob([withBom ? `\uFEFF${content}` : content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
  return true;
}
