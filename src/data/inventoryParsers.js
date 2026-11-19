// =============================================================================
// Lectores ligeros de inventario (CSV, XLSX y Google Sheets).
//
// No se agregan dependencias: CSV se analiza en este archivo; XLSX se lee con
// el ZIP embebido + DecompressionStream del navegador + DOMParser. Las hojas de
// Google se convierten a su URL pública de exportación CSV. Todo es aditivo.
// =============================================================================

export const DEFAULT_COLUMN_MAPPING = {
  name: 'Producto',
  sku: 'SKU',
  brand: 'Marca',
  category: 'Categoría',
  description: 'Descripción',
  bonus: 'Bono',
  price: 'Precio',
  stock: 'Stock',
  valid_until: 'Vigencia',
};

export const COLUMN_FIELDS = Object.keys(DEFAULT_COLUMN_MAPPING);

const FIELD_SYNONYMS = {
  name: ['producto', 'product', 'nombre', 'name', 'item', 'repuesto', 'articulo', 'descripcion corta'],
  sku: ['sku', 'codigo', 'código', 'clave', 'code', 'numero de parte', 'número de parte', 'part number'],
  brand: ['marca', 'brand'],
  category: ['categoria', 'categoría', 'category', 'tipo', 'linea', 'línea'],
  description: ['descripcion', 'descripción', 'description', 'detalle', 'notas'],
  bonus: ['bono', 'bonus', 'descuento', 'promocion', 'promoción', 'servicio incluido'],
  price: ['precio', 'price', 'costo', 'cost', 'tarifa'],
  stock: ['stock', 'existencia', 'inventario', 'cantidad', 'quantity', 'disponible'],
  valid_until: ['vigencia', 'vence', 'valid until', 'expiracion', 'expiración', 'fecha de vigencia'],
};

const normalizeLabel = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const countDelimiter = (line, delimiter) => {
  let count = 0;
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      count += 1;
    }
  }
  return count;
};

// Analiza CSV respetando comillas dobles, saltos dentro de celdas y BOM.
export function parseCsv(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const delimiter = [',', ';', '\t', '|'].reduce((best, candidate) =>
    countDelimiter(firstLine, candidate) > countDelimiter(firstLine, best) ? candidate : best
  , ',');

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => String(value).trim() !== ''));
}

const localName = (node) => String(node?.localName || node?.nodeName || '').replace(/^.*:/, '');

const childrenWithName = (node, name) =>
  Array.from(node?.children || []).filter((child) => localName(child) === name);

const descendantsWithName = (node, name) => {
  if (!node) return [];
  const found = [];
  const visit = (current) => {
    Array.from(current.children || []).forEach((child) => {
      if (localName(child) === name) found.push(child);
      visit(child);
    });
  };
  visit(node);
  return found;
};

export function parseSharedStringsXml(xml) {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return descendantsWithName(doc.documentElement, 'si').map((node) =>
    descendantsWithName(node, 't').map((textNode) => textNode.textContent || '').join('')
  );
}

const columnIndex = (reference) => {
  const letters = String(reference || '').replace(/[^A-Z]/gi, '').toUpperCase();
  if (!letters) return 0;
  let index = 0;
  for (let i = 0; i < letters.length; i += 1) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
};

// Helper puro (sin ZIP ni red) para probar la lectura del XML de una hoja.
export function parseSheetXml(xml, sharedStrings = []) {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return [];

  return descendantsWithName(doc.documentElement, 'row').map((rowNode) => {
    const values = [];
    childrenWithName(rowNode, 'c').forEach((cell) => {
      const index = columnIndex(cell.getAttribute('r'));
      const type = String(cell.getAttribute('t') || '');
      const raw = descendantsWithName(cell, 'v')[0]?.textContent ?? '';
      let value = raw;

      if (type === 's') {
        value = sharedStrings[Number(raw)] ?? '';
      } else if (type === 'inlineStr') {
        value = descendantsWithName(cell, 't').map((node) => node.textContent || '').join('');
      } else if (type === 'b') {
        value = raw === '1' ? 'TRUE' : 'FALSE';
      }

      values[index] = String(value ?? '');
    });
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] === undefined) values[i] = '';
    }
    return values;
  }).filter((row) => row.some((value) => String(value).trim() !== ''));
}

const findEocd = (bytes) => {
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      return i;
    }
  }
  throw new Error('El archivo XLSX no es un ZIP válido.');
};

const decodeName = (bytes) => new TextDecoder().decode(bytes);

const unzipEntries = (buffer) => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(bytes);
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const entries = new Map();

  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decodeName(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    entries.set(name, { method, compressedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return { bytes, view, entries };
};

const inflateRaw = async (compressed) => {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador no puede leer archivos XLSX. Exporta el inventario a CSV.');
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const readEntry = async (zip, name) => {
  const entry = zip.entries.get(name);
  if (!entry) return null;

  const { bytes, view } = zip;
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = bytes.subarray(start, start + entry.compressedSize);
  const content = entry.method === 0 ? compressed : await inflateRaw(compressed);
  return new TextDecoder().decode(content);
};

// Lee la primera hoja de un XLSX. Devuelve una matriz de celdas en texto.
export async function parseXlsx(buffer) {
  const zip = unzipEntries(buffer);
  const sharedStrings = parseSharedStringsXml(await readEntry(zip, 'xl/sharedStrings.xml'));

  let sheetPath = 'xl/worksheets/sheet1.xml';
  const workbookXml = await readEntry(zip, 'xl/workbook.xml');
  const relsXml = await readEntry(zip, 'xl/_rels/workbook.xml.rels');

  if (workbookXml && relsXml) {
    const workbook = new DOMParser().parseFromString(workbookXml, 'application/xml');
    const rels = new DOMParser().parseFromString(relsXml, 'application/xml');
    const firstSheet = descendantsWithName(workbook.documentElement, 'sheet')[0];
    const relId = firstSheet?.getAttribute('r:id') || firstSheet?.getAttributeNS?.(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'
    );
    const relation = descendantsWithName(rels.documentElement, 'Relationship')
      .find((node) => node.getAttribute('Id') === relId);
    const target = relation?.getAttribute('Target');
    if (target) {
      sheetPath = target.startsWith('/') ? target.replace(/^\//, '') : `xl/${target}`;
    }
  }

  const sheetXml = await readEntry(zip, sheetPath) || await readEntry(zip, 'xl/worksheets/sheet1.xml');
  return parseSheetXml(sheetXml, sharedStrings);
}

// Convierte cualquier URL de Google Sheets a CSV exportable (hoja por gid).
export function googleSheetsCsvUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('google.com')) return value;

    const hashGid = new URLSearchParams(parsed.hash.replace(/^#/, '')).get('gid');
    const gid = parsed.searchParams.get('gid') || hashGid;
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/(edit|preview|export)$/, '/export');
    parsed.searchParams.set('format', 'csv');
    if (gid) parsed.searchParams.set('gid', gid);
    return parsed.toString();
  } catch {
    return value;
  }
}

export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const clean = String(value ?? '').replace(/[^\d.,-]/g, '').trim();
  if (!clean || clean === '-') return 0;

  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  const separator = lastComma > lastDot ? ',' : '.';
  const thousands = separator === ',' ? '.' : ',';
  const normalized = clean
    .split(thousands)
    .join('')
    .replace(separator, '.');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

const findHeaderIndex = (headers, field, mapping) => {
  const configured = normalizeLabel(mapping?.[field] || DEFAULT_COLUMN_MAPPING[field]);
  const exact = headers.findIndex((header) => normalizeLabel(header) === configured);
  if (exact >= 0) return exact;

  const synonyms = (FIELD_SYNONYMS[field] || []).map(normalizeLabel);
  return headers.findIndex((header) => {
    const label = normalizeLabel(header);
    return label && synonyms.some((synonym) => label === synonym || label.startsWith(`${synonym} `));
  });
};

// Convierte filas (matriz) en productos listos para app_sync_inventory.
// `mapping` viene de business_inventory_sources.column_mapping.
export function rowsToInventoryItems(rows, mapping = DEFAULT_COLUMN_MAPPING) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { items: [], headers: [], preview: [], skipped: 0 };
  }

  const headers = rows[0].map((value) => String(value ?? '').trim());
  const indexes = COLUMN_FIELDS.reduce((result, field) => {
    result[field] = findHeaderIndex(headers, field, mapping);
    return result;
  }, {});

  const read = (row, field) => {
    const index = indexes[field];
    return index >= 0 ? String(row[index] ?? '').trim() : '';
  };

  const items = [];
  let skipped = 0;

  rows.slice(1).forEach((row, rowIndex) => {
    if (!Array.isArray(row) || !row.some((value) => String(value ?? '').trim())) return;

    const name = read(row, 'name');
    if (!name) {
      skipped += 1;
      return;
    }

    const sku = read(row, 'sku');
    items.push({
      external_key: sku || `${normalizeLabel(name)}-${rowIndex + 1}`,
      sku,
      name,
      brand: read(row, 'brand'),
      category: read(row, 'category'),
      description: read(row, 'description'),
      bonus: read(row, 'bonus'),
      price: parseNumber(read(row, 'price')),
      stock: Math.max(0, Math.floor(parseNumber(read(row, 'stock')))),
      currency: 'MXN',
      valid_until: read(row, 'valid_until'),
      is_active: true,
    });
  });

  return { items, headers, preview: items.slice(0, 5), skipped };
}
