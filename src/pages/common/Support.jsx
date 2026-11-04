import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle, MessageCircle, FileQuestion, ChevronRight, Mail } from 'lucide-react';
import Button from '../../components/ui/Button';

export default function Support() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    {
      question: '¿Cómo crear una solicitud de compra?',
      answer: 'Ve a la categoría que necesitas, pulsa "Solicitar" y completa los datos del repuesto o servicio. Los comercios cercanos te enviarán ofertas.'
    },
    {
      question: '¿Es seguro comprar en Chat de Compras?',
      answer: 'Las conversaciones quedan registradas y los comercios muestran calificaciones. Aun así, verifica los datos del vendedor antes de pagar.'
    },
    {
      question: '¿Cómo funcionan las calificaciones?',
      answer: 'Al cerrar una compra puedes valorar al comercio con estrellas y un comentario. Esas valoraciones forman su reputación dentro de la app.'
    },
    {
      question: 'Métodos de pago aceptados',
      answer: 'Por ahora el pago se acuerda directamente con el comercio. La pasarela de pagos estará disponible en una próxima versión.'
    }
  ];

  const goToFaqs = () => {
    document.getElementById('faqs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white px-4 py-4 border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
        <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
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
          <Button
            variant="secondary"
            fullWidth
            className="text-primary border-none"
            onClick={() => navigate('/chat/support')}
          >
            <MessageCircle className="w-4 h-4" />
            Chat con Soporte
          </Button>
        </div>

        <h3 id="faqs" className="font-bold text-dark mb-4 flex items-center gap-2 scroll-mt-20">
          <FileQuestion className="w-5 h-5 text-gray-400" />
          Preguntas Frecuentes
        </h3>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;

            return (
              <div key={faq.question} className="border-b border-gray-100 last:border-0">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm text-gray-700 font-medium">{faq.question}</span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </button>

                {isOpen && (
                  <p className="px-4 pb-4 text-sm text-gray-500 leading-relaxed">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <h3 className="font-bold text-dark mb-4">Otros canales</h3>
        <div className="flex gap-4">
          <a href="mailto:soporte@chatdecompras.com" className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-primary">
              <Mail className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-gray-600">Email</span>
          </a>
          <button
            onClick={goToFaqs}
            className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
              <HelpCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-gray-600">Centro Ayuda</span>
          </button>
        </div>
      </div>
    </div>
  );
}
