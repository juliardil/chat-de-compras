// Utilidades CSV compartidas por las exportaciones auditadas de la Fase 5.
// Las columnas se declaran con `key`/`label` y opcionalmente `value(row)`.

const escapeCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export function buildCsv(columns, rows) {
  const header = columns.map((column) => escapeCell(column.label)).join(',');
  const body = rows.map((row) =>
    columns
      .map((column) => {
        const value = typeof column.value === 'function' ? column.value(row) : row[column.key];
        return escapeCell(value);
      })
      .join(',')
  );
  return [header, ...body].join('\r\n');
}

export function downloadCsv(filename, csv) {
  if (typeof window === 'undefined' || typeof Blob === 'undefined') return false;

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

export function csvDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
