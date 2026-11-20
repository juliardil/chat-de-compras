import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, ChevronDown, FileSpreadsheet, Link2, Package, RefreshCw, Save } from 'lucide-react';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import Button from '../../components/ui/Button';
import SafeImage from '../../components/ui/SafeImage';
import { DataNotice, EmptyModule, LoadingModule } from '../../components/ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import { useModuleData } from '../../data/useModuleData';
import { formatCurrency } from '../../data/appData';
import {
  fetchInventorySource,
  fetchMyInventory,
  mapInventoryItem,
  saveInventorySource,
  setInventoryAlternatives,
  setInventoryGroup,
  setInventoryPhoto,
  syncInventory,
  uploadInventoryPhoto,
  INVENTORY_NOTICES,
} from '../../data/businessInventory';
import { getFreshness } from '../../data/inventoryMatching';
import {
  COLUMN_FIELDS,
  DEFAULT_COLUMN_MAPPING,
  googleSheetsCsvUrl,
  parseCsv,
  parseXlsx,
  rowsToInventoryItems,
} from '../../data/inventoryParsers';

// «Mi Inventario» conserva la misma línea visual del panel: fondo gris claro,
// tarjetas blancas translúcidas, bordes suaves y acentos menta/verde agua.
const SOURCE_OPTIONS = [
  { value: 'sheets', label: 'Google Sheets' },
  { value: 'csv', label: 'Archivo CSV' },
  { value: 'xlsx', label: 'Excel (XLSX)' },
];

const FIELD_LABELS = {
  name: 'Producto',
  sku: 'SKU / código',
  brand: 'Marca',
  category: 'Categoría',
  description: 'Descripción',
  bonus: 'Bono o servicio',
  price: 'Precio',
  stock: 'Stock',
  valid_until: 'Vigencia',
};

const parseAlternativesText = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [brand, price] = entry.split(':');
      return {
        id: `alt-${index + 1}`,
        brand: String(brand || '').trim(),
        price: String(price || '').trim(),
      };
    })
    .filter((entry) => entry.brand);

const freshnessClasses = (status) => {
  if (status === 'expired') return 'bg-red-50 text-red-800 border-red-200';
  if (status === 'expiring') return 'bg-amber-50 text-amber-900 border-amber-200';
  return 'bg-[#00EED0]/20 text-[#4B227A] border-[#00EED0]/30';
};

export default function Inventory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [provider, setProvider] = useState('sheets');
  const [sourceUrl, setSourceUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [sheetRows, setSheetRows] = useState([]);
  const [mapping, setMapping] = useState({ ...DEFAULT_COLUMN_MAPPING });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [openItemId, setOpenItemId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const { items, extra, loading, error, notice, reload } = useModuleData(async () => {
    const [inventoryResult, sourceResult] = await Promise.all([
      fetchMyInventory(),
      fetchInventorySource(),
    ]);

    return {
      items: inventoryResult.items.map(mapInventoryItem),
      error: inventoryResult.error || sourceResult.error || null,
      notice: inventoryResult.notice || sourceResult.notice || null,
      extra: { source: sourceResult.items[0] || null },
    };
  }, [user?.id]);

  const source = extra?.source || null;

  const updateMapping = (field, header) =>
    setMapping((current) => ({ ...current, [field]: header }));

  const setDraft = (itemId, patch) =>
    setDrafts((current) => ({
      ...current,
      [itemId]: { group: '', alternatives: '', ...(current[itemId] || {}), ...patch },
    }));

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setSourceError('');
    setFeedback('');
    setBusy(true);

    try {
      const isExcel = /\.xlsx$/i.test(file.name);
      const rows = isExcel ? await parseXlsx(await file.arrayBuffer()) : parseCsv(await file.text());
      setSheetRows(rows);
      setFileName(file.name);
      setProvider(isExcel ? 'xlsx' : 'csv');
      setFeedback(
        rows.length > 1
          ? `${rows.length - 1} filas detectadas. Revisa el mapeo y sincroniza.`
          : 'El archivo no contiene filas de productos.'
      );
    } catch (fileError) {
      setSourceError(fileError?.message || 'No se pudo leer el archivo.');
    } finally {
      setBusy(false);
    }
  };

  const handleAnalyzeUrl = async () => {
    const url = sourceUrl.trim();
    if (!url) {
      setSourceError('Pega el enlace de Google Sheets o CSV.');
      return;
    }

    setSourceError('');
    setFeedback('');
    setBusy(true);

    try {
      const response = await fetch(googleSheetsCsvUrl(url));
      if (!response.ok) throw new Error('No se pudo descargar el enlace. Verifica que sea público.');
      const rows = parseCsv(await response.text());
      setSheetRows(rows);
      setFileName(provider === 'sheets' ? 'Google Sheets' : url);
      setFeedback(
        rows.length > 1
          ? `${rows.length - 1} filas detectadas. Revisa el mapeo y sincroniza.`
          : 'El enlace no contiene filas de productos.'
      );
    } catch (fetchError) {
      setSourceError(fetchError?.message || 'No se pudo descargar el inventario.');
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    if (sheetRows.length === 0) {
      setSourceError('Primero analiza un archivo o un enlace para sincronizar.');
      return;
    }

    const { items: parsedItems, skipped } = rowsToInventoryItems(sheetRows, mapping);
    if (parsedItems.length === 0) {
      setSourceError('No se detectaron productos. Revisa que exista una columna de producto.');
      return;
    }

    setSourceError('');
    setFeedback('');
    setBusy(true);

    const saved = await saveInventorySource({
      provider,
      sourceUrl: sourceUrl.trim() || null,
      fileName: fileName || null,
      columnMapping: mapping,
    });

    if (!saved.ok) {
      setBusy(false);
      setSourceError(saved.error || INVENTORY_NOTICES.saveSource);
      return;
    }

    const summary = await syncInventory({
      items: parsedItems,
      sourceId: saved.data?.[0]?.id || source?.id || null,
      summary: { skipped, fileName, provider },
    });

    setBusy(false);

    if (!summary.ok) {
      setSourceError(summary.error || INVENTORY_NOTICES.sync);
      return;
    }

    const result = summary.data?.[0] || {};
    setFeedback(
      `Sincronizado: ${result.inserted ?? 0} nuevos, ${result.updated ?? 0} actualizados y ${skipped} omitidos.`
    );
    reload();
  };

  const handlePhoto = async (itemId, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setSourceError('');

    const uploaded = await uploadInventoryPhoto({ userId: user?.id, file });
    if (uploaded.error) {
      setBusy(false);
      setSourceError(uploaded.error);
      return;
    }

    const saved = await setInventoryPhoto(itemId, uploaded.url);
    setBusy(false);

    if (!saved.ok) {
      setSourceError(saved.error || INVENTORY_NOTICES.photo);
      return;
    }

    setFeedback('Foto del producto actualizada.');
    reload();
  };

  const handleSaveGroup = async (itemId) => {
    const group = drafts[itemId]?.group || '';
    setBusy(true);
    const saved = await setInventoryGroup(itemId, group);
    setBusy(false);

    if (!saved.ok) {
      setSourceError(saved.error || INVENTORY_NOTICES.group);
      return;
    }

    setFeedback('Grupo de equivalencia guardado.');
    reload();
  };

  const handleSaveAlternatives = async (itemId) => {
    const alternatives = parseAlternativesText(drafts[itemId]?.alternatives || '');
    setBusy(true);
    const saved = await setInventoryAlternatives(itemId, alternatives);
    setBusy(false);

    if (!saved.ok) {
      setSourceError(saved.error || INVENTORY_NOTICES.alternatives);
      return;
    }

    setFeedback('Alternativas guardadas.');
    reload();
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-24">
      <header className="bg-white/80 backdrop-blur-md px-4 py-4 border-b border-white/30 sticky top-0 z-10 flex items-center gap-3">
        <button
          aria-label="Volver"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-white/50 rounded-full"
        >
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#006E7A]" />
            Mi Inventario
          </h1>
          <p className="text-xs text-gray-600">
            {loading
              ? 'Cargando productos…'
              : `${items.length} ${items.length === 1 ? 'producto' : 'productos'} · precios, stock y vigencia`}
          </p>
        </div>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {sourceError ? <DataNotice tone="error">{sourceError}</DataNotice> : null}
        {feedback ? <DataNotice>{feedback}</DataNotice> : null}

        {/* Fuente de inventario: Sheets, CSV o XLSX */}
        <section className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white/30">
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet className="w-5 h-5 text-[#006E7A]" />
            <div>
              <h2 className="font-bold text-gray-800">Fuente del inventario</h2>
              <p className="text-xs text-gray-600">
                Conecta tu hoja y vuelve a sincronizar cuando cambien precios o stock.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-800">Origen</span>
              <div className="relative">
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 focus:border-[#00EED0] appearance-none cursor-pointer"
                >
                  {SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-5 h-5 text-gray-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                <Link2 className="w-3.5 h-3.5 text-[#006E7A]" /> Enlace de Google Sheets o CSV
              </span>
              <input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 focus:border-[#00EED0]"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAnalyzeUrl}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0197AF]/10 border border-[#0197AF]/30 px-3 py-2 text-xs font-bold text-[#006E7A] hover:bg-[#0197AF]/20 transition-colors disabled:opacity-60"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Analizar enlace
              </button>

              <label className="inline-flex items-center gap-1.5 rounded-xl bg-white/70 border border-white/40 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-white transition-colors cursor-pointer">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#006E7A]" /> Analizar archivo
                <input
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
            </div>

            {sheetRows.length > 0 ? (
              <div className="rounded-xl border border-white/40 bg-white/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Mapeo de columnas
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {COLUMN_FIELDS.map((field) => (
                    <label key={field} className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-gray-700">{FIELD_LABELS[field]}</span>
                      <div className="relative">
                        <select
                          value={mapping[field] || ''}
                          onChange={(event) => updateMapping(field, event.target.value)}
                          className="w-full bg-white/70 border border-white/40 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30"
                        >
                          <option value="">Sin columna</option>
                          {sheetRows[0].map((header, index) => (
                            <option key={`${field}-${index}`} value={header}>
                              {String(header || `Columna ${index + 1}`)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <Button fullWidth onClick={handleSync} disabled={busy} className="py-2.5 text-sm">
              <Save className="w-4 h-4" />
              {busy ? 'Guardando…' : 'Guardar fuente y sincronizar'}
            </Button>

            {source?.last_synced_at ? (
              <p className="text-[11px] text-gray-600">
                Última sincronización: {new Date(source.last_synced_at).toLocaleString('es-MX')}
                {source.last_sync_summary?.skipped != null
                  ? ` · ${source.last_sync_summary.skipped} filas omitidas`
                  : ''}
              </p>
            ) : null}
          </div>
        </section>

        {loading ? <LoadingModule label="Cargando inventario…" /> : null}

        {!loading && (error || notice) && items.length > 0 ? (
          <DataNotice tone={error ? 'error' : 'info'}>{error || notice}</DataNotice>
        ) : null}

        {!loading && items.map((item) => {
          const freshness = getFreshness(item);
          const isOpen = openItemId === item.id;

          return (
            <article
              key={item.id}
              className="bg-white/70 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white/30"
            >
              <div className="flex gap-3">
                <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-white/50 border border-white/30 flex items-center justify-center">
                  {item.photo ? (
                    <SafeImage
                      src={item.photo}
                      alt={`Foto de ${item.name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-[#4B227A]/60" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-800 break-words">{item.name}</h3>
                      <p className="text-xs text-gray-600">
                        {[item.brand, item.sku ? `SKU ${item.sku}` : ''].filter(Boolean).join(' · ') || 'Sin marca'}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold text-[#006E7A]">
                      {formatCurrency(item.price, item.currency)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold bg-[#00EED0]/20 text-[#4B227A] px-2 py-0.5 rounded-full border border-[#00EED0]/30">
                      {item.stock} en stock
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${freshnessClasses(freshness.status)}`}>
                      {freshness.label}
                    </span>
                    {item.bonus ? (
                      <span className="text-[10px] font-bold text-[#4B227A] bg-[#4B227A]/10 px-2 py-0.5 rounded-full border border-[#4B227A]/20">
                        Bono: {item.bonus}
                      </span>
                    ) : null}
                  </div>

                  {item.equivalenceGroup ? (
                    <p className="mt-1 text-[11px] text-gray-600">
                      Grupo de equivalencia: <strong>{item.equivalenceGroup}</strong>
                    </p>
                  ) : null}

                  {item.alternatives.length > 0 ? (
                    <p className="mt-1 text-[11px] text-gray-600">
                      Alternativas: {item.alternatives.map((alt) => alt.brand).join(', ')}
                    </p>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpenItemId(isOpen ? null : item.id)}
                aria-expanded={isOpen}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#006E7A] hover:underline"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                {isOpen ? 'Cerrar opciones del producto' : 'Foto, equivalencia y alternativas'}
              </button>

              {isOpen ? (
                <div className="mt-2 space-y-3 rounded-xl border border-white/40 bg-white/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-gray-700">Foto del producto</span>
                    <label className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 border border-white/40 px-2.5 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-white cursor-pointer">
                      <Camera className="w-3.5 h-3.5 text-[#006E7A]" />
                      {item.photo ? 'Cambiar foto' : 'Agregar foto'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handlePhoto(item.id, event)}
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-gray-700">Grupo de equivalencia</span>
                    <input
                      type="text"
                      placeholder="Ej. Pastillas delanteras Corolla 2015-2020"
                      value={drafts[item.id]?.group ?? item.equivalenceGroup}
                      onChange={(event) => setDraft(item.id, { group: event.target.value })}
                      className="w-full bg-white/70 border border-white/40 rounded-lg px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveGroup(item.id)}
                      disabled={busy}
                      className="self-start text-[11px] font-bold text-[#006E7A] hover:underline disabled:opacity-60"
                    >
                      Guardar grupo
                    </button>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-gray-700">
                      Alternativas compatibles (Marca:precio, separadas por coma)
                    </span>
                    <input
                      type="text"
                      placeholder="Ej. Bosch:450, Monroe:520"
                      value={
                        drafts[item.id]?.alternatives ??
                        item.alternatives.map((alt) => `${alt.brand}:${alt.price}`).join(', ')
                      }
                      onChange={(event) => setDraft(item.id, { alternatives: event.target.value })}
                      className="w-full bg-white/70 border border-white/40 rounded-lg px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveAlternatives(item.id)}
                      disabled={busy}
                      className="self-start text-[11px] font-bold text-[#006E7A] hover:underline disabled:opacity-60"
                    >
                      Guardar alternativas
                    </button>
                  </label>
                </div>
              ) : null}
            </article>
          );
        })}

        {!loading && items.length === 0 ? (
          <EmptyModule
            icon={Package}
            title="Tu inventario está vacío"
            description="Conecta un archivo o un enlace de Google Sheets para autocompletar tus cotizaciones."
            notice={error || notice || INVENTORY_NOTICES.load}
            tone={error ? 'error' : 'info'}
          />
        ) : null}
      </div>

      <CommerceBottomNav
        panelPath={user?.role === 'commerce' ? '/dashboard' : '/workshop-jobs'}
        profilePath={user?.role === 'commerce' ? '/profile' : '/profile-user'}
      />
    </div>
  );
}
