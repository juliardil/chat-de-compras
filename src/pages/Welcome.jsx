import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Button from '../components/ui/Button';
import { ShoppingBag, Store } from 'lucide-react';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col p-6 relative">
       {/* Decorative background */}
       <div className="absolute top-0 right-0 w-full h-1/2 bg-gradient-to-b from-blue-50 to-transparent -z-10" />

      <div className="flex-1 flex flex-col items-center justify-center gap-6 mt-10">
        <Logo size="lg" />
        <p className="text-gray-500 text-center max-w-[250px] text-lg">
          Conectamos tus deseos con los mejores comercios en minutos.
        </p>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        <div className="space-y-3">
          <Button 
            fullWidth 
            onClick={() => navigate('/register-user')}
            className="shadow-blue-200 shadow-lg"
          >
            <ShoppingBag className="w-5 h-5" />
            SOY USUARIO
          </Button>
          
          <Button 
            fullWidth 
            variant="secondary"
            onClick={() => navigate('/register-commerce')}
          >
            <Store className="w-5 h-5" />
            SOY COMERCIO
          </Button>
        </div>

        <div className="text-center mt-4">
          <span className="text-gray-400 text-sm">¿Ya tienes cuenta? </span>
          <button 
            onClick={() => navigate('/login')}
            className="text-primary font-semibold text-sm hover:underline"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
