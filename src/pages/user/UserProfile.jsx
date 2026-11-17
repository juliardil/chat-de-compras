import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  User, 
  MapPin, 
  Bell, 
  History,
  ShieldCheck, 
  LogOut, 
  ChevronRight,
  Menu,
  Camera,
  CheckCircle
} from 'lucide-react';
import UserBottomNav from '../../components/layout/UserBottomNav';
import CommunityPanel from '../../components/community/CommunityPanel';
import SafeImage from '../../components/ui/SafeImage';
import { useAuth } from '../../context/auth-context';
import { uploadProfilePhoto } from '../../data/appData';

const BUYER_PATH = '/categories';
const JOBS_PATH = '/workshop-jobs';

// Perfil del comprador. El nombre y el correo vienen de la sesión real
// (InsForge cuando está configurado; sesión local en modo demostración). No se
// muestran estadísticas de compras porque el módulo de pedidos todavía no está
// expuesto a la app principal.
export default function UserProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updateProfile, setViewMode } = useAuth();
  const [profileImage, setProfileImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileInputRef = useRef(null);
  const justUpdated = Boolean(location.state?.profileUpdated);

  const avatarSrc = profileImage || user?.avatarUrl || null;

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    // Permite volver a elegir el mismo archivo después de un error.
    e.target.value = '';
    if (!file) return;

    setPhotoError(null);
    setUploading(true);
    try {
      const result = await uploadProfilePhoto({ userId: user?.id, role: 'user', file });
      if (result.error) {
        setPhotoError(result.error);
        return;
      }

      await updateProfile({ avatar_url: result.url });
      setProfileImage(result.url);
    } catch (err) {
      setPhotoError(err?.message || 'No se pudo guardar la foto de perfil.');
    } finally {
      setUploading(false);
    }
  };

  const menuItems = [
    { 
      icon: User, 
      label: 'Información Personal', 
      path: '/edit-user-profile', 
      color: 'text-[#006E7A]', 
      bgColor: 'bg-[#0197AF]/10' 
    },
    { 
      icon: MapPin, 
      label: 'Mis Direcciones', 
      path: '/addresses', 
      color: 'text-[#4B227A]', 
      bgColor: 'bg-[#4B227A]/10' 
    },
    { 
      icon: Bell, 
      label: 'Notificaciones', 
      path: '/notifications', 
      color: 'text-[#006E7A]', 
      bgColor: 'bg-[#00EED0]/20' 
    },
    { 
      icon: History, 
      label: 'Historial', 
      path: '/history', 
      color: 'text-[#006E7A]', 
      bgColor: 'bg-[#0197AF]/10' 
    },
    { 
      icon: ShieldCheck, 
      label: 'Seguridad', 
      path: '/change-password', 
      color: 'text-gray-600', 
      bgColor: 'bg-white/70' 
    }
  ];

  const changeView = (path, mode) => {
    if (typeof setViewMode === 'function') setViewMode(mode);
    setSettingsOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setSettingsOpen(false);
    logout();
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-24">
      {/* Header / Profile Info. El acceso a ajustes vive arriba para no exigir scroll. */}
      <header
        aria-label="Encabezado del perfil"
        className="relative z-10 bg-white/80 backdrop-blur-md px-6 pt-12 pb-8 rounded-b-[32px] shadow-sm border-b border-white/30"
      >
        <div className="relative z-20 flex items-start justify-end">
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
            aria-controls="account-settings-menu"
            aria-label="Menú"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#4B227A]/20 bg-white/90 text-[#4B227A] shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0197AF]/40"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          {settingsOpen ? (
            <div
              id="account-settings-menu"
              className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-white/40 bg-white/95 shadow-xl backdrop-blur-md"
            >
              {menuItems.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    navigate(item.path);
                  }}
                  className={`w-full flex items-center justify-between p-3 text-left transition hover:bg-[#4B227A]/5 ${
                    index !== menuItems.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`${item.bgColor} p-2 rounded-xl border border-white/30`}>
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </span>
                    <span className="font-semibold text-gray-800 text-sm">{item.label}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-gray-500" />
                </button>
              ))}

              <div className="border-t border-slate-200 bg-[#E7E7E7]/40 px-3 py-3">
                <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Cambiar de vista
                </p>
                <nav aria-label="Cambiar de vista" className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-current={location.pathname === JOBS_PATH ? undefined : 'page'}
                    onClick={() => changeView(BUYER_PATH, 'buyer')}
                    className={`rounded-xl px-2 py-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0197AF]/40 ${
                      location.pathname === JOBS_PATH
                        ? 'text-[#4B227A] hover:bg-[#4B227A]/10'
                        : 'bg-[#4B227A] text-white shadow'
                    }`}
                  >
                    🛒 Compras
                  </button>
                  <button
                    type="button"
                    aria-current={location.pathname === JOBS_PATH ? 'page' : undefined}
                    onClick={() => changeView(JOBS_PATH, 'business')}
                    className={`rounded-xl px-2 py-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0197AF]/40 ${
                      location.pathname === JOBS_PATH
                        ? 'bg-[#4B227A] text-white shadow'
                        : 'text-[#4B227A] hover:bg-[#4B227A]/10'
                    }`}
                  >
                    🔧 Panel de Trabajo
                  </button>
                </nav>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 border-t border-slate-200 px-4 py-3 text-left text-sm font-bold text-[#4B227A] transition hover:bg-[#4B227A]/5"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Cerrar Sesión
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#4B227A]/10 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
              {avatarSrc ? (
                <SafeImage
                  src={avatarSrc}
                  alt={`Foto de perfil de ${user?.name || 'usuario'}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-[#4B227A]" />
              )}
            </div>
            <button 
              aria-label="Cambiar foto de perfil"
              onClick={handleImageClick}
              disabled={uploading}
              className="absolute bottom-0 right-0 p-2 bg-[#00EED0] text-gray-900 rounded-full shadow-lg shadow-[#00EED0]/40 border-2 border-white hover:bg-[#00EED0]/90 transition-colors disabled:opacity-60"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
          {uploading ? (
            <p className="mt-3 text-xs font-semibold text-[#006E7A]">Subiendo foto…</p>
          ) : null}
          {photoError ? (
            <p role="alert" className="mt-3 max-w-xs text-center text-xs font-medium text-red-700">
              {photoError}
            </p>
          ) : null}
          <h2 className="mt-4 text-xl font-bold text-gray-800">{user?.name || 'Usuario'}</h2>
          <p className="text-gray-600 text-sm">{user?.email || '—'}</p>

          {justUpdated ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-semibold text-green-700">
              <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Información actualizada
            </p>
          ) : null}
        </div>
      </header>

      {/* Comunidad / Club del comprador (módulo aislado) */}
      <CommunityPanel />

      <UserBottomNav />
    </div>
  );
}
