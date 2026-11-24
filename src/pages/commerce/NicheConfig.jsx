import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import { Car, Clock, User, ChevronRight, Lock, SlidersHorizontal } from 'lucide-react';
import { DataNotice } from '../../components/ui/ModuleState';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/auth-context';
import {
  COMMERCE_VEHICLE_TYPES,
  fetchCommerceIdForUser,
  getInventoryLinesForVehicle,
  getInventoryLinesForVehicles,
  normalizeCommerceVehicleTypes,
  normalizeSlaMinutes,
  updateCommerceMaxResponseMinutes,
  updateCommerceSegmentation,
} from '../../data/appData';
import { useModuleData } from '../../data/useModuleData';

// Actualización estética Junio 2026

const RESPONSE_MINUTES = [5, 10, 15, 20, 30];

const asList = (...values) => {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
};

export default function NicheConfig() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const business = user?.business || {};

  // La fuente de verdad es commerce_profiles (la misma que usa el matching de
  // /dashboard). auth.users.profile.business se usa solo como respaldo en demo.
  const {
    extra,
    loading: loadingCommerce,
    error: commerceError,
    notice: commerceNotice,
    reload,
  } = useModuleData(
    async () => {
      const commerce = await fetchCommerceIdForUser(user?.id);
      const row = commerce.item || {};
      const vehicleTypes = normalizeCommerceVehicleTypes(
        asList(row.vehicle_types, business.vehicleTypes, business.vehicle_types)
      );
      const allowedLines = getInventoryLinesForVehicles(vehicleTypes);
      return {
        items: [],
        error: commerce.error,
        notice: commerce.notice,
        extra: {
          minutes: normalizeSlaMinutes(row.max_response_minutes),
          vehicleTypes,
          inventorySystems: asList(
            row.inventory_systems,
            business.inventorySystems,
            business.inventory_systems
          ).filter((line) => allowedLines.includes(line)),
        },
      };
    },
    [user?.id]
  );

  const [selectedMinutes, setSelectedMinutes] = useState(15);
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState([]);
  const [selectedInventorySystems, setSelectedInventorySystems] = useState([]);
  const [savingSla, setSavingSla] = useState(false);
  const [savingNiches, setSavingNiches] = useState(false);
  const [slaMessage, setSlaMessage] = useState(null);
  const [nicheMessage, setNicheMessage] = useState(null);

  useEffect(() => {
    if (!extra) return;
    if (extra.minutes) setSelectedMinutes(extra.minutes);
    if (Array.isArray(extra.vehicleTypes)) setSelectedVehicleTypes(extra.vehicleTypes);
    if (Array.isArray(extra.inventorySystems)) setSelectedInventorySystems(extra.inventorySystems);
  }, [extra]);

  // Cada familia muestra solo sus líneas. Las compartidas (Motor, Frenos…)
  // aparecen en ambos grupos y comparten el mismo valor guardado.
  const linesByVehicle = selectedVehicleTypes.map((family) => ({
    family,
    label: COMMERCE_VEHICLE_TYPES.find((item) => item.value === family)?.label || family,
    lines: getInventoryLinesForVehicle(family),
  }));

  const toggleValue = (setter) => (value) => {
    setter((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  // Al quitar un vehículo también se quitan las líneas que solo aplicaban a él,
  // para que la combinación guardada siga siendo válida en el matching.
  const toggleVehicleType = (family) => {
    const nextVehicleTypes = selectedVehicleTypes.includes(family)
      ? selectedVehicleTypes.filter((item) => item !== family)
      : [...selectedVehicleTypes, family];
    const allowedLines = getInventoryLinesForVehicles(nextVehicleTypes);
    setSelectedVehicleTypes(nextVehicleTypes);
    setSelectedInventorySystems((current) =>
      current.filter((line) => allowedLines.includes(line))
    );
  };

  const handleSaveResponseTime = async () => {
    setSavingSla(true);
    setSlaMessage(null);
    try {
      const result = await updateCommerceMaxResponseMinutes(selectedMinutes);
      if (!result.ok) {
        setSlaMessage({
          tone: 'error',
          text: result.error || 'No se pudo guardar el tiempo de respuesta.',
        });
        return;
      }
      setSlaMessage({
        tone: 'info',
        text: `Listo: ahora respondes en máx. ${selectedMinutes} min. Los compradores lo verán en tus ofertas.`,
      });
      reload();
    } catch (err) {
      setSlaMessage({
        tone: 'error',
        text: err?.message || 'No se pudo guardar el tiempo de respuesta.',
      });
    } finally {
      setSavingSla(false);
    }
  };

  const handleSaveNiches = async () => {
    setSavingNiches(true);
    setNicheMessage(null);
    try {
      const vehicleTypes = normalizeCommerceVehicleTypes(selectedVehicleTypes);
      const allowedLines = getInventoryLinesForVehicles(vehicleTypes);
      const inventorySystems = selectedInventorySystems.filter((line) =>
        allowedLines.includes(line)
      );
      const result = await updateCommerceSegmentation({ vehicleTypes, inventorySystems });

      // En modo demostración no hay RPC: se conserva la edición local del perfil.
      if (!result.ok && !result.skipped) {
        setNicheMessage({
          tone: 'error',
          text: result.error || 'No se pudieron guardar los nichos y líneas.',
        });
        return;
      }

      const savedVehicleTypes = result.item?.vehicleTypes || vehicleTypes;
      const savedInventorySystems = result.item?.inventorySystems || inventorySystems;

      // Mantiene auth.users.profile.business alineado y refresca el usuario en
      // memoria. app_ensure_profile ya sincronizó esas mismas listas a la BD.
      try {
        await updateProfile({
          business: {
            ...business,
            vehicleTypes: savedVehicleTypes,
            inventorySystems: savedInventorySystems,
          },
        });
      } catch {
        // La RPC ya guardó commerce_profiles; la sesión se rehidrata al recargar.
      }

      setNicheMessage({
        tone: 'info',
        text: result.skipped
          ? 'Nichos y líneas guardados en esta sesión (modo demostración).'
          : 'Nichos y líneas guardados. Tu panel ya usará las líneas activadas para mostrar solicitudes.',
      });
      reload();
    } catch (err) {
      setNicheMessage({
        tone: 'error',
        text: err?.message || 'No se pudieron guardar los nichos y líneas.',
      });
    } finally {
      setSavingNiches(false);
    }
  };

  const renderCheckCard = ({ value, label, checked, onChange, icon: Icon }) => (
    <label
      key={value}
      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
        checked
          ? 'border-[#00EED0] bg-[#00EED0]/20 text-[#006E7A]'
          : 'border-[#4B227A]/20 bg-white/70 text-gray-600 hover:bg-white'
      }`}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={() => onChange(value)}
        className="h-4 w-4 accent-[#0197AF]"
      />
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      {label}
    </label>
  );

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <header className="bg-white/80 backdrop-blur-md px-6 py-5 border-b border-white/30">
        <h1 className="text-xl font-bold text-gray-800">Configuración</h1>
        <p className="text-sm text-gray-600">Administra tus preferencias y perfil</p>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {/* Acceso a Perfil */}
        <div
          onClick={() => navigate('/edit-profile')}
          className="bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-white/30 flex items-center justify-between cursor-pointer hover:bg-white/90 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0197AF]/20 rounded-full flex items-center justify-center text-[#006E7A]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Perfil del Comercio</h3>
              <p className="text-xs text-gray-600">Editar información pública</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </div>

        {/* Cambiar Contraseña */}
        <div
          onClick={() => navigate('/change-password')}
          className="bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-white/30 flex items-center justify-between cursor-pointer hover:bg-white/90 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#4B227A]/20 rounded-full flex items-center justify-center text-[#4B227A]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Seguridad</h3>
              <p className="text-xs text-gray-600">Cambiar contraseña</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </div>

        {/* Nichos y líneas: controles reales conectados a commerce_profiles. */}
        <section className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#0197AF]/20 rounded-full flex items-center justify-center text-[#006E7A]">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Nichos Activos</h3>
              <p className="text-xs text-gray-600">Elige qué solicitudes quieres recibir</p>
            </div>
          </div>

          {loadingCommerce ? (
            <p className="mb-3 text-xs text-gray-600">Cargando tus nichos y líneas…</p>
          ) : null}
          {!loadingCommerce && (commerceError || commerceNotice) ? (
            <DataNotice tone={commerceError ? 'error' : 'info'} className="mb-3">
              {commerceError || commerceNotice}
            </DataNotice>
          ) : null}
          {nicheMessage ? (
            <DataNotice tone={nicheMessage.tone} className="mb-3">
              {nicheMessage.text}
            </DataNotice>
          ) : null}

          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#4B227A]">
            Tipos de vehículo
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {COMMERCE_VEHICLE_TYPES.map((item) =>
              renderCheckCard({
                value: item.value,
                label: item.label,
                checked: selectedVehicleTypes.includes(item.value),
                onChange: toggleVehicleType,
                icon: Car,
              })
            )}
          </div>

          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#4B227A]">
            Líneas de inventario por vehículo
          </p>
          {linesByVehicle.length === 0 ? (
            <DataNotice tone="info" className="mb-3">
              Marca al menos un tipo de vehículo para ver sus líneas disponibles.
            </DataNotice>
          ) : (
            <div className="flex flex-col gap-4">
              {linesByVehicle.map(({ family, label, lines }) => (
                <div
                  key={family}
                  role="group"
                  aria-label={`Líneas para ${label}`}
                  className="rounded-xl border border-[#4B227A]/15 bg-white/60 p-3"
                >
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#006E7A]">
                    {label}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {lines.map((line) =>
                      renderCheckCard({
                        value: line,
                        label: line,
                        checked: selectedInventorySystems.includes(line),
                        onChange: toggleValue(setSelectedInventorySystems),
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-[11px] text-gray-600">
            Las líneas compartidas (Motor, Frenos…) aparecen en ambos grupos y se marcan una sola vez.
            Marcas {selectedVehicleTypes.length} tipos de vehículo y {selectedInventorySystems.length}{' '}
            líneas. Al guardar, las solicitudes entrantes de esa combinación aparecen de inmediato en tu panel.
          </p>
          <Button
            onClick={handleSaveNiches}
            disabled={savingNiches || loadingCommerce}
            className="mt-3 w-full py-2.5 text-sm"
          >
            {savingNiches ? 'Guardando…' : 'Guardar nichos y líneas'}
          </Button>
        </section>

        {/* Tiempo de respuesta (SLA) que ven los compradores en cada oferta. */}
        <div className="bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-white/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#00EED0]/20 rounded-full flex items-center justify-center text-[#006E7A]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Tiempo de respuesta</h3>
              <p className="text-xs text-gray-600">Define en cuánto tiempo máximo atiendes una oferta elegida</p>
            </div>
          </div>

          {loadingCommerce ? <p className="text-xs text-gray-600">Cargando tu tiempo de respuesta…</p> : null}
          {!loadingCommerce && (commerceError || commerceNotice) ? (
            <DataNotice tone={commerceError ? 'error' : 'info'} className="mb-3">
              {commerceError || commerceNotice}
            </DataNotice>
          ) : null}
          {slaMessage ? (
            <DataNotice tone={slaMessage.tone} className="mb-3">
              {slaMessage.text}
            </DataNotice>
          ) : null}

          <label htmlFor="max-response-minutes" className="block text-xs font-bold text-gray-700 mb-1">
            Responde en máx.
          </label>
          <select
            id="max-response-minutes"
            aria-label="Tiempo máximo de respuesta"
            value={selectedMinutes}
            onChange={(e) => setSelectedMinutes(Number(e.target.value))}
            className="w-full rounded-xl border border-[#4B227A]/30 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0197AF]/30 focus:border-[#0197AF]"
          >
            {RESPONSE_MINUTES.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-gray-600">
            Los compradores verán «Responde en máx. {selectedMinutes} min» en tus ofertas. Si no respondes a tiempo, la solicitud se libera.
          </p>
          <Button
            onClick={handleSaveResponseTime}
            disabled={savingSla || loadingCommerce}
            className="mt-3 w-full py-2.5 text-sm"
          >
            {savingSla ? 'Guardando…' : 'Guardar tiempo de respuesta'}
          </Button>
        </div>
      </div>

      <CommerceBottomNav />
    </div>
  );
}
