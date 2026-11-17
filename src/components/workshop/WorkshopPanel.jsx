import React, { useState } from 'react';
import {
  BadgeCheck,
  BadgeDollarSign,
  Car,
  Check,
  ClipboardList,
  Pencil,
  Wrench,
} from 'lucide-react';
import Button from '../ui/Button';
import { DataNotice, LoadingModule } from '../ui/ModuleState';
import { useModuleData } from '../../data/useModuleData';
import {
  fetchMyWorkshop,
  saveWorkshop,
  WORKSHOP_SPECIALTIES,
} from '../../data/workshop';
import { useAuth } from '../../context/auth-context';
import SponsorImpact from '../community/SponsorImpact';

const inputClass =
  'w-full rounded-xl border border-[#4B227A]/20 bg-white/80 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20';

// Beneficios que se activan al registrar el taller verificado.
const BENEFITS = [
  { Icon: BadgeDollarSign, label: 'Tarifas mayoristas' },
  { Icon: ClipboardList, label: 'Recepción de trabajos de instalación' },
  { Icon: Car, label: 'Control por placa' },
];

// Tarjeta "Soy un Taller Mecánico / Negocio" del perfil comprador.
// Lectura y escritura pasan por las RPC aisladas del módulo de talleres.
export default function WorkshopPanel() {
  const { refreshWorkshopCapability } = useAuth() || {};
  const { items, loading, error, notice, reload } = useModuleData(fetchMyWorkshop, []);
  const workshop = items[0] || null;

  const [showForm, setShowForm] = useState(false);
  const [workshopName, setWorkshopName] = useState('');
  const [nitOrId, setNitOrId] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [specialties, setSpecialties] = useState([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const toggleSpecialty = (value) => {
    setSpecialties((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value]
    );
  };

  const openForm = () => {
    if (workshop) {
      setWorkshopName(workshop.workshop_name || '');
      setNitOrId(workshop.nit_or_id || '');
      setAddress(workshop.address || '');
      setPhone(workshop.phone || '');
      setSpecialties(Array.isArray(workshop.specialties) ? workshop.specialties : []);
    }
    setActionError(null);
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setActionError(null);
    try {
      const result = await saveWorkshop({
        workshopName,
        nitOrId,
        address,
        phone,
        specialties,
      });
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setShowForm(false);
      reload();
      // Puente Taller -> Empresa: refresca la capacidad de la sesión en cuanto
      // el registro se guarda (la verificación la concede el admin después).
      if (typeof refreshWorkshopCapability === 'function') void refreshWorkshopCapability();
    } catch (err) {
      setActionError(err?.message || 'No se pudo completar el registro.');
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
      <label className="block">
        <span className="text-xs font-semibold text-gray-700">Nombre del taller</span>
        <input
          className={`mt-1 ${inputClass}`}
          value={workshopName}
          onChange={(event) => setWorkshopName(event.target.value)}
          placeholder="Ej. Taller Mecánico La Esquina"
          maxLength={120}
          required
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-gray-700">NIT/Cédula</span>
        <input
          className={`mt-1 ${inputClass}`}
          value={nitOrId}
          onChange={(event) => setNitOrId(event.target.value)}
          placeholder="NIT o cédula del negocio"
          maxLength={40}
          required
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-gray-700">Dirección</span>
        <input
          className={`mt-1 ${inputClass}`}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Calle, número y colonia"
          maxLength={200}
          required
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-gray-700">Teléfono</span>
        <input
          className={`mt-1 ${inputClass}`}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Teléfono de contacto"
          maxLength={30}
          required
        />
      </label>

      <fieldset>
        <legend className="text-xs font-semibold text-gray-700">Especialidades</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {WORKSHOP_SPECIALTIES.map((specialty) => (
            <label
              key={specialty}
              className="flex items-center gap-2 rounded-lg border border-[#4B227A]/15 bg-white/70 px-2.5 py-2 text-xs font-medium text-gray-700"
            >
              <input
                type="checkbox"
                checked={specialties.includes(specialty)}
                onChange={() => toggleSpecialty(specialty)}
                className="h-3.5 w-3.5 rounded border-[#4B227A]/30 text-[#4B227A] focus:ring-[#0197AF]"
              />
              {specialty}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" fullWidth disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar mi Taller'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setShowForm(false);
            setActionError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );

  return (
    <section className="px-6 mt-8" aria-labelledby="workshop-panel-title">
      <div className="flex items-center gap-2 mb-4 ml-1">
        <Wrench className="w-4 h-4 text-[#4B227A]" aria-hidden="true" />
        <h3
          id="workshop-panel-title"
          className="text-sm font-bold text-gray-600 uppercase tracking-widest"
        >
          Soy un Taller Mecánico / Negocio
        </h3>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-sm overflow-hidden border border-white/30 p-4">
        {loading ? <LoadingModule label="Cargando tu taller…" /> : null}

        {!loading && actionError ? (
          <DataNotice tone="error" className="mb-3">
            {actionError}
          </DataNotice>
        ) : null}

        {!loading && workshop ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Tu negocio registrado
                </p>
                <h4 className="text-lg font-bold text-gray-800 break-words">
                  {workshop.workshop_name}
                </h4>
              </div>
              {workshop.is_verified ? (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-[11px] font-bold text-green-700">
                  <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" /> Taller Verificado
                </span>
              ) : null}
            </div>

            <div>
            <dl className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-[#4B227A]/15 bg-white/70 p-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  NIT/Cédula
                </dt>
                <dd className="text-sm font-semibold text-gray-800 break-words">
                  {workshop.nit_or_id}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Teléfono
                </dt>
                <dd className="text-sm font-semibold text-gray-800 break-words">
                  {workshop.phone}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Dirección
                </dt>
                <dd className="text-sm font-semibold text-gray-800 break-words">
                  {workshop.address}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Especialidades
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {Array.isArray(workshop.specialties) && workshop.specialties.length > 0 ? (
                    workshop.specialties.map((specialty) => (
                      <span
                        key={specialty}
                        className="rounded-md bg-[#4B227A]/10 px-2 py-0.5 text-[11px] font-semibold text-[#4B227A]"
                      >
                        {specialty}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">No indicadas</span>
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Beneficios activos
              </p>
              <ul className="mt-2 space-y-2">
                {BENEFITS.map(({ Icon, label }) => (
                  <li key={label} className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#0197AF]/10 text-[#006E7A]">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <Check className="h-3.5 w-3.5 shrink-0 text-green-600" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            {!showForm ? (
              <Button type="button" variant="secondary" fullWidth onClick={openForm} className="mt-4">
                <Pencil className="w-4 h-4" /> Actualizar datos del taller
              </Button>
            ) : (
              form
            )}
            </div>
          </div>
        ) : null}

        {!loading && !workshop ? (
          <div>
            <div className="rounded-2xl border border-dashed border-[#4B227A]/25 bg-white/70 px-5 py-6 text-center">
              <p className="mx-auto max-w-sm text-sm text-gray-600">
                Registra tu negocio para acceder a tarifas mayoristas, recibir trabajos de
                instalación y llevar el control por placa.
              </p>
              {error || notice ? (
                <DataNotice tone={error ? 'error' : 'info'} className="mx-auto mt-3 max-w-sm text-left">
                  {error || notice}
                </DataNotice>
              ) : null}
              {!showForm ? (
                <Button type="button" fullWidth onClick={openForm} className="mt-4 max-w-sm mx-auto">
                  <Wrench className="w-4 h-4" /> Registrar mi Taller
                </Button>
              ) : null}
            </div>
            {showForm ? form : null}
          </div>
        ) : null}
      </div>

      <SponsorImpact />
    </section>
  );
}
