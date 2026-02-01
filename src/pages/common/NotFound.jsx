import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-10 h-10 text-red-500" />
      </div>
      
      <h1 className="text-2xl font-bold text-dark mb-2">Página no encontrada</h1>
      <p className="text-gray-500 mb-8 max-w-[250px]">
        Lo sentimos, la página que buscas no existe o ha sido movida.
      </p>

      <Button onClick={() => navigate('/')}>
        Volver al Inicio
      </Button>
    </div>
  );
}
