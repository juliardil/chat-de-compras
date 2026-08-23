
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Calendar, Camera } from 'lucide-react';
import Button from '../../components/ui/Button';

// Actualización estética Junio 2026

export default function EditUserProfile() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: 'Usuario Demo',
    email: 'usuario@ejemplo.com',
    phone: '809-555-0123',
    birthDate: '1995-05-15'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Aquí iría la lógica para guardar los cambios
    alert('Información personal actualizada correctamente');
    navigate('/profile-user');
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-10">
      <header className="bg-white/80 backdrop-blur-md px-4 py-4 border-b border-white/30 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Información Personal</h1>
      </header>

      <div className="p-6">
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#00EED0]/20 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
              <User className="w-12 h-12 text-[#4B227A]" />
            </div>
            <button className="absolute bottom-0 right-0 p-2 bg-[#00EED0] text-gray-800 rounded-full shadow-lg border-2 border-white hover:bg-[#00EED0]/90 transition-colors">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-xs font-bold text-[#00EED0] uppercase tracking-widest">Cambiar foto</p>
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
                  value={formData.email}
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

          <Button type="submit" fullWidth className="rounded-2xl py-4 shadow-lg shadow-[#00EED0]/30">
            Guardar Cambios
          </Button>
        </form>
      </div>
    </div>
  );
}

