import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import { Car, Check, Clock, User, ChevronRight, Lock, SlidersHorizontal } from 'lucide-react';
import { DataNotice, EmptyModule } from '../../components/ui/ModuleState';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/auth-context';
import {
  fetchCommerceIdForUser,
  normalizeSlaMinutes,
  updateCommerceMaxResponseMinutes,
} from '../../data/appData';
import { useModuleData } from '../../data/useModuleData';

// Actualización estética Junio 2026

const CATEGORY_LABELS = {
  repuestos: 'Repuestos Originales / Genéricos',
  taller: 'Taller / Servicios',
};

const VEHICLE_LABELS = {
  car: 'Automotriz',
  bike: 'Motos',
};

const RESPONSE_MINUTES = [5, 10, 15, 20, 30];

export default function NicheConfig() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const business = user?.business || {};

  // Los nichos se derivan del perfil comercial real que ya está guardado en
  // auth.users.profile.business. No hay interruptores porque el guardado de
  // preferencias de nicho todavía no existe en el backend.
  const niches = [
    ...(business.mainCategory ? [CATEGORY_LABELS[business.mainCategory] || business.mainCategory] : []),
    ...(Array.isArray(business.vehicleTypes)
      ? business.vehicleTypes.map((type) => VEHICLE_LABELS[type] || type)
      : []),
  ];

  // Tiempo máximo de respuesta: se lee del perfil comercial real y se guarda
  // por RPC (RLS no permite UPDATE directo sobre commerce_profiles).
  const { extra, loading: loadingSla, error: slaError, notice: slaNotice, reload } = useModuleData(
    async () => {
      const commerce = await fetchCommerceIdForUser(user?.id);
      return {
        items: [],
        error: commerce.error,
        notice: commerce.notice,
        extra: {
          minutes: normalizeSlaMinutes(commerce.item?.max_response_minutes),
        },
      };
    },
    [user?.id]
  );

  const [selectedMinutes, setSelectedMinutes] = useState(15);
  const [savingSla, setSavingSla] = useState(false);
  const [slaMessage, setSlaMessage] = useState(null);

  useEffect(() => {
    if (extra?.minutes) setSelectedMinutes(extra.minutes);
  }, [extra?.minutes]);

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

          {loadingSla ? <p className="text-xs text-gray-600">Cargando tu tiempo de respuesta…</p> : null}
          {!loadingSla && (slaError || slaNotice) ? (
            <DataNotice tone={slaError ? 'error' : 'info'} className="mb-3">
              {slaError || slaNotice}
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
            disabled={savingSla || loadingSla}
            className="mt-3 w-full py-2.5 text-sm"
          >
            {savingSla ? 'Guardando…' : 'Guardar tiempo de respuesta'}
          </Button>
        </div>

        <h2 className="font-bold text-gray-800 text-lg px-2 pt-2">Nichos Activos</h2>
        <p className="text-sm text-gray-600 px-2 -mt-2 mb-2">Selecciona qué solicitudes quieres recibir</p>

        {niches.length === 0 ? (
          <EmptyModule
            icon={SlidersHorizontal}
            title="Sin nichos configurados"
            description="Añade tu categoría principal y los tipos de vehículo en tu perfil comercial para recibir solicitudes."
          >
            <button
              onClick={() => navigate('/edit-profile')}
              className="w-full py-2.5 rounded-xl bg-[#00EED0] text-gray-900 text-sm font-bold"
            >
              Ir a Editar Perfil
            </button>
          </EmptyModule>
        ) : (
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-white/30 overflow-hidden">
            <div className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#00EED0] text-gray-900">
                {business.mainCategory === 'taller' ? (
                  <SlidersHorizontal className="w-6 h-6" />
                ) : (
                  <Car className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-gray-800">
                  {niches[0] || 'Categoría principal'}
                </h3>
                <p className="text-xs text-gray-600">Datos tomados de tu perfil comercial</p>
              </div>
            </div>

            {niches.length > 1 && (
              <div className="bg-[#E7E7E7]/80 p-4 border-t border-white/30">
                <div className="flex flex-wrap gap-2">
                  {niches.slice(1).map((niche) => (
                    <span
                      key={niche}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-[#00EED0]/20 border-[#00EED0]/30 text-[#4B227A] flex items-center gap-1.5"
                    >
                      {niche}
                      <Check className="w-3 h-3" />
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-gray-600 px-2">
          Para cambiar tus nichos actualiza la categoría y los tipos de vehículo desde
          «Editar Perfil». La edición directa de preferencias aún no está conectada al backend.
        </p>
      </div>

      <CommerceBottomNav />
    </div>
  );
}
