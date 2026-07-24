import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Store, FileText, Mail, Lock, ArrowLeft, CheckCircle2, Car, ChevronDown, Bike } from 'lucide-react';

export default function RegisterCommerce() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    tradeName: '',
    legalName: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    mainCategory: 'repuestos',
    inventorySystems: [],
    vehicleTypes: [],
    services: [],
    yearsExperience: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate registration - send data as JSON
    console.log('Datos del comercio registrados:', formData);
    login('commerce');
  };

  const handleVehicleTypeChange = (type) => {
    let newVehicleTypes = [...formData.vehicleTypes];
    if (newVehicleTypes.includes(type)) {
      newVehicleTypes = newVehicleTypes.filter(t => t !== type);
    } else {
      newVehicleTypes.push(type);
    }
    setFormData({...formData, vehicleTypes: newVehicleTypes});
  };

  const handleInventorySystemChange = (system) => {
    let newInventorySystems = [...formData.inventorySystems];
    if (newInventorySystems.includes(system)) {
      newInventorySystems = newInventorySystems.filter(s => s !== system);
    } else {
      newInventorySystems.push(system);
    }
    setFormData({...formData, inventorySystems: newInventorySystems});
  };

  const handleServiceChange = (service) => {
    let newServices = [...formData.services];
    if (newServices.includes(service)) {
      newServices = newServices.filter(s => s !== service);
    } else {
      newServices.push(service);
    }
    setFormData({...formData, services: newServices});
  };

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col">
      <header className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/welcome')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Alta de Comercio</h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Car className="w-5 h-5 text-[#00EED0]" />
            Datos del Negocio Automotriz
          </h3>
          
          <Input 
            label="Nombre Comercial" 
            placeholder="Ej. Repuestos Gómez" 
            icon={Store}
            value={formData.tradeName}
            onChange={e => setFormData({...formData, tradeName: e.target.value})}
            required
          />
          <Input 
            label="Razón Social / NIT" 
            placeholder="Ej. 12345678-9" 
            icon={FileText}
            value={formData.legalName}
            onChange={e => setFormData({...formData, legalName: e.target.value})}
            required
          />
          <Input 
            label="Teléfono de Contacto" 
            placeholder="Ej. 55-1234-5678" 
            icon={Store}
            value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
            required
          />
          <Input 
            label="Dirección del Local" 
            placeholder="Ej. Calle Principal #123, Ciudad" 
            value={formData.address}
            onChange={e => setFormData({...formData, address: e.target.value})}
            required
          />
          
          {/* Campo de Selección Múltiple: Tipos de Vehículos */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-800">
              ¿Vendes repuestos o servicios para? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-3">
              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                formData.vehicleTypes.includes('carros') 
                  ? 'border-[#00EED0] bg-[#00EED0]/10' 
                  : 'border-gray-200 hover:border-[#00EED0]/50 hover:bg-gray-50'
              }`}>
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                  formData.vehicleTypes.includes('carros') 
                    ? 'border-[#00EED0] bg-[#00EED0]' 
                    : 'border-gray-300'
                }`}>
                  {formData.vehicleTypes.includes('carros') && (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-gray-700" />
                  <span className="text-gray-800 font-medium">Repuestos para Carros</span>
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={formData.vehicleTypes.includes('carros')}
                  onChange={() => handleVehicleTypeChange('carros')}
                />
              </label>

              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                formData.vehicleTypes.includes('motos') 
                  ? 'border-[#0197AF] bg-[#0197AF]/10' 
                  : 'border-gray-200 hover:border-[#0197AF]/50 hover:bg-gray-50'
              }`}>
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                  formData.vehicleTypes.includes('motos') 
                    ? 'border-[#0197AF] bg-[#0197AF]' 
                    : 'border-gray-300'
                }`}>
                  {formData.vehicleTypes.includes('motos') && (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Bike className="w-5 h-5 text-gray-700" />
                  <span className="text-gray-800 font-medium">Repuestos para Motos</span>
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={formData.vehicleTypes.includes('motos')}
                  onChange={() => handleVehicleTypeChange('motos')}
                />
              </label>
            </div>
            {formData.vehicleTypes.length === 0 && (
              <p className="text-red-500 text-xs mt-1">Debes seleccionar al menos una opción</p>
            )}
          </div>
          
          {/* Campo de Selección: Categoría Principal */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-800">
              ¿En qué categoría te encuentras? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-3">
              {/* Opción preseleccionada: Repuestos Originales / Genéricos */}
              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                formData.mainCategory === 'repuestos' 
                  ? 'border-[#00EED0] bg-[#00EED0]/10' 
                  : 'border-gray-200 hover:border-[#00EED0]/50 hover:bg-gray-50'
              }`}>
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                  formData.mainCategory === 'repuestos' 
                    ? 'border-[#00EED0] bg-[#00EED0]' 
                    : 'border-gray-300'
                }`}>
                  {formData.mainCategory === 'repuestos' && (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                </div>
                <span className="text-gray-800 font-medium">Repuestos Originales / Genéricos</span>
                <input 
                  type="radio" 
                  className="hidden" 
                  checked={formData.mainCategory === 'repuestos'}
                  onChange={() => setFormData({...formData, mainCategory: 'repuestos'})}
                />
              </label>

              {/* Sección anidada: Sistemas de Inventario */}
              {formData.mainCategory === 'repuestos' && (
                <div className="pl-8 border-l-2 border-[#00EED0]/30 ml-3 space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    ¿Qué sistemas o líneas abarca tu inventario? <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {[
                      'Motor', 'Frenos', 'Suspensión', 'Eléctrico',
                      'Llantas y Neumáticos', 'Interior / Exterior',
                      'Lubricantes y Fluidos', 'Taller Mecánico',
                      'Accesorios Vehiculares', 'Audio y Sonido', 'Seguridad Vehicular'
                    ].map((system) => (
                      <label key={system} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        formData.inventorySystems.includes(system) 
                          ? 'border-[#0197AF] bg-[#0197AF]/5' 
                          : 'border-gray-100 hover:bg-gray-50'
                      }`}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          formData.inventorySystems.includes(system) 
                            ? 'border-[#0197AF] bg-[#0197AF]' 
                            : 'border-gray-300'
                        }`}>
                          {formData.inventorySystems.includes(system) && (
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-gray-700 text-sm">{system}</span>
                        <input 
                          type="checkbox" 
                          className="hidden" 
                          checked={formData.inventorySystems.includes(system)}
                          onChange={() => handleInventorySystemChange(system)}
                        />
                      </label>
                    ))}
                  </div>
                  {formData.inventorySystems.length === 0 && (
                    <p className="text-red-500 text-xs">Debes seleccionar al menos un sistema</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <Input 
            label="Años de Experiencia" 
            type="number" 
            placeholder="Ej. 5" 
            value={formData.yearsExperience}
            onChange={e => setFormData({...formData, yearsExperience: e.target.value})}
          />

          <h3 className="text-lg font-semibold text-gray-800 mt-2">Cuenta de Acceso</h3>
          <Input 
            label="Correo Administrador" 
            type="email" 
            placeholder="admin@empresa.com" 
            icon={Mail}
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
            required
          />
          <Input 
            label="Contraseña" 
            type="password" 
            placeholder="••••••••" 
            icon={Lock}
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
            required
          />

          <div className="bg-[#00EED0]/10 p-4 rounded-xl border border-[#00EED0]/20 mt-2">
            <h3 className="font-semibold text-[#4B227A] mb-3">Beneficios de Registrarte</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Recibe solicitudes de clientes automotrices en tu área
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Perfil destacado y categorización correcta
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Chat directo y seguimiento de servicios
              </li>
            </ul>
          </div>

          <Button 
            type="submit" 
            fullWidth 
            className="mt-4"
            disabled={
              formData.vehicleTypes.length === 0 || 
              !formData.mainCategory || 
              (formData.mainCategory === 'repuestos' && formData.inventorySystems.length === 0)
            }
          >
            REGISTRAR COMERCIO
          </Button>
        </form>
      </div>
    </div>
  );
}
