
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, CheckCircle, Eye, EyeOff } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

// Actualización estética Junio 2026

export default function ChangePassword() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate password change
    setTimeout(() => {
      setSuccess(true);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] p-6 flex flex-col">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Cambiar contraseña</h1>
      </header>

      {success ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 bg-[#00EED0]/20 rounded-full flex items-center justify-center mb-6 border border-[#00EED0]/30">
            <CheckCircle className="w-8 h-8 text-[#4B227A]" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">¡Contraseña actualizada!</h2>
          <p className="text-gray-600 mb-8">
            Tu contraseña ha sido modificada exitosamente.
          </p>
          <Button fullWidth onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
          <Input 
            label="Contraseña actual" 
            type={showPassword ? "text" : "password"}
            name="currentPassword"
            placeholder="••••••••" 
            icon={Lock}
            value={formData.currentPassword}
            onChange={handleChange}
            required
          />
          
          <Input 
            label="Nueva contraseña" 
            type={showPassword ? "text" : "password"}
            name="newPassword"
            placeholder="••••••••" 
            icon={Lock}
            value={formData.newPassword}
            onChange={handleChange}
            required
          />

          <Input 
            label="Confirmar nueva contraseña" 
            type={showPassword ? "text" : "password"}
            name="confirmPassword"
            placeholder="••••••••" 
            icon={Lock}
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />

          <button 
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#4B227A] self-start mt-2"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
          </button>

          <div className="mt-auto">
            <Button type="submit" fullWidth>
              ACTUALIZAR CONTRASEÑA
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

