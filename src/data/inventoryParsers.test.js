import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLUMN_MAPPING,
  googleSheetsCsvUrl,
  parseCsv,
  parseNumber,
  parseSharedStringsXml,
  parseSheetXml,
  parseXlsx,
  rowsToInventoryItems,
} from './inventoryParsers';

// Construye un ZIP mínimo con entradas sin compresión (método 0). Sirve para
// probar parseXlsx sin depender de DecompressionStream en jsdom.
const buildStoredZip = (files) => {
  const encoder = new TextEncoder();
  const fileRecords = [];
  const centralRecords = [];
  let offset = 0;

  const push16 = (target, value) => {
    target.push(value & 0xff, (value >> 8) & 0xff);
  };
  const push32 = (target, value) => {
    target.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff);
  };

  files.forEach(({ name, content }) => {
    const nameBytes = encoder.encode(name);
    const dataBytes = encoder.encode(content);

    const local = [];
    push32(local, 0x04034b50);
    push16(local, 20);
    push16(local, 0);
    push16(local, 0); // método 0: almacenado
    push16(local, 0);
    push16(local, 0);
    push32(local, 0);
    push32(local, dataBytes.length);
    push32(local, dataBytes.length);
    push16(local, nameBytes.length);
    push16(local, 0);
    local.push(...nameBytes, ...dataBytes);
    fileRecords.push(local);

    const central = [];
    push32(central, 0x02014b50);
    push16(central, 20);
    push16(central, 20);
    push16(central, 0);
    push16(central, 0);
    push16(central, 0);
    push16(central, 0);
    push32(central, 0);
    push32(central, dataBytes.length);
    push32(central, dataBytes.length);
    push16(central, nameBytes.length);
    push16(central, 0);
    push16(central, 0);
    push16(central, 0);
    push16(central, 0);
    push32(central, 0);
    push32(central, offset);
    central.push(...nameBytes);
    centralRecords.push(central);

    offset += local.length;
  });

  const centralOffset = offset;
  const flatCentral = centralRecords.flat();

  const eocd = [];
  push32(eocd, 0x06054b50);
  push16(eocd, 0);
  push16(eocd, 0);
  push16(eocd, files.length);
  push16(eocd, files.length);
  push32(eocd, flatCentral.length);
  push32(eocd, centralOffset);
  push16(eocd, 0);

  return new Uint8Array([...fileRecords.flat(), ...flatCentral, ...eocd]);
};

describe('lectura de inventario', () => {
  it('analiza CSV con comas entre comillas, saltos y BOM', () => {
    const csv =
      '\uFEFFProducto,Marca,Precio\r\n"Bafles 6.5"", Sony",Sony,"1,250.50"\r\n"Filtro\nAceite",Fram,80\r\n';

    expect(parseCsv(csv)).toEqual([
      ['Producto', 'Marca', 'Precio'],
      ['Bafles 6.5", Sony', 'Sony', '1,250.50'],
      ['Filtro\nAceite', 'Fram', '80'],
    ]);
  });

  it('detecta el punto y coma como separador', () => {
    expect(parseCsv('Producto;Stock\nBatería;3\n')).toEqual([
      ['Producto', 'Stock'],
      ['Batería', '3'],
    ]);
  });

  it('lee cadenas compartidas y celdas de una hoja XLSX', () => {
    const shared = parseSharedStringsXml(
      '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<si><t>Producto</t></si>' +
        '<si><r><t>Baf</t></r><r><t>les</t></r></si>' +
        '</sst>'
    );
    expect(shared).toEqual(['Producto', 'Bafles']);

    const rows = parseSheetXml(
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<sheetData>' +
        '<row r="1">' +
        '<c r="A1" t="s"><v>0</v></c>' +
        '<c r="B1" t="s"><v>1</v></c>' +
        '<c r="C1" t="inlineStr"><is><t>Precio</t></is></c>' +
        '</row>' +
        '<row r="2">' +
        '<c r="A2" t="inlineStr"><is><t>Bafles</t></is></c>' +
        '<c r="B2" t="b"><v>1</v></c>' +
        '<c r="C2"><v>250.5</v></c>' +
        '</row>' +
        '</sheetData></worksheet>',
      shared
    );

    expect(rows).toEqual([
      ['Producto', 'Bafles', 'Precio'],
      ['Bafles', 'TRUE', '250.5'],
    ]);
  });

  it('abre un XLSX real (ZIP almacenado) tomando la primera hoja', async () => {
    const zip = buildStoredZip([
      {
        name: 'xl/workbook.xml',
        content:
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<sheets><sheet name="Inventario" sheetId="1" r:id="rId1"/></sheets></workbook>',
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        content:
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/>' +
          '</Relationships>',
      },
      {
        name: 'xl/sharedStrings.xml',
        content:
          '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          '<si><t>Producto</t></si><si><t>Stock</t></si></sst>',
      },
      {
        name: 'xl/worksheets/sheet1.xml',
        content:
          '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          '<sheetData>' +
          '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
          '<row r="2"><c r="A2" t="inlineStr"><is><t>Batería</t></is></c>' +
          '<c r="B2"><v>4</v></c></row>' +
          '</sheetData></worksheet>',
      },
    ]);

    expect(await parseXlsx(zip.buffer)).toEqual([
      ['Producto', 'Stock'],
      ['Batería', '4'],
    ]);
  });

  it('convierte enlaces de Google Sheets a exportación CSV', () => {
    const url = googleSheetsCsvUrl(
      'https://docs.google.com/spreadsheets/d/abc123/edit#gid=456'
    );
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/spreadsheets/d/abc123/export');
    expect(parsed.searchParams.get('format')).toBe('csv');
    expect(parsed.searchParams.get('gid')).toBe('456');
    expect(googleSheetsCsvUrl('https://example.com/inventario.csv')).toBe(
      'https://example.com/inventario.csv'
    );
  });

  it('interpreta precios con separadores de miles y decimales', () => {
    expect(parseNumber('$1,250.50')).toBe(1250.5);
    expect(parseNumber('1.250,50')).toBe(1250.5);
    expect(parseNumber('')).toBe(0);
    expect(parseNumber('sin precio')).toBe(0);
  });

  it('convierte filas en productos omitiendo las que no tienen nombre', () => {
    const rows = [
      ['Producto', 'SKU', 'Marca', 'Categoría', 'Descripción', 'Bono', 'Precio', 'Stock', 'Vigencia'],
      ['Bafles Sony', 'REF-1', 'Sony', 'Audio', '6.5 pulgadas', 'Instalación gratis', '1,250.50', '3', '2026-12-31'],
      ['', 'REF-2', 'Sin nombre', 'Audio', '', '', '100', '1', ''],
    ];

    const result = rowsToInventoryItems(rows);

    expect(result.headers).toEqual([
      'Producto',
      'SKU',
      'Marca',
      'Categoría',
      'Descripción',
      'Bono',
      'Precio',
      'Stock',
      'Vigencia',
    ]);
    expect(result.skipped).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      external_key: 'REF-1',
      sku: 'REF-1',
      name: 'Bafles Sony',
      brand: 'Sony',
      category: 'Audio',
      description: '6.5 pulgadas',
      bonus: 'Instalación gratis',
      price: 1250.5,
      stock: 3,
      currency: 'MXN',
      valid_until: '2026-12-31',
      is_active: true,
    });
    expect(result.preview).toHaveLength(1);
  });

  it('respeta un mapeo de columnas guardado', () => {
    const rows = [
      ['Nombre', 'Costo', 'Existencias'],
      ['Amortiguador', '900', '2'],
    ];

    const result = rowsToInventoryItems(rows, {
      ...DEFAULT_COLUMN_MAPPING,
      name: 'Nombre',
      price: 'Costo',
      stock: 'Existencias',
    });

    expect(result.items[0]).toMatchObject({
      name: 'Amortiguador',
      price: 900,
      stock: 2,
    });
  });
});
