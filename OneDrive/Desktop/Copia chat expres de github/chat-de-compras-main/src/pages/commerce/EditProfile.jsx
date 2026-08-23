
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Phone, Globe, Instagram, Save, FileText, ChevronDown } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

// Actualización estética Junio 2026

export default function EditProfile() {
  const navigate = useNavigate();
  const [isCustomSchedule, setIsCustomSchedule] = useState(false);
  const [formData, setFormData] = useState({
    description: 'Especialistas en tecnología Apple. Garantía oficial y los mejores precios del mercado. Envíos a todo el país.',
    schedule: 'Lunes a Sábado: 9:00 AM - 7:00 PM',
    phone: '+57 300 123 4567',
    instagram: '@techmaster_store',
    website: 'www.techmaster.com'
  });

  const scheduleOptions = [
    'Lunes a Viernes: 9:00 AM - 6:00 PM',
    'Lunes a Sábado: 9:00 AM - 7:00 PM',
    'Lunes a Domingo: 8:00 AM - 8:00 PM',
    'Todos los días: 24 Horas',
    'Personalizado'
  ];

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

  const handleSave = () => {
    // Aquí iría la lógica de guardado
    navigate('/profile');
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <header className="bg-white/80 backdrop-blur-md px-4 py-4 border-b border-white/30 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Editar Perfil</h1>
      </header>

      <div className="p-6 space-y-6">
        {/* Descripción */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-xl shadow-sm border border-white/30">
          <div className="flex items-center gap-2 mb-4 text-[#0197AF] font-bold">
            <FileText className="w-5 h-5" />
            <h2>Descripción del Negocio</h2>
          </div>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
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
                value={isCustomSchedule ? 'Personalizado' : formData.schedule}
                className="w-full bg-white/70 border border-white/30 rounded-lg pl-4 pr-10 py-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 cursor-pointer text-gray-800"
              >
                {scheduleOptions.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
              <ChevronDown className="w-5 h-5 text-gray-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {isCustomSchedule && (
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
          <div className="flex items-center gap-2 mb-4 text-[#0197AF] font-bold">
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

        <div className="pt-4">
          <Button fullWidth onClick={handleSave} className="flex items-center justify-center gap-2">
            <Save className="w-5 h-5" /> GUARDAR CAMBIOS
          </Button>
        </div>
      </div>
    </div>
  );
}

