import React, { useState, useEffect, useCallback } from 'react';
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
  Heart,
  Loader2,
  AlertCircle,
  Star,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

export default function Addresses() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    type: 'Casa',
    address: '',
    city: '',
    phone: '',
    contactName: '',
    isDefault: false,
  });

  const fetchAddresses = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setErrorMsg('');
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (e) {
      setErrorMsg(e.message || 'No se pudieron cargar las direcciones');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const resetForm = () => {
    setFormData({
      type: 'Casa',
      address: '',
      city: '',
      phone: '',
      contactName: '',
      isDefault: addresses.length === 0,
    });
    setEditingId(null);
  };

  const openNew = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (addr) => {
    setEditingId(addr.id);
    setFormData({
      type: addr.type,
      address: addr.address,
      city: addr.city,
      phone: addr.phone,
      contactName: addr.contact_name || '',
      isDefault: addr.is_default,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    try {
      setErrorMsg('');
      setSuccessMsg('');
      if (editingId) {
        const { error } = await supabase
          .from('addresses')
          .update({
            type: formData.type,
            address: formData.address,
            city: formData.city,
            phone: formData.phone,
            contact_name: formData.contactName || null,
            is_default: formData.isDefault,
          })
          .eq('id', editingId)
          .eq('user_id', user.id);
        if (error) throw error;
        setSuccessMsg('Dirección actualizada');
      } else {
        const count = addresses.length;
        const { error } = await supabase.from('addresses').insert({
          user_id: user.id,
          type: formData.type,
          address: formData.address,
          city: formData.city,
          phone: formData.phone,
          contact_name: formData.contactName || null,
          is_default: count === 0 ? true : formData.isDefault,
        });
        if (error) throw error;
        setSuccessMsg('Dirección añadida');
      }
      setShowForm(false);
      resetForm();
      await fetchAddresses();
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (e) {
      setErrorMsg(e.message || 'No se pudo guardar la dirección');
    }
  };

  const removeAddress = async (id) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      await fetchAddresses();
      setSuccessMsg('Dirección eliminada');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (e) {
      setErrorMsg(e.message || 'No se pudo eliminar la dirección');
    }
  };

  const makeDefault = async (id) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      await fetchAddresses();
    } catch (e) {
      setErrorMsg(e.message || 'No se pudo marcar como predeterminada');
    }
  };

  const TypeIcon = ({ type }) => {
    if (type === 'Casa') return <Home className="w-5 h-5 text-[#4B227A]" />;
    if (type === 'Trabajo') return <Briefcase className="w-5 h-5 text-[#4B227A]" />;
    return <MapPin className="w-5 h-5 text-[#4B227A]" />;
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
        {successMsg && (
          <div className="bg-[#00EED0]/15 border border-[#00EED0]/30 rounded-2xl px-4 py-3 mb-4 text-sm font-semibold text-[#4B227A] flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4 text-sm text-red-700 flex items-start gap-2 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        {!showForm ? (
          <>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 text-[#00EED0] animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-4 mb-6">
                {addresses.length === 0 ? (
                  <div className="bg-white/80 backdrop-blur-md rounded-3xl px-6 py-10 text-center border border-white/30 shadow-sm">
                    <div className="mx-auto w-14 h-14 bg-[#00EED0]/20 rounded-2xl flex items-center justify-center mb-4 border border-[#00EED0]/30">
                      <MapPin className="w-7 h-7 text-[#4B227A]" />
                    </div>
                    <h3 className="font-bold text-gray-800 mb-1">Sin direcciones</h3>
                    <p className="text-sm text-gray-600 mb-5">Agrega tu primera dirección para continuar.</p>
                    <Button onClick={openNew} className="w-full">
                      Añadir dirección
                    </Button>
                  </div>
                ) : (
                  addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="bg-white/80 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-white/30 relative overflow-hidden group"
                    >
                      {addr.is_default && (
                        <div className="absolute top-0 right-0 bg-[#00EED0] text-gray-900 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                          Principal
                        </div>
                      )}

                      <div className="flex items-start gap-4">
                        <div className="bg-[#00EED0]/20 p-3 rounded-2xl border border-[#00EED0]/30">
                          <TypeIcon type={addr.type} />
                        </div>

                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 mb-1">{addr.type}</h3>
                          <p className="text-sm text-gray-600 mb-3">
                            {addr.address}, {addr.city}
                          </p>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Phone className="w-3.5 h-3.5" />
                              <span>{addr.phone}</span>
                            </div>
                            {addr.contact_name && (
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Heart className="w-3.5 h-3.5" />
                                <span>Contacto: {addr.contact_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/40 flex flex-wrap items-center justify-end gap-2">
                        {!addr.is_default && (
                          <button
                            onClick={() => makeDefault(addr.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#0197AF] bg-[#0197AF]/10 border border-[#0197AF]/20 hover:bg-[#0197AF]/20 transition-colors"
                          >
                            <Star className="w-3.5 h-3.5" />
                            Principal
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(addr)}
                          className="p-2 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors"
                          title="Editar"
                        >
                          <User className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => removeAddress(addr.id)}
                          className="text-[#4B227A] hover:text-[#4B227A]/80 p-2 hover:bg-[#4B227A]/10 rounded-xl transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {!loading && addresses.length > 0 && (
              <Button
                fullWidth
                variant="outline"
                onClick={openNew}
                className="border-dashed border-2 py-6 rounded-3xl text-[#00EED0] hover:bg-[#00EED0]/10 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Añadir Nueva Dirección
              </Button>
            )}
          </>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] shadow-lg border border-white/30 animate-in slide-in-from-bottom-4 duration-300"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-6">
              {editingId ? 'Editar Dirección' : 'Nueva Dirección'}
            </h2>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 mb-2 block">
                  Tipo de Lugar
                </label>
                <div className="flex gap-2">
                  {['Casa', 'Trabajo', 'Otro'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: t })}
                      className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${
                        formData.type === t
                          ? 'bg-[#00EED0] text-gray-900 shadow-[0_0_10px_rgba(0,238,208,0.4)]'
                          : 'bg-white/70 text-gray-600 hover:bg-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 block">
                  Dirección Completa
                </label>
                <input
                  required
                  type="text"
                  placeholder="Calle, número, apto..."
                  className="w-full bg-white/70 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#00EED0]/30 transition-all text-gray-800"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 block">
                  Ciudad
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Santo Domingo"
                  className="w-full bg-white/70 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#00EED0]/30 transition-all text-gray-800"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 block">
                    Teléfono
                  </label>
                  <input
                    required
                    type="tel"
                    placeholder="809-000-0000"
                    className="w-full bg-white/70 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#00EED0]/30 transition-all text-gray-800"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1 block">
                    Contacto Extra
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre/Parentesco"
                    className="w-full bg-white/70 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#00EED0]/30 transition-all text-gray-800"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm text-gray-700 select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#00EED0]"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked, isDefault: e.target.checked })}
                />
                <span className="font-medium">Establecer como dirección principal</span>
              </label>
            </div>

            <div className="flex gap-3 mt-8">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-2xl py-4 border-[#0197AF]/30 text-[#0197AF]"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-2 rounded-2xl py-4">
                {editingId ? 'Actualizar' : 'Guardar Dirección'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
