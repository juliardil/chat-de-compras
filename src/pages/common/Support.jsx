import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle, MessageCircle, FileQuestion, ChevronRight, Mail } from 'lucide-react';
import Button from '../../components/ui/Button';

export default function Support() {
  const navigate = useNavigate();

  const faqs = [
    '¿Cómo crear una solicitud de compra?',
    '¿Es seguro comprar en Chat Express?',
    '¿Cómo funcionan las calificaciones?',
    'Métodos de pago aceptados'
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white px-4 py-4 border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
        <h1 className="text-xl font-bold text-dark">Ayuda y Soporte</h1>
      </header>

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="bg-primary rounded-2xl p-6 text-white mb-8 shadow-lg shadow-blue-200">
          <h2 className="text-xl font-bold mb-2">¿Necesitas ayuda?</h2>
          <p className="text-blue-100 text-sm mb-4">
            Nuestro equipo de soporte está disponible 24/7 para resolver tus dudas.
          </p>
          <Button variant="secondary" fullWidth className="text-primary border-none">
            <MessageCircle className="w-4 h-4" />
            Chat con Soporte
          </Button>
        </div>

        <h3 className="font-bold text-dark mb-4 flex items-center gap-2">
          <FileQuestion className="w-5 h-5 text-gray-400" />
          Preguntas Frecuentes
        </h3>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          {faqs.map((faq, idx) => (
            <button 
              key={idx}
              className="w-full text-left p-4 border-b border-gray-100 last:border-0 flex justify-between items-center hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm text-gray-700 font-medium">{faq}</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}
        </div>

        <h3 className="font-bold text-dark mb-4">Otros canales</h3>
        <div className="flex gap-4">
          <a href="mailto:soporte@chatexpress.com" className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-primary">
              <Mail className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-gray-600">Email</span>
          </a>
          <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
              <HelpCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-gray-600">Centro Ayuda</span>
          </div>
        </div>
      </div>
    </div>
  );
}
