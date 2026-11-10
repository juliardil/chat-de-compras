
import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import { Star, Award, LogOut, Edit2, CheckCircle, Clock, Phone, Instagram, Globe, MapPin } from 'lucide-react';
import { useAuth } from '../../context/auth-context';
import Button from '../../components/ui/Button';
import SafeImage from '../../components/ui/SafeImage';
import avatarComercio from '../../assets/avatar-comercio.svg';

// Perfil del comercio. El nombre, la descripción y los datos de contacto
// provienen de la sesión real (auth.users.profile.business con InsForge;
// sesión local en modo demo). El rating, las ventas y la membresía solo
// existen en la demostración: los módulos de pedidos y planes de la app aún
// no están conectados al backend.
const CATEGORY_LABELS = {
  repuestos: 'Repuestos Originales / Genéricos',
  taller: 'Taller / Servicios',
};

const VEHICLE_LABELS = {
  car: 'Automotriz',
  bike: 'Motos',
};

export default function Profile() {
  const { user, logout, mode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const business = user?.business || {};
  const justUpdated = Boolean(location.state?.profileUpdated);
  const [profileImage, setProfileImage] = useState(avatarComercio);
  const [showMembershipNotice, setShowMembershipNotice] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setProfileImage(url);
    }
  };

  const commerceName = business.tradeName || user?.name || 'Mi Comercio';

  const niches = [
    ...(business.mainCategory ? [CATEGORY_LABELS[business.mainCategory] || business.mainCategory] : []),
    ...(Array.isArray(business.vehicleTypes)
      ? business.vehicleTypes.map((type) => VEHICLE_LABELS[type] || type)
      : []),
  ];

  const contactRows = [
    { icon: Clock, label: 'Horario', value: business.schedule },
    { icon: Phone, label: 'Teléfono / WhatsApp', value: business.phone },
    { icon: Instagram, label: 'Instagram', value: business.instagram },
    { icon: Globe, label: 'Sitio web', value: business.website },
    { icon: MapPin, label: 'Dirección', value: business.address },
  ].filter((row) => Boolean(row.value));

  const hasBusinessInfo =
    Boolean(business.description) || niches.length > 0 || contactRows.length > 0;

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <div className="bg-white/80 backdrop-blur-md pb-6 pt-10 px-6 rounded-b-[2rem] shadow-sm border-b border-white/30 relative">
        <button 
          aria-label="Cerrar sesión"
          onClick={logout} 
          className="absolute top-4 right-4 p-2 text-gray-600 hover:text-[#4B227A] hover:bg-[#4B227A]/10 rounded-full transition-colors"
        >
          <LogOut className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-[#00EED0] to-[#4B227A] mb-4 relative shadow-[0_0_20px_rgba(0,238,208,0.4)]">
            <SafeImage
              src={profileImage}
              alt="Foto de perfil del comercio"
              className="w-full h-full rounded-full object-cover border-4 border-white"
            />
            <button 
              aria-label="Cambiar foto de perfil"
              onClick={handleImageClick}
              className="absolute bottom-0 right-0 bg-gray-800 text-white p-1.5 rounded-full border-2 border-white shadow-sm hover:bg-gray-700 transition-colors"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-800 mb-1 text-center">{commerceName}</h1>
          <p className="text-gray-600 text-sm mb-2">{user?.email || '—'}</p>

          {justUpdated ? (
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-semibold text-green-700">
              <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Información actualizada
            </p>
          ) : null}

          {mode === 'demo' ? (
            <div className="flex items-center gap-6 mt-2">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 font-bold text-gray-800 text-lg">
                  4.8 <Star className="w-4 h-4 text-[#006E7A] fill-current" />
                </div>
                <span className="text-xs text-gray-600">Rating</span>
              </div>
              <div className="w-[1px] h-8 bg-white/40" />
              <div className="flex flex-col items-center">
                <div className="font-bold text-gray-800 text-lg">156</div>
                <span className="text-xs text-gray-600">Ventas</span>
              </div>
              <div className="w-[1px] h-8 bg-white/40" />
              <div className="flex flex-col items-center">
                <div className="font-bold text-[#006E7A] text-lg">PRO</div>
                <span className="text-xs text-gray-600">Nivel</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="p-6 flex flex-col gap-6">
        <div>
          <h2 className="font-bold text-gray-800 mb-4">Información del Negocio</h2>
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/30 p-4 space-y-4">
            {!hasBusinessInfo ? (
              <p className="text-sm text-gray-600 italic">
                Aún no has completado la información de tu negocio. Usa «Editar Perfil
                Comercial» para añadir descripción, horario y datos de contacto.
              </p>
            ) : null}

            {business.description ? (
              <div>
                <label className="text-xs text-gray-600 font-bold uppercase tracking-wider">Descripción</label>
                <p className="text-sm text-gray-700 mt-1">{business.description}</p>
              </div>
            ) : null}

            {niches.length > 0 ? (
              <>
                <div className="h-[1px] bg-white/40" />
                <div>
                  <label className="text-xs text-gray-600 font-bold uppercase tracking-wider">Nichos Activos</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {niches.map((niche) => (
                      <span
                        key={niche}
                        className="px-3 py-1 bg-[#0197AF]/10 text-[#006E7A] rounded-lg text-xs font-bold border border-[#0197AF]/20"
                      >
                        {niche}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {contactRows.length > 0 ? (
              <>
                <div className="h-[1px] bg-white/40" />
                <div className="space-y-3">
                  {contactRows.map((row) => (
                    <div key={row.label} className="flex items-center gap-3">
                      <div className="bg-[#0197AF]/10 border border-[#0197AF]/20 rounded-lg p-2">
                        <row.icon className="w-4 h-4 text-[#006E7A]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">{row.label}</p>
                        <p className="text-sm text-gray-700">{row.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <div className="h-[1px] bg-white/40" />

            <div>
              <label className="text-xs text-gray-600 font-bold uppercase tracking-wider">Membresía</label>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-r from-[#00EED0] to-[#0197AF] p-1.5 rounded-lg text-white">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">
                      {mode === 'demo' ? 'Plan Premium' : 'Sin plan activo'}
                    </p>
                    {mode === 'demo' ? (
                      <p className="text-xs text-gray-600">Renueva el 01/05/2027</p>
                    ) : (
                      <p className="text-xs text-gray-600">
                        Los planes y suscripciones aún no están disponibles.
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="py-1.5 px-3 text-xs h-auto border-[#0197AF]/30 text-[#006E7A]"
                  onClick={() => setShowMembershipNotice(true)}
                >
                  Gestionar
                </Button>
              </div>
              {showMembershipNotice && (
                <p className="text-[11px] text-[#006E7A] mt-2">
                  La gestión de membresía estará disponible próximamente.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={() => navigate('/edit-profile')}
            variant="outline"
            fullWidth
            className="rounded-xl border-[#4B227A]/30 text-[#4B227A] font-bold flex items-center justify-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Editar Perfil Comercial
          </Button>

          <button 
            onClick={logout}
            className="w-full bg-white/80 backdrop-blur-md border border-[#4B227A]/20 text-[#4B227A] font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#4B227A]/10 transition-colors shadow-sm"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </div>

      <CommerceBottomNav />
    </div>
  );
}
