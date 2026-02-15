import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Clock, AlertTriangle, CheckCircle2, PackageCheck } from 'lucide-react';
import Button from '../../components/ui/Button';

export default function Chat() {
  const navigate = useNavigate();
  const { id } = useParams();
  const messagesEndRef = useRef(null);
  
  const [messages, setMessages] = useState([
    { id: 1, text: 'Hola, vi tu solicitud. Tengo el iPhone en Titanio listo para entrega.', sender: 'seller', time: '10:05 AM' },
    { id: 2, text: '¡Genial! ¿Aceptas transferencia?', sender: 'user', time: '10:06 AM' },
    { id: 3, text: 'Sí, claro. Y te incluyo una funda de regalo 🎁', sender: 'seller', time: '10:07 AM' },
  ]);
  const [inputText, setInputText] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 mins

  // Seller State
  const [sellerStep, setSellerStep] = useState('initial'); // initial, confirmed, shipped

  const handleSellerAction = () => {
    if (sellerStep === 'initial') {
      setSellerStep('confirmed');
    } else if (sellerStep === 'confirmed') {
      setSellerStep('shipped');
      // Send system message
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: 'El vendedor ha marcado el producto como enviado. 🚚',
        sender: 'system',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Timer side effects
  useEffect(() => {
    if (timeLeft === 120) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: 'Necesitas dar respuesta o este chat cerrará en 2 minutos',
        sender: 'system',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    const newMsg = {
      id: messages.length + 1,
      text: inputText,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages([...messages, newMsg]);
    setInputText('');

    // Simulate auto-reply
    setTimeout(() => {
        setMessages(prev => [...prev, {
            id: prev.length + 1,
            text: 'Perfecto, confirmemos el acuerdo.',
            sender: 'seller',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-dark" />
          </button>
          <div>
            <h1 className="font-bold text-dark">TechMaster</h1>
            <p className="text-xs text-green-500 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              En línea
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      {/* Agreement Card Fixed */}
      <div className="bg-yellow-50 border-b border-yellow-100 px-4 py-3 flex justify-between items-center sticky top-[60px] z-10">
        <div className="text-sm">
          <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Acuerdo propuesto</p>
          <p className="font-bold text-dark">$1,200 • Efectivo</p>
        </div>
        <div className="text-right">
            <span className="text-xs text-yellow-700 font-medium">Pendiente</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-4 pb-32 overflow-y-auto">
        <div className="flex justify-center mb-6">
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
            Seguridad: No compartas datos bancarios aquí
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col max-w-[80%] ${
                msg.sender === 'user' ? 'self-end items-end' : 
                msg.sender === 'system' ? 'self-center items-center max-w-full' : 
                'self-start items-start'
              }`}
            >
              {msg.sender === 'system' ? (
                <div className="bg-red-50 text-red-600 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 border border-red-100 my-2">
                  <AlertTriangle className="w-4 h-4" />
                  {msg.text}
                </div>
              ) : (
                <>
                  <div 
                    className={`px-4 py-3 rounded-2xl text-sm ${
                      msg.sender === 'user' 
                        ? 'bg-primary text-white rounded-br-none' 
                        : 'bg-white text-dark border border-gray-100 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 px-1">{msg.time}</span>
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating CTA - Seller Only */}
      {timeLeft > 0 && (
        <div className="fixed bottom-[80px] left-0 right-0 px-6 z-20 flex justify-center pointer-events-none">
          {sellerStep !== 'shipped' && (
            <Button 
              onClick={handleSellerAction}
              className={`shadow-xl ${
                sellerStep === 'initial' 
                  ? 'bg-green-600 hover:bg-green-700 shadow-green-200' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
              } pointer-events-auto animate-bounce-subtle`}
            >
              {sellerStep === 'initial' ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  VENTA EFECTIVA
                </>
              ) : (
                <>
                  <PackageCheck className="w-5 h-5" />
                  YA SALIÓ EL PRODUCTO
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white p-4 border-t border-gray-100 fixed bottom-0 left-0 right-0 max-w-md mx-auto z-20">
        <form onSubmit={handleSend} className="flex gap-2">
          <input 
            type="text" 
            placeholder={timeLeft > 0 ? "Escribe un mensaje..." : "El chat ha finalizado"}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all disabled:opacity-50 disabled:bg-gray-100"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={timeLeft === 0}
          />
          <button 
            type="submit" 
            className="bg-primary text-white p-3 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
            disabled={!inputText.trim() || timeLeft === 0}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
