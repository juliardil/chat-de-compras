
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Phone, Globe, Instagram, Save, FileText, ChevronDown, MapPin, Camera } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SafeImage from '../../components/ui/SafeImage';
import WorkshopLogoUpload from '../../components/workshop/WorkshopLogoUpload';
import avatarComercio from '../../assets/avatar-comercio.svg';
import { useAuth } from '../../context/auth-context';
import { uploadProfilePhoto, validateProfilePhoto } from '../../data/appData';
import { fetchMyBusinessLogos } from '../../data/businessLogos';

// Edición del perfil comercial conectada al backend:
//  * descripción, horario, teléfono, Instagram y sitio web se guardan en
//    auth.users.profile.business (InsForge) o en la sesión local (demo),
//    fusionando con el resto de los datos del negocio (nombre comercial,
//    categoría, etc.) para no perderlos;
//  * al recargar, la sesión se rehidrata y el formulario muestra lo guardado.
export default function EditProfile() {
  const navigate = useNavigate();
  const { user, updateProfile, mode } = useAuth();
  const business = user?.business || {};

  const [isCustomSchedule, setIsCustomSchedule] = useState(false);
  const [formData, setFormData] = useState({
    description: business.description || '',
    schedule: business.schedule || '',
    phone: business.phone || '',
    instagram: business.instagram || '',
    website: business.website || '',
    latitude: business.latitude ?? '',
    longitude: business.longitude ?? ''
  });
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState(null);
  const [error, setError] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [businessLogo, setBusinessLogo] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchMyBusinessLogos().then(({ items }) => {
      if (active) setBusinessLogo(items?.[0]?.commerce_logo_url || null);
    });
    return () => {
      active = false;
    };
  }, []);

  const avatarPreview = photo || user?.avatarUrl || avatarComercio;

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validation = validateProfilePhoto(file);
    if (validation) {
      setError(validation);
      return;
    }

    setError(null);
    setPhotoFile(file);
    setPhoto(URL.createObjectURL(file));
  };

  const hasCoordinates =
    formData.latitude !== '' &&
    formData.latitude !== null &&
    formData.longitude !== '' &&
    formData.longitude !== null;

  // Captura la ubicación real del comercio desde el navegador. Se guarda junto
  // con el resto del perfil y app_ensure_profile la sincroniza a
  // commerce_profiles para que los compradores vean la distancia en km.
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage({
        tone: 'error',
        text: 'Este navegador no permite obtener tu ubicación.',
      });
      return;
    }

    setLocationMessage(null);
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((current) => ({
          ...current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        setLocationMessage({
          tone: 'info',
          text: 'Ubicación capturada. Guarda los cambios para publicarla.',
        });
        setLocating(false);
      },
      (geoError) => {
        setLocating(false);
        setLocationMessage({
          tone: 'error',
          text:
            geoError?.code === 1
              ? 'Permiso de ubicación denegado. Actívalo en tu navegador e inténtalo de nuevo.'
              : 'No se pudo obtener tu ubicación. Inténtalo de nuevo.',
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const toCoordinate = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const scheduleOptions = [
    'Lunes a Viernes: 9:00 AM - 6:00 PM',
    'Lunes a Sábado: 9:00 AM - 7:00 PM',
    'Lunes a Domingo: 8:00 AM - 8:00 PM',
    'Todos los días: 24 Horas',
    'Personalizado'
  ];

  // Si el horario guardado no coincide con ninguna opción predefinida,
  // se trata como personalizado.
  const isKnownSchedule = (value) => scheduleOptions.includes(value);
  const scheduleValue = isCustomSchedule || (formData.schedule && !isKnownSchedule(formData.schedule))
    ? 'Personalizado'
    : formData.schedule;

  const handleScheduleChange = (e) => {
    const value = e.target.value;
    if (value === 'Personalizado') {
      setIsCustomSchedule(true);
      setFormData({ ...formData, schedule: '' });
    } else {
      setIsCustomSchedule(false);
      setFormData({ ...formData, schedule: value });
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = async () => {
    setError(null);
    setBusy(true);

    try {
      let avatarUrl;
      if (photoFile) {
        const upload = await uploadProfilePhoto({
          userId: user?.id,
          role: 'commerce',
          file: photoFile,
        });
        if (upload.error) {
          throw new Error(upload.error);
        }
        avatarUrl = upload.url;
      }

      await updateProfile({
        business: {
          ...business,
          description: formData.description.trim(),
          schedule: formData.schedule.trim(),
          phone: formData.phone.trim(),
          instagram: formData.instagram.trim(),
          website: formData.website.trim(),
          latitude: toCoordinate(formData.latitude),
          longitude: toCoordinate(formData.longitude),
        },
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      });
      navigate('/profile', { state: { profileUpdated: true } });
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la información del negocio.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <header className="bg-white/80 backdrop-blur-md px-4 py-4 border-b border-white/30 flex items-center gap-4 sticky top-0 z-10">
        <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Editar Perfil</h1>
      </header>

      <div className="p-6 space-y-6">
        {/* Foto de perfil */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-xl shadow-sm border border-white/30">
          <div className="flex items-center gap-2 mb-4 text-[#4B227A] font-bold">
            <Camera className="w-5 h-5" />
            <h2>Foto de Perfil</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-md bg-[#00EED0]/10">
                <SafeImage
                  src={avatarPreview}
                  alt="Foto de perfil del comercio"
                  className="w-full h-full object-cover"
                  fallback={avatarComercio}
                />
              </div>
              <button
                type="button"
                aria-label="Cambiar foto de perfil"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 bg-gray-800 text-white rounded-full border-2 border-white shadow-sm hover:bg-gray-700 transition-colors"
              >
                <Camera className="w-3 h-3" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">
                {photoFile ? 'Nueva foto lista para guardar' : 'Cambiar foto'}
              </p>
              <p className="text-xs text-gray-500">JPG, PNG, WEBP o GIF · máx. 5 MB</p>
            </div>
          </div>
        </div>

        {/* Logo del negocio: mismo Storage y validaciones que «Cambiar foto» */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-xl shadow-sm border border-white/30">
          <div className="flex items-center gap-2 mb-2 text-[#4B227A] font-bold">
            <Camera className="w-5 h-5" />
            <h2>Logo del Negocio</h2>
          </div>
          <WorkshopLogoUpload
            userId={user?.id}
            scope="commerce"
            name={business.tradeName || user?.name || 'Mi Comercio'}
            logoUrl={businessLogo}
            onSaved={setBusinessLogo}
          />
        </div>

        {/* Descripción */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-xl shadow-sm border border-white/30">
          <div className="flex items-center gap-2 mb-4 text-[#006E7A] font-bold">
            <FileText className="w-5 h-5" />
            <h2>Descripción del Negocio</h2>
          </div>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            maxLength={200}
            className="w-full h-32 p-3 bg-white/70 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 text-sm text-gray-800 resize-none"
            placeholder="Describe tu negocio..."
          />
          <p className="text-xs text-gray-600 mt-2 text-right">{formData.description.length}/200 caracteres</p>
        </div>

        {/* Horario de Atención */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-xl shadow-sm border border-white/30">
          <div className="flex items-center gap-2 mb-4 text-[#4B227A] font-bold">
            <Clock className="w-5 h-5" />
            <h2>Horario de Atención</h2>
          </div>
          
          <div className="space-y-3">
            <div className="relative">
              <select
                onChange={handleScheduleChange}
                value={scheduleValue}
                className="w-full bg-white/70 border border-white/30 rounded-lg pl-4 pr-10 py-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 cursor-pointer text-gray-800"
              >
                {scheduleOptions.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
              <ChevronDown className="w-5 h-5 text-gray-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {(isCustomSchedule || (formData.schedule && !isKnownSchedule(formData.schedule))) && (
              <Input
                name="schedule"
                value={formData.schedule}
                onChange={handleChange}
                placeholder="Escribe tu horario personalizado..."
                autoFocus
              />
            )}
          </div>
        </div>

        {/* Contacto y Redes */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-xl shadow-sm border border-white/30">
          <div className="flex items-center gap-2 mb-4 text-[#006E7A] font-bold">
            <Globe className="w-5 h-5" />
            <h2>Contacto y Redes</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-600 font-bold mb-1 block">Teléfono / WhatsApp</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full bg-white/70 border border-white/30 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 text-gray-800"
                  placeholder="+57 300..."
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-bold mb-1 block">Instagram</label>
              <div className="relative">
                <Instagram className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  name="instagram"
                  value={formData.instagram}
                  onChange={handleChange}
                  className="w-full bg-white/70 border border-white/30 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 text-gray-800"
                  placeholder="@usuario"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-bold mb-1 block">Sitio Web</label>
              <div className="relative">
                <Globe className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full bg-white/70 border border-white/30 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 text-gray-800"
                  placeholder="www.ejemplo.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Ubicación del comercio */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-xl shadow-sm border border-white/30">
          <div className="flex items-center gap-2 mb-4 text-[#4B227A] font-bold">
            <MapPin className="w-5 h-5" />
            <h2>Ubicación del Comercio</h2>
          </div>

          <p className="text-xs text-gray-600 mb-3">
            {hasCoordinates
              ? `Coordenadas guardadas: ${Number(formData.latitude).toFixed(4)}, ${Number(formData.longitude).toFixed(4)}`
              : 'Sin ubicación guardada. Se usa para mostrar a los compradores la distancia en km.'}
          </p>

          <Button
            fullWidth
            type="button"
            variant="outline"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="py-3 flex items-center justify-center gap-2 border-[#0197AF]/30 text-[#006E7A]"
          >
            <MapPin className="w-4 h-4" />
            {locating
              ? 'OBTENIENDO…'
              : hasCoordinates
                ? 'ACTUALIZAR UBICACIÓN'
                : 'USAR MI UBICACIÓN ACTUAL'}
          </Button>

          {locationMessage ? (
            <p
              role={locationMessage.tone === 'error' ? 'alert' : 'status'}
              className={`mt-3 text-sm rounded-xl px-4 py-3 border ${
                locationMessage.tone === 'error'
                  ? 'text-red-700 bg-red-50 border-red-100'
                  : 'text-[#006E7A] bg-[#00EED0]/10 border-[#00EED0]/30'
              }`}
            >
              {locationMessage.text}
            </p>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </p>
        ) : null}

        {mode === 'demo' ? (
          <p className="text-xs text-gray-500 px-1">
            Modo demostración: los cambios se guardan solo en este navegador.
          </p>
        ) : null}

        <div className="pt-4">
          <Button fullWidth onClick={handleSave} disabled={busy} className="flex items-center justify-center gap-2">
            {busy ? 'GUARDANDO…' : <><Save className="w-5 h-5" /> GUARDAR CAMBIOS</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
