
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  User, 
  Plus, 
  Trash2, 
  CheckCircle2,
  Home,
  Briefcase,
  Heart
} from 'lucide-react';
import Button from '../../components/ui/Button';

// Actualización estética Junio 2026

export default function Addresses() {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([
    {
      id: 1,
      type: 'Casa',
      address: 'Calle Principal #123, Apto 4B',
      city: 'Santo Domingo',
      phone: '809-555-0123',
      contactName: 'Mamá (María)',
      isDefault: true
    }
  ]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'Casa',
    address: '',
    city: '',
    phone: '',
    contactName: ''
  });

  const handleAddAddress = (e) => {
    e.preventDefault();
    const newAddress = {
      ...formData,
      id: Date.now(),
      isDefault: addresses.length === 0
    };
    setAddresses([...addresses, newAddress]);
    setShowForm(false);
    setFormData({ type: 'Casa', address: '', city: '', phone: '', contactName: '' });
  };

  const removeAddress = (id) => {
    setAddresses(addresses.filter(addr => addr.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-10">
      <header className="bg-white/80 backdrop-blur-md px-4 py-4 border-b border-white/30 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Mis Direcciones</h1>
      </header>

      <div className="p-4">
        {!showForm ? (
          <>
            <div className="flex flex-col gap-4 mb-6">
              {addresses.map((addr) => (
                <div key={addr.id} className="bg-white/80 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-white/30 relative overflow-hidden group">
                  {addr.isDefault && (
                    <div className="absolute top-0 right-0 bg-[#00EED0] text-gray-900 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                      Principal
                    </div>
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className="bg-[#00EED0]/20 p-3 rounded-2xl border border-[#00EED0]/30">
                      {addr.type === 'Casa' ? <Home className="w-5 h-5 text-[#4B227A]" /> : 
                       addr.type === 'Trabajo' ? <Briefcase className="w-5 h-5 text-[#4B227A]" /> : 
                       <MapPin className="w-5 h-5 text-[#4B227A]" />}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 mb-1">{addr.type}</h3>
                      <p className="text-sm text-gray-600 mb-3">{addr.address}, {addr.city}</p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{addr.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Heart className="w-3.5 h-3.5" />
                          <span>Contacto: {addr.contactName}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/40 flex justify-end gap-3">
                    <button 
                      onClick={() => removeAddress(addr.id)}
                      className="text-[#4B227A] hover:text-[#4B227A]/80 p-2 hover:bg-[#4B227A]/10 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Button 
              fullWidth 
              variant="outline" 
              onClick={() => setShowForm(true)}
              className="border-dashed border-2 py-6 rounded-3xl text-[#00EED0] hover:bg-[#00EED0]/10 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Añadir Nueva Dirección
            </Button>
          </>
        ) : (
          <form onSubmit={handleAddAddress} className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] shadow-lg border border-white/30 animate-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-lg font-bold text-gray-800 mb-6">Nueva Dirección</h2>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 mb-2 block">Tipo de Lugar</label>
                <div className="flex gap-2">
                  {['Casa', 'Trabajo', 'Otro'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({...formData, type: t})}
                      className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${
                        formData.type === t ? 'bg-[#00EED0] text-gray-900 shadow-[0_0_10px_rgba(0,238,208,0.4)]' : 'bg-white/70 text-gray-600 hover:bg-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 block">Dirección Completa</label>
                <input 
                  required
                  type="text" 
                  placeholder="Calle, número, apto..."
                  className="w-full bg-white/70 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#00EED0]/30 transition-all text-gray-800"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 block">Ciudad</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ej: Santo Domingo"
                  className="w-full bg-white/70 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#00EED0]/30 transition-all text-gray-800"
                  value={formData.city}
                  onChange={e => setFormData({...formData, city: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 block">Teléfono</label>
                  <input 
                    required
                    type="tel" 
                    placeholder="809-000-0000"
                    className="w-full bg-white/70 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#00EED0]/30 transition-all text-gray-800"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 block">Contacto Extra</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Nombre/Parentesco"
                    className="w-full bg-white/70 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#00EED0]/30 transition-all text-gray-800"
                    value={formData.contactName}
                    onChange={e => setFormData({...formData, contactName: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 rounded-2xl py-4 border-[#0197AF]/30 text-[#0197AF]"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-2 rounded-2xl py-4"
              >
                Guardar Dirección
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

