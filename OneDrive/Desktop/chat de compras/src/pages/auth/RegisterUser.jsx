import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { User, Mail, Lock, ArrowLeft } from 'lucide-react';

export default function RegisterUser() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    terms: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate registration
    login('user');
  };

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
        <h1 className="text-2xl font-bold text-dark">Crear cuenta</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
        <Input 
          label="Nombre completo" 
          placeholder="Ej. Juan Pérez" 
          icon={User}
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
          required
        />
        <Input 
          label="Correo electrónico" 
          type="email" 
          placeholder="hola@ejemplo.com" 
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

        <div className="flex items-start gap-3 mt-2">
          <input 
            type="checkbox" 
            id="terms" 
            className="mt-1 w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
            checked={formData.terms}
            onChange={e => setFormData({...formData, terms: e.target.checked})}
            required
          />
          <label htmlFor="terms" className="text-sm text-gray-500 leading-tight">
            Acepto los <a href="#" className="text-primary font-medium">Términos y Condiciones</a> y la Política de Privacidad.
          </label>
        </div>

        <div className="mt-auto mb-4">
          <Button type="submit" fullWidth disabled={!formData.terms}>
            REGISTRARME
          </Button>
        </div>
      </form>
    </div>
  );
}
