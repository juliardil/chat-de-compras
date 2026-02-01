import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { ArrowLeft, Camera, Image as ImageIcon, X, Plus, Trash2, ChevronDown } from 'lucide-react';

const NICHE_CONFIG = {
  fashion: {
    title: 'Moda',
    fields: [
      { name: 'item', label: '¿Qué prenda o accesorio necesitas?', placeholder: 'Ej: Camiseta, jean, bolso', type: 'text' },
      { name: 'target', label: '¿Para hombre, mujer o niño?', type: 'select', options: ['Hombre', 'Mujer', 'Niño', 'Niña', 'Unisex'] },
      { name: 'size', label: '¿Talla o medida?', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Única', 'Personalizado'] },
      { name: 'color', label: '¿Color preferido?', placeholder: 'Ej: Negro, azul', type: 'text' },
      { name: 'occasion', label: '¿Para qué ocasión?', placeholder: 'Ej: Casual, fiesta, deporte', type: 'text' },
      { name: 'brand', label: 'Marca (Opcional)', placeholder: 'Ej: Zara, Nike, etc.', type: 'text' },
      { name: 'description', label: 'Descripción adicional', placeholder: 'Detalles específicos...', type: 'textarea' }
    ]
  },
  auto: {
    title: 'Automotriz',
    fields: [
      { name: 'brand', label: 'Marca', placeholder: 'Ej: Bosch, Brembo', type: 'text' },
      { name: 'item', label: '¿Qué repuesto o accesorio necesitas?', placeholder: 'Ej: Pastillas de freno', type: 'text' },
      { name: 'vehicleType', label: '¿Es para auto o moto?', type: 'select', options: ['Auto', 'Moto', 'Camioneta', 'Pesado', 'Otro'] },
      { name: 'vehicleBrand', label: 'Marca del vehículo', placeholder: 'Ej: Toyota', type: 'text' },
      { name: 'reference', label: 'Línea / referencia / modelo', placeholder: 'Ej: Corolla / OEM 04465', type: 'text' },
      { name: 'yearRange', label: 'Año del vehículo', type: 'year_range' }
    ]
  },
  tech: {
    title: 'Tecnología',
    fields: [
      { name: 'brand', label: 'Marca', placeholder: 'Ej: Apple, Samsung', type: 'text' },
      { name: 'item', label: '¿Qué producto tecnológico buscas?', placeholder: 'Ej: Laptop, celular, mouse', type: 'text' },
      { name: 'model', label: '¿Marca y modelo?', placeholder: 'Ej: Dell 7390, iPhone 13', type: 'text' },
      { name: 'condition', label: '¿Nuevo, usado o indistinto?', type: 'select', options: ['Nuevo', 'Usado', 'Indistinto'] },
      { name: 'specs', label: '¿Especificaciones necesarias?', placeholder: 'RAM, almacenamiento, tamaño...', type: 'textarea' },
      { name: 'usage', label: '¿Para qué uso lo necesitas?', type: 'select', options: ['Estudio', 'Trabajo', 'Gaming', 'Diseño', 'Uso diario'] }
    ]
  },
  default: {
    title: 'General',
    fields: [
      { name: 'item', label: '¿Qué estás buscando?', placeholder: 'Ej: Producto X', type: 'text' },
      { name: 'description', label: 'Detalles adicionales', placeholder: 'Describe lo que necesitas...', type: 'textarea' }
    ]
  }
};

export default function RequestForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const nicheKey = location.state?.niche || 'fashion'; // Default to fashion as per user context
  const config = NICHE_CONFIG[nicheKey] || NICHE_CONFIG.default;

  const [products, setProducts] = useState([
    { id: 1, item: '', target: '', size: '', color: '', occasion: '', brand: '', description: '', images: [] }
  ]);

  const addProduct = () => {
    setProducts([...products, { 
      id: Date.now(), 
      item: '', target: '', size: '', color: '', occasion: '', brand: '', description: '', images: [] 
    }]);
  };

  const removeProduct = (id) => {
    if (products.length > 1) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const updateProduct = (id, field, value) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleImageUpload = (id, e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setProducts(products.map(p => 
        p.id === id ? { ...p, images: [...p.images, url] } : p
      ));
    }
  };

  const removeImage = (prodId, imgIndex) => {
    setProducts(products.map(p => 
      p.id === prodId ? { ...p, images: p.images.filter((_, i) => i !== imgIndex) } : p
    ));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitting:', products);
    navigate('/responses');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white px-4 py-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-dark">Nueva Solicitud</h1>
          <p className="text-xs text-gray-500">Categoría: {config.title}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {products.map((product, index) => (
            <div key={product.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative">
              <div className="flex justify-between items-center mb-4 border-b border-gray-50 pb-2">
                <h3 className="font-bold text-primary flex items-center gap-2">
                  <span className="bg-blue-50 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">
                    {index + 1}
                  </span>
                  Producto
                </h3>
                {products.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeProduct(product.id)}
                    className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {config.fields.map((field) => (
                  <div key={field.name}>
                    {field.type === 'select' ? (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">{field.label}</label>
                        <div className="relative">
                          <select
                            value={product[field.name]}
                            onChange={(e) => updateProduct(product.id, field.name, e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
                          >
                            <option value="">Selecciona una opción</option>
                            {field.options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    ) : field.type === 'textarea' ? (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">{field.label}</label>
                        <textarea 
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-gray-400 min-h-[80px]"
                          placeholder={field.placeholder}
                          value={product[field.name]}
                          onChange={(e) => updateProduct(product.id, field.name, e.target.value)}
                        />
                      </div>
                    ) : field.type === 'year_range' ? (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">{field.label}</label>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-500 mb-0.5 block pl-1">Desde</label>
                            <Input 
                              placeholder="Ej: 2015"
                              type="number"
                              value={product[field.name + 'From']}
                              onChange={(e) => updateProduct(product.id, field.name + 'From', e.target.value)}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-500 mb-0.5 block pl-1">Hasta</label>
                            <Input 
                              placeholder="Ej: 2024"
                              type="number"
                              value={product[field.name + 'To']}
                              onChange={(e) => updateProduct(product.id, field.name + 'To', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Input 
                        label={field.label}
                        placeholder={field.placeholder}
                        value={product[field.name]}
                        onChange={(e) => updateProduct(product.id, field.name, e.target.value)}
                      />
                    )}
                  </div>
                ))}

                {/* Image Upload per product */}
                <div className="flex flex-col gap-1.5 pt-2">
                  <label className="text-sm font-medium text-gray-700">Imágenes de referencia</label>
                  <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                    <label className="flex flex-col items-center justify-center w-20 h-20 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-100 active:scale-95 transition-all flex-shrink-0">
                      <Camera className="w-5 h-5 text-gray-400 mb-1" />
                      <span className="text-[10px] text-gray-500">Foto</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(product.id, e)} />
                    </label>

                    {product.images.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200 group">
                        <img src={img} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => removeImage(product.id, idx)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="w-full py-4 border-2 border-dashed border-primary/30 rounded-2xl flex items-center justify-center gap-2 text-primary font-bold hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Agregar otro producto
          </button>
        </form>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 max-w-md mx-auto z-20">
        <Button fullWidth onClick={handleSubmit} className="shadow-lg shadow-blue-200">
          👉 ENVIAR SOLICITUD ({products.length})
        </Button>
      </div>
    </div>
  );
}
