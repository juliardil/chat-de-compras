import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { ArrowLeft, Camera, X, Plus, Trash2, ChevronDown, Car, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const AUTOMOTIVE_FORM_FIELDS = [
  { name: 'category', label: 'Tipo de repuesto/accesorio', type: 'select', options: [
    'Motor', 'Frenos', 'Suspensión', 'Eléctrico',
    'Llantas y Neumáticos', 'Interior / Exterior',
    'Lubricantes y Fluidos', 'Taller Mecánico',
    'Accesorios Vehiculares', 'Audio y Sonido', 'Seguridad Vehicular'
  ]},
  { name: 'item', label: 'Producto específico', placeholder: 'Ej: Pastillas de freno, filtro de aceite, batería', type: 'text' },
  { name: 'vehicleType', label: 'Tipo de vehículo', type: 'select', options: ['Auto', 'Moto', 'Camioneta', 'Camión', 'Tractor', 'Otro'] },
  { name: 'vehicleBrand', label: 'Marca del vehículo', placeholder: 'Ej: Toyota, Ford, Honda', type: 'text' },
  { name: 'vehicleModel', label: 'Modelo del vehículo', placeholder: 'Ej: Corolla, Fiesta, Civic', type: 'text' },
  { name: 'yearFrom', label: 'Año inicial', type: 'number', placeholder: 'Ej: 2015' },
  { name: 'yearTo', label: 'Año final', type: 'number', placeholder: 'Ej: 2024' },
  { name: 'reference', label: 'Referencia o número de parte', placeholder: 'Ej: 04465-02060', type: 'text' },
  { name: 'brand', label: 'Marca del repuesto (opcional)', placeholder: 'Ej: Bosch, Monroe, Fram', type: 'text' },
  { name: 'condition', label: 'Condición', type: 'select', options: ['Nuevo', 'Usado', 'Indistinto'] },
  { name: 'quantity', label: 'Cantidad', type: 'number', placeholder: 'Ej: 1', defaultValue: '1' },
  { name: 'notes', label: 'Notas adicionales', type: 'textarea', placeholder: 'Detalles específicos, color, ubicación, etc.' }
];

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function RequestForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [products, setProducts] = useState([
    {
      id: 1,
      category: location.state?.system || '',
      item: '',
      vehicleType: '',
      vehicleBrand: '',
      vehicleModel: '',
      yearFrom: '',
      yearTo: '',
      reference: '',
      brand: '',
      condition: '',
      quantity: '1',
      notes: '',
      images: [],
    },
  ]);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const addProduct = () => {
    setProducts([
      ...products,
      {
        id: Date.now(),
        category: '',
        item: '',
        vehicleType: '',
        vehicleBrand: '',
        vehicleModel: '',
        yearFrom: '',
        yearTo: '',
        reference: '',
        brand: '',
        condition: '',
        quantity: '1',
        notes: '',
        images: [],
      },
    ]);
  };

  const removeProduct = (id) => {
    if (products.length > 1) {
      setProducts(products.filter((p) => p.id !== id));
    }
  };

  const updateProduct = (id, field, value) => {
    setProducts(products.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleImageUpload = async (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await fileToDataURL(file);
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, images: [...p.images, url] } : p))
    );
  };

  const removeImage = (prodId, imgIndex) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === prodId ? { ...p, images: p.images.filter((_, i) => i !== imgIndex) } : p
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.id) {
      setErrorMsg('Debes iniciar sesión para enviar una solicitud');
      return;
    }
    if (!products.length) {
      setErrorMsg('Agrega al menos un producto');
      return;
    }
    const hasMinimal = products.every(
      (p) => p.category && p.item && p.vehicleType && p.quantity && Number(p.quantity) > 0
    );
    if (!hasMinimal) {
      setErrorMsg('Todos los productos deben tener categoría, producto, tipo de vehículo y cantidad');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    setSuccess(false);
    try {
      const generalNotes = products
        .map((p, i) =>
          [
            `[Producto ${i + 1}]`,
            p.notes ? `Notas: ${p.notes}` : null,
          ]
            .filter(Boolean)
            .join(' ')
        )
        .join('\n');

      const { data: insertedReq, error: reqErr } = await supabase
        .from('requests')
        .insert({
          buyer_id: user.id,
          status: 'open',
          budget: null,
          notes: generalNotes || null,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();
      if (reqErr) throw reqErr;

      const items = products.map((p) => ({
        request_id: insertedReq.id,
        category: p.category || null,
        item: p.item || null,
        vehicle_type: p.vehicleType || null,
        vehicle_brand: p.vehicleBrand || null,
        vehicle_model: p.vehicleModel || null,
        year_from: p.yearFrom ? Number(p.yearFrom) : null,
        year_to: p.yearTo ? Number(p.yearTo) : null,
        reference: p.reference || null,
        brand: p.brand || null,
        condition: p.condition || null,
        quantity: Math.max(1, Number(p.quantity) || 1),
        notes: p.notes || null,
        images: p.images && p.images.length ? p.images : [],
      }));

      const { error: itemsErr } = await supabase.from('request_items').insert(items);
      if (itemsErr) throw itemsErr;

      setSuccess(true);
      setTimeout(() => navigate('/history', { replace: true }), 1600);
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || 'No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] flex flex-col">
      <header className="bg-white/80 backdrop-blur-md px-4 py-4 flex items-center gap-4 shadow-sm sticky top-0 z-10 border-b border-white/30">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Car className="w-5 h-5 text-[#00EED0]" />
            Solicitud Automotriz
          </h1>
          <p className="text-xs text-gray-600">Describe tu repuesto o accesorio</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-6">
        {success && (
          <div className="bg-[#00EED0]/20 border border-[#00EED0]/30 rounded-2xl p-4 flex items-center gap-3 text-[#4B227A] font-semibold text-sm shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-[#4B227A]" />
            ¡Solicitud enviada! Buscando comercios cercanos…
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 text-red-700 text-sm shadow-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-white/30 relative"
            >
              <div className="flex justify-between items-center mb-4 border-b border-white/40 pb-2">
                <h3 className="font-bold text-[#00EED0] flex items-center gap-2">
                  <span className="bg-[#00EED0]/20 text-[#4B227A] w-6 h-6 rounded-full flex items-center justify-center text-xs border border-[#00EED0]/30">
                    {index + 1}
                  </span>
                  Producto Automotriz
                </h3>
                {products.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeProduct(product.id)}
                    className="text-[#4B227A] hover:bg-[#4B227A]/10 p-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {AUTOMOTIVE_FORM_FIELDS.map((field) => (
                  <div key={field.name}>
                    {field.type === 'select' ? (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-800">{field.label}</label>
                        <div className="relative">
                          <select
                            value={product[field.name]}
                            onChange={(e) => updateProduct(product.id, field.name, e.target.value)}
                            className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 focus:border-[#00EED0] appearance-none cursor-pointer"
                          >
                            <option value="">Selecciona una opción</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-5 h-5 text-gray-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    ) : field.type === 'textarea' ? (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-800">{field.label}</label>
                        <textarea
                          className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00EED0]/30 focus:border-[#00EED0] transition-all placeholder:text-gray-600 min-h-[80px]"
                          placeholder={field.placeholder}
                          value={product[field.name]}
                          onChange={(e) => updateProduct(product.id, field.name, e.target.value)}
                        />
                      </div>
                    ) : (
                      <Input
                        label={field.label}
                        placeholder={field.placeholder}
                        type={field.type}
                        value={product[field.name]}
                        onChange={(e) => updateProduct(product.id, field.name, e.target.value)}
                      />
                    )}
                  </div>
                ))}

                <div className="flex flex-col gap-1.5 pt-2">
                  <label className="text-sm font-medium text-gray-800">Imágenes de referencia</label>
                  <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                    <label className="flex flex-col items-center justify-center w-20 h-20 bg-white/70 border-2 border-dashed border-[#0197AF]/30 rounded-xl cursor-pointer hover:bg-white/80 active:scale-95 transition-all flex-shrink-0">
                      <Camera className="w-5 h-5 text-[#0197AF] mb-1" />
                      <span className="text-[10px] text-gray-600">Foto</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(product.id, e)}
                      />
                    </label>

                    {product.images.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-white/30 group"
                      >
                        <img src={img} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(product.id, idx)}
                          className="absolute top-1 right-1 bg-[#4B227A]/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addProduct}
            className="w-full py-4 border-2 border-dashed border-[#00EED0]/30 rounded-2xl flex items-center justify-center gap-2 text-[#00EED0] font-bold hover:bg-[#00EED0]/10 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Agregar otro producto
          </button>
        </form>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-white/30 max-w-md mx-auto z-20">
        <Button
          fullWidth
          onClick={handleSubmit}
          className="shadow-lg shadow-[#00EED0]/30"
          disabled={busy}
        >
          {busy ? 'ENVIANDO…' : `👉 ENVIAR SOLICITUD AUTOMOTRIZ (${products.length})`}
        </Button>
      </div>
    </div>
  );
}
