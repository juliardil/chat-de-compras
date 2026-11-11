import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';
import { EmptyModule } from '../../components/ui/ModuleState';
import { NOTICES } from '../../data/appData';

// No existe todavía una tabla de notificaciones en el backend. Para no
// inventar actividad de la cuenta, la pantalla muestra un estado vacío real.
export default function Notifications() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <header className="px-4 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-4">
          <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-dark" />
          </button>
          <h1 className="text-xl font-bold text-dark">Notificaciones</h1>
        </div>
      </header>

      <div className="p-4">
        <EmptyModule
          icon={Bell}
          title="Sin notificaciones"
          description="Aquí aparecerán los avisos de tu cuenta cuando el módulo esté conectado."
          notice={NOTICES.notifications}
        />
      </div>
    </div>
  );
}
