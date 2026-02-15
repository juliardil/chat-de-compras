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
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white px-4 py-4 border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
        <h1 className="text-xl font-bold text-dark">Mis Direcciones</h1>
      </header>

      <div className="p-4">
        {!showForm ? (
          <>
            <div className="flex flex-col gap-4 mb-6">
              {addresses.map((addr) => (
                <div key={addr.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
                  {addr.isDefault && (
                    <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                      Principal
                    </div>
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-2xl">
                      {addr.type === 'Casa' ? <Home className="w-5 h-5 text-primary" /> : 
                       addr.type === 'Trabajo' ? <Briefcase className="w-5 h-5 text-primary" /> : 
                       <MapPin className="w-5 h-5 text-primary" />}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-bold text-dark mb-1">{addr.type}</h3>
                      <p className="text-sm text-gray-500 mb-3">{addr.address}, {addr.city}</p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{addr.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Heart className="w-3.5 h-3.5" />
                          <span>Contacto: {addr.contactName}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end gap-3">
                    <button 
                      onClick={() => removeAddress(addr.id)}
                      className="text-red-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-xl transition-colors"
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
              className="border-dashed border-2 py-6 rounded-3xl text-primary hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Añadir Nueva Dirección
            </Button>
          </>
        ) : (
          <form onSubmit={handleAddAddress} className="bg-white p-6 rounded-[32px] shadow-lg border border-gray-100 animate-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-lg font-bold text-dark mb-6">Nueva Dirección</h2>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Tipo de Lugar</label>
                <div className="flex gap-2">
                  {['Casa', 'Trabajo', 'Otro'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({...formData, type: t})}
                      className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${
                        formData.type === t ? 'bg-primary text-white shadow-md' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 block">Dirección Completa</label>
                <input 
                  required
                  type="text" 
                  placeholder="Calle, número, apto..."
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 block">Ciudad</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ej: Santo Domingo"
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                  value={formData.city}
                  onChange={e => setFormData({...formData, city: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 block">Teléfono</label>
                  <input 
                    required
                    type="tel" 
                    placeholder="809-000-0000"
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 block">Contacto Extra</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Nombre/Parentesco"
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-primary transition-all"
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
                className="flex-1 rounded-2xl py-4"
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
