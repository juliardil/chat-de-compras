import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import Logo from '../../components/Logo';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate login - logic to determine role based on email for demo
    if (formData.email.includes('shop')) {
      login('commerce');
    } else {
      login('user');
    }
  };

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
      </header>

      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-10 text-center">
          <Logo size="md" />
          <h2 className="text-xl font-semibold mt-6 text-gray-800">¡Bienvenido de nuevo!</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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

          <div className="flex justify-end">
            <Link to="/recover-password" class="text-sm text-primary font-medium hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <Button type="submit" fullWidth className="mt-4">
            INICIAR SESIÓN
          </Button>
        </form>
      </div>
      
      <div className="mt-auto py-4 text-center">
        <p className="text-gray-500 text-sm">
          ¿No tienes cuenta? <Link to="/welcome" className="text-primary font-bold">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}
