import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function RecoverPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
        <h1 className="text-xl font-bold text-dark">Recuperar contraseña</h1>
      </header>

      {sent ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">¡Correo enviado!</h2>
          <p className="text-gray-500 mb-8">
            Hemos enviado las instrucciones para recuperar tu contraseña a <span className="font-medium text-dark">{email}</span>
          </p>
          <Button fullWidth variant="secondary" onClick={() => navigate('/login')}>
            Volver al inicio
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6">
          <p className="text-gray-500">
            Ingresa el correo electrónico asociado a tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
          </p>
          
          <Input 
            label="Correo electrónico" 
            type="email" 
            placeholder="hola@ejemplo.com" 
            icon={Mail}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <Button type="submit" fullWidth className="mt-4">
            ENVIAR INSTRUCCIONES
          </Button>
        </form>
      )}
    </div>
  );
}
