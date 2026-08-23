

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Clock, AlertTriangle, CheckCircle2, PackageCheck, History, Star, MessageCircle, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useChat } from '../../context/ChatContext';
import { ChatProvider } from '../../context/ChatContext';

// Actualización estética Junio 2026

// Componente envuelto en ChatProvider - Junio 2026
const ChatContent = () => {
  const navigate = useNavigate();
  
  // Consumir ChatContext - Junio 2026
  const {
    messages,
    inputText,
    setInputText,
    timeLeft,
    showHistory,
    setShowHistory,
    sellerStep,
    buyerHistory,
    messagesEndRef,
    formatTime,
    sendMessage,
    handleSellerAction
  } = useChat();

  const handleSend = (e) => {
    e.preventDefault();
    sendMessage('seller', 'buyer'); // Enviar como vendedor, recibir respuesta de comprador
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] flex flex-col">
      {/* Header con glassmorphism - Actualización estética Junio 2026 */}
      <header className="bg-white/70 backdrop-blur-md px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20 border-b border-white/30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/80 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
          <div>
            <h1 className="font-bold text-gray-800">Juan P.</h1>
            <p className="text-xs text-[#00EED0] flex items-center gap-1">
              <span className="w-2 h-2 bg-[#00EED0] rounded-full"></span>
              En línea
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#0197AF]/20 to-[#4B227A]/20 text-[#4B227A] rounded-full text-xs font-bold hover:bg-white/80 transition-colors border border-[#4B227A]/30"
          >
            <History className="w-3.5 h-3.5" />
            Historial
          </button>
          <div className="bg-[#4B227A]/20 text-[#4B227A] px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border border-[#4B227A]/30">
            <Clock className="w-3 h-3" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      {/* Agreement Card Fixed con glassmorphism - Actualización estética Junio 2026 */}
      <div className="bg-gradient-to-r from-[#0197AF]/15 to-[#4B227A]/15 border-b border-white/30 px-4 py-3 flex justify-between items-center sticky top-[60px] z-10 backdrop-blur-md">
        <div className="text-sm">
          <p className="text-gray-600 text-xs uppercase font-bold tracking-wider">Acuerdo propuesto</p>
          <p className="font-bold text-gray-800">$1,200 • Efectivo</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-[#0197AF] font-medium">Pendiente</span>
        </div>
      </div>

      {/* Chat Area - Actualización estética Junio 2026 */}
      <div className="flex-1 p-4 pb-32 overflow-y-auto">
        <div className="flex justify-center mb-6">
          <span className="text-xs text-gray-600 bg-white/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/30">
            Seguridad: No compartas datos bancarios aquí
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col max-w-[80%] ${
                msg.sender === 'seller' ? 'self-end items-end' : 
                msg.sender === 'system' ? 'self-center items-center max-w-full' : 
                'self-start items-start'
              }`}
            >
              {msg.sender === 'system' ? (
                <div className="bg-[#4B227A]/20 text-[#4B227A] px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 border border-[#4B227A]/30 my-2 backdrop-blur-md">
                  <AlertTriangle className="w-4 h-4" />
                  {msg.text}
                </div>
              ) : (
                <>
                  <div 
                    className={`px-4 py-3 rounded-2xl text-sm ${
                      msg.sender === 'seller' 
                        ? 'bg-gradient-to-r from-[#00EED0] to-[#0197AF] text-black rounded-br-none shadow-[0_0_15px_rgba(0,238,208,0.3)]' 
                        : 'bg-white/80 backdrop-blur-md text-gray-800 border border-white/30 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-gray-600 mt-1 px-1">{msg.time}</span>
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating CTA - Seller Only con neon - Actualización estética Junio 2026 */}
      {timeLeft > 0 && (
        <div className="fixed bottom-[80px] left-0 right-0 px-6 z-20 flex justify-center pointer-events-none">
          {sellerStep !== 'shipped' && (
            <Button 
              onClick={handleSellerAction}
              className={`shadow-[0_0_25px_rgba(0,238,208,0.5)] ${
                sellerStep === 'initial' 
                  ? 'bg-[#00EED0] hover:bg-[#00EED0]/90 text-black' 
                  : 'bg-gradient-to-r from-[#0197AF] to-[#4B227A] hover:opacity-90 text-white'
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

      {/* Input Area con glassmorphism - Actualización estética Junio 2026 */}
      <div className="bg-white/70 backdrop-blur-md p-4 border-t border-white/30 fixed bottom-0 left-0 right-0 max-w-md mx-auto z-20">
        <form onSubmit={handleSend} className="flex gap-2">
          <input 
            type="text" 
            placeholder={timeLeft > 0 ? "Escribe un mensaje..." : "El chat ha finalizado"}
            className="flex-1 bg-white/80 backdrop-blur-md border border-[#4B227A]/30 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20 transition-all disabled:opacity-50 disabled:bg-white/50"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={timeLeft === 0}
          />
          <button 
            type="submit" 
            className="bg-[#00EED0] text-black p-3 rounded-xl hover:bg-[#00EED0]/90 transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(0,238,208,0.3)]"
            disabled={!inputText.trim() || timeLeft === 0}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Buyer History Modal con glassmorphism - Actualización estética Junio 2026 */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white/85 backdrop-blur-md w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden border border-white/30">
            <button 
              onClick={() => setShowHistory(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/70 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>

            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-[#00EED0]/20 to-[#0197AF]/20 rounded-full flex items-center justify-center mb-3 border border-[#0197AF]/30">
                <History className="w-10 h-10 text-[#0197AF]" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Historial de Compras</h2>
              <p className="text-sm text-gray-600">Reputación de Juan P.</p>
            </div>

            <div className="flex gap-3 mb-6">
              <div className="flex-1 bg-gradient-to-br from-[#0197AF]/20 to-[#4B227A]/20 p-4 rounded-2xl flex flex-col items-center border border-[#0197AF]/30">
                <div className="flex items-center gap-1 text-[#4B227A] font-bold text-lg mb-1">
                  {buyerHistory.rating} <Star className="w-4 h-4 fill-current" />
                </div>
                <span className="text-[10px] text-[#0197AF] font-bold uppercase tracking-wider">Calificación</span>
              </div>
              <div className="flex-1 bg-gradient-to-br from-[#00EED0]/20 to-[#0197AF]/20 p-4 rounded-2xl flex flex-col items-center border border-[#00EED0]/30">
                <span className="text-[#4B227A] font-bold text-lg mb-1">{buyerHistory.totalPurchases}</span>
                <span className="text-[10px] text-[#00EED0] font-bold uppercase tracking-wider">Compras</span>
              </div>
            </div>

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> Comentarios
              </h3>
              {buyerHistory.reviews.map((rev) => (
                <div key={rev.id} className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/30">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-gray-800">{rev.seller}</span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < rev.stars ? 'text-[#00EED0] fill-current' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mb-2 italic">"{rev.comment}"</p>
                  <span className="text-[10px] text-gray-500 block text-right">{rev.date}</span>
                </div>
              ))}
            </div>

            <Button fullWidth className="mt-6 rounded-2xl bg-[#00EED0] hover:bg-[#00EED0]/90 text-black shadow-[0_0_20px_rgba(0,238,208,0.4)]" onClick={() => setShowHistory(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrapper para ChatProvider - Junio 2026
export default function Chat() {
  return (
    <ChatProvider>
      <ChatContent />
    </ChatProvider>
  );
}
