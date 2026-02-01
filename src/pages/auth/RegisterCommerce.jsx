import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Store, FileText, Mail, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function RegisterCommerce() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    tradeName: '',
    legalName: '',
    email: '',
    password: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate registration
    login('commerce');
  };

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col">
      <header className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
        <h1 className="text-2xl font-bold text-dark">Alta de Comercio</h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input 
            label="Nombre Comercial" 
            placeholder="Ej. MegaTech" 
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

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-2">
            <h3 className="font-semibold text-primary mb-3">Beneficios Membresía PRO</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Acceso ilimitado a solicitudes
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Perfil verificado destacado
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Soporte prioritario 24/7
              </li>
            </ul>
          </div>

          <Button type="submit" fullWidth className="mt-4">
            REGISTRAR Y PAGAR
          </Button>
        </form>
      </div>
    </div>
  );
}
