import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import Logo from '../../components/Logo';

export default function Login() {
  const navigate = useNavigate();
  const { login, error: authError } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      await login(formData.email.trim(), formData.password);
    } catch (e) {
      setErrorMsg(e.message || 'No se pudo iniciar sesión. Revisa tus credenciales.');
    } finally {
      setBusy(false);
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

          {(errorMsg || authError) && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {errorMsg || authError}
            </div>
          )}

          <Button type="submit" fullWidth className="mt-4" disabled={busy}>
            {busy ? 'INGRESANDO...' : 'INICIAR SESIÓN'}
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
