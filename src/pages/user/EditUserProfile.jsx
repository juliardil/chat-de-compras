import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Calendar, Camera, CheckCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/auth-context';

// Edición del perfil personal conectada al backend:
//  * el correo viene de la cuenta (auth.users.email) y no se modifica aquí;
//  * nombre, teléfono y fecha de nacimiento se guardan en auth.users.profile
//    mediante updateProfile (InsForge) o en la sesión local (demo);
//  * al recargar, la sesión se rehidrata y el formulario muestra lo guardado.
export default function EditUserProfile() {
  const navigate = useNavigate();
  const { user, updateProfile, mode } = useAuth();
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    phone: user?.phone || '',
    birthDate: user?.birthDate || ''
  });
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await updateProfile({
        name: formData.fullName.trim(),
        phone: formData.phone.trim(),
        birth_date: formData.birthDate,
      });
      navigate('/profile-user', { state: { profileUpdated: true } });
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la información.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-10">
      <header className="bg-white/80 backdrop-blur-md px-4 py-4 border-b border-white/30 flex items-center gap-4 sticky top-0 z-10">
        <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Información Personal</h1>
      </header>

      <div className="p-6">
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#00EED0]/20 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
              {photo ? (
                <img src={photo} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-[#4B227A]" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Cambiar foto de perfil"
              className="absolute bottom-0 right-0 p-2 bg-[#00EED0] text-gray-800 rounded-full shadow-lg border-2 border-white hover:bg-[#00EED0]/90 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
          <p className="mt-2 text-xs font-bold text-[#006E7A] uppercase tracking-widest">Cambiar foto</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] shadow-sm border border-white/30 space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 block">Nombre Completo</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input 
                  type="text" 
                  className="w-full bg-white/70 border-none rounded-2xl p-4 pl-12 text-sm focus:ring-2 focus:ring-[#00EED0]/30 transition-all text-gray-800"
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 block">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input 
                  type="email" 
                  className="w-full bg-white/70 border-none rounded-2xl p-4 pl-12 text-sm focus:ring-2 focus:ring-[#00EED0]/30 transition-all text-gray-600"
                  value={user?.email || '—'}
                  disabled
                />
              </div>
              <p className="text-[10px] text-gray-600 ml-1 italic">El correo no puede ser modificado</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 block">Teléfono Móvil</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input 
                  type="tel" 
                  className="w-full bg-white/70 border-none rounded-2xl p-4 pl-12 text-sm focus:ring-2 focus:ring-[#00EED0]/30 transition-all text-gray-800"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 block">Fecha de Nacimiento</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input 
                  type="date" 
                  className="w-full bg-white/70 border-none rounded-2xl p-4 pl-12 text-sm focus:ring-2 focus:ring-[#00EED0]/30 transition-all text-gray-800"
                  value={formData.birthDate}
                  onChange={e => setFormData({...formData, birthDate: e.target.value})}
                />
              </div>
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              {error}
            </p>
          ) : null}

          {mode === 'demo' ? (
            <p className="text-xs text-gray-500 px-1">
              Modo demostración: los cambios se guardan solo en este navegador.
            </p>
          ) : null}

          <Button type="submit" fullWidth className="rounded-2xl py-4 shadow-lg shadow-[#00EED0]/30" disabled={busy}>
            <span className="inline-flex items-center gap-2">
              {busy ? 'GUARDANDO…' : <><CheckCircle className="w-4 h-4" /> GUARDAR CAMBIOS</>}
            </span>
          </Button>
        </form>
      </div>
    </div>
  );
}
