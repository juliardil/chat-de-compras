

import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Clock, AlertTriangle, CheckCircle2, MapPin, User, Phone, X, PackageCheck, LifeBuoy, Star, Store } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SafeImage from '../../components/ui/SafeImage';
import { DataNotice, EmptyModule } from '../../components/ui/ModuleState';
import { useChat } from '../../context/chat-context';
import { formatCurrency } from '../../data/appData';

// Actualización estética Junio 2026

export default function Chat() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Consumir ChatContext - Junio 2026
  const {
    openChat,
    messages,
    inputText,
    setInputText,
    timeLeft,
    showShippingForm,
    setShowShippingForm,
    shippingData,
    setShippingData,
    messagesEndRef,
    formatTime,
    sendMessage,
    handleProductArrivedYes,
    handleProductArrivedNo,
    handleShippingSubmit,
    connected,
    chatError,
    shippingSent,
    receiptConfirmed,
    shippingSubmitting,
    receiptSending,
    orderInfo,
    counterpart
  } = useChat();

  useEffect(() => {
    openChat(id);
  }, [id, openChat]);

  const handleSend = (e) => {
    e.preventDefault();
    sendMessage('buyer');
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] flex flex-col">
      {/* Header con glassmorphism - Actualización estética Junio 2026 */}
      <header className="bg-white/70 backdrop-blur-md px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20 border-b border-white/30">
        <div className="flex items-center gap-3">
          <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/80 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
          <div className="w-10 h-10 rounded-full bg-[#4B227A]/10 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
            {counterpart?.avatarUrl ? (
              <SafeImage
                src={counterpart.avatarUrl}
                alt={`Foto de ${counterpart.name || 'el comercio'}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <Store className="w-5 h-5 text-[#4B227A]" aria-hidden="true" />
            )}
          </div>
          <div>
            <h1 className="font-bold text-gray-800">{counterpart?.name || 'Conversación'}</h1>
            <p className="text-xs text-[#006E7A] flex items-center gap-1">
              <span className="w-2 h-2 bg-[#00EED0] rounded-full"></span>
              {connected ? 'Conversación en tiempo real' : 'Mensajes guardados en este dispositivo'}
            </p>
          </div>
        </div>
        {connected ? (
          <div className="bg-[#00EED0]/20 text-[#006E7A] px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border border-[#00EED0]/40">
            <span className="w-2 h-2 bg-[#00EED0] rounded-full" />
            En vivo
          </div>
        ) : (
          <div className="bg-[#4B227A]/20 text-[#4B227A] px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border border-[#4B227A]/30">
            <Clock className="w-3 h-3" />
            {formatTime(timeLeft)}
          </div>
        )}
      </header>

      {/* Agreement Card Fixed con glassmorphism - Actualización estética Junio 2026 */}
      <div className="bg-gradient-to-r from-[#0197AF]/15 to-[#4B227A]/15 border-b border-white/30 px-4 py-3 flex justify-between items-center sticky top-[60px] z-10 backdrop-blur-md">
        <div className="text-sm">
          <p className="text-gray-600 text-xs uppercase font-bold tracking-wider">
            {orderInfo.id ? 'Pedido registrado' : 'Acuerdo propuesto'}
          </p>
          <p className="font-bold text-gray-800">
            {orderInfo.product || orderInfo.number || 'Sin oferta registrada'}
          </p>
          {orderInfo.itemBrands ? (
            <p className="text-xs font-semibold text-[#006E7A]">
              Marcas acordadas: {orderInfo.itemBrands}
            </p>
          ) : orderInfo.id && orderInfo.brand ? (
            <p className="text-xs font-semibold text-[#006E7A]">
              Marca acordada: {orderInfo.brand}
            </p>
          ) : null}
          {orderInfo.optionNote ? (
            <p className="text-[11px] text-gray-600 break-words">{orderInfo.optionNote}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-[#006E7A]">
            {orderInfo.total !== null
              ? formatCurrency(orderInfo.total, orderInfo.currency)
              : 'Pendiente'}
          </p>
          {orderInfo.number ? (
            <p className="text-[10px] text-gray-600 font-medium">{orderInfo.number}</p>
          ) : null}
        </div>
      </div>

      {/* Chat Area - Actualización estética Junio 2026 */}
      <div className="flex-1 p-4 pb-32 overflow-y-auto">
        <div className="flex justify-center mb-6">
          <span className="text-xs text-gray-600 bg-white/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/30">
            Seguridad: No compartas datos bancarios aquí
          </span>
        </div>

        <div className="mb-4">
          {chatError ? (
            <DataNotice tone="error">{chatError}</DataNotice>
          ) : (
            <DataNotice>
              {connected
                ? 'Los mensajes se envían al comercio y se reciben en tiempo real.'
                : 'Los mensajes se guardan solo en este dispositivo porque no hay backend configurado.'}
            </DataNotice>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {messages.length === 0 ? (
            <EmptyModule
              title="Sin mensajes"
              description="Todavía no hay mensajes en esta conversación. Escribe el primero abajo."
            />
          ) : null}
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col max-w-[80%] ${
                msg.sender === 'buyer' ? 'self-end items-end' : 
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
                    className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-line break-words ${
                      msg.sender === 'buyer' 
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

      {/* Floating CTA - Buyer Only con neon - Actualización estética Junio 2026 */}
      {timeLeft > 0 && (
        <div className="fixed bottom-[80px] left-0 right-0 px-6 z-20 flex justify-center pointer-events-none">
          <div className="flex flex-col w-full gap-2 pointer-events-auto">
            {!shippingSent && !receiptConfirmed ? (
              <Button 
                onClick={() => setShowShippingForm(true)}
                className="w-full shadow-[0_0_25px_rgba(0,238,208,0.5)] bg-[#00EED0] hover:bg-[#00EED0]/90 text-black pointer-events-auto animate-bounce-subtle"
              >
                <CheckCircle2 className="w-5 h-5" />
                Confirmar compra
              </Button>
            ) : null}

            {shippingSent && !receiptConfirmed ? (
              <>
                <Button 
                  onClick={handleProductArrivedYes}
                  disabled={receiptSending}
                  className="w-full shadow-[0_0_20px_rgba(0,238,208,0.4)] bg-[#00EED0] hover:bg-[#00EED0]/90 text-black justify-center"
                >
                  <PackageCheck className="w-5 h-5" />
                  {receiptSending ? 'Confirmando…' : 'Ya recibí el producto'}
                </Button>
                <Button 
                  onClick={() => handleProductArrivedNo(navigate)}
                  className="w-full bg-white/70 backdrop-blur-md text-[#4B227A] border border-[#4B227A]/30 hover:bg-white/90 justify-center shadow-lg"
                >
                  <LifeBuoy className="w-5 h-5" />
                  Contactar a soporte
                </Button>
              </>
            ) : null}

            {receiptConfirmed ? (
              <div className="w-full rounded-2xl bg-white/85 backdrop-blur-md border border-[#00EED0]/40 px-4 py-3 text-center shadow-lg">
                <p className="text-sm font-bold text-[#4B227A] flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#006E7A]" />
                  Recepción confirmada
                </p>
                {orderInfo.id ? (
                  <div className="mt-3">
                    <Button
                      onClick={() =>
                        navigate(`/closing/${id}`, {
                          state: { orderId: orderInfo.id, commerceId: orderInfo.commerceId },
                        })
                      }
                      className="w-full bg-[#00EED0] hover:bg-[#00EED0]/90 text-black justify-center shadow-[0_0_15px_rgba(0,238,208,0.35)]"
                    >
                      <Star className="w-4 h-4" />
                      Calificar compra
                    </Button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleProductArrivedNo(navigate)}
                  className="mt-2 text-xs font-semibold text-[#006E7A] hover:underline"
                >
                  ¿Algún problema? Contactar a soporte
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Shipping Form Modal con glassmorphism - Actualización estética Junio 2026 */}
      {showShippingForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white/85 backdrop-blur-md w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-10 duration-300 border border-white/30">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white/90 backdrop-blur-sm z-10 pb-2 border-b border-white/30">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <MapPin className="w-6 h-6 text-[#006E7A]" />
                Datos de Envío
              </h2>
              <button 
                aria-label="Cerrar datos de envío"
                onClick={() => setShowShippingForm(false)}
                className="p-2 hover:bg-white/70 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="mb-4">
              <DataNotice tone={connected ? 'info' : 'warning'}>
                {connected
                  ? 'Estos datos se envían al comercio como mensaje y registran tu pedido para que prepare el envío.'
                  : 'Sin backend configurado, los datos se guardan solo en este dispositivo.'}
              </DataNotice>
            </div>

            {chatError ? (
              <div className="mb-4">
                <DataNotice tone="error">{chatError}</DataNotice>
              </div>
            ) : null}

            <form onSubmit={handleShippingSubmit} className="space-y-4">
              <Input 
                label="Nombre del destinatario" 
                placeholder="Nombre completo"
                icon={User}
                required
                value={shippingData.name}
                onChange={e => setShippingData({...shippingData, name: e.target.value})}
              />
              
              <Input 
                label="Teléfono de contacto" 
                placeholder="Ej. 55 1234 5678"
                icon={Phone}
                type="tel"
                required
                value={shippingData.phone}
                onChange={e => setShippingData({...shippingData, phone: e.target.value})}
              />

              <div className="space-y-3 pt-2">
                <h3 className="font-semibold text-gray-800 text-sm">Dirección completa</h3>
                
                <Input 
                  placeholder="Calle y número"
                  required
                  value={shippingData.street}
                  onChange={e => setShippingData({...shippingData, street: e.target.value})}
                />
                
                <div className="grid grid-cols-2 gap-3">
                  <Input 
                    placeholder="Num. Interior"
                    value={shippingData.interior}
                    onChange={e => setShippingData({...shippingData, interior: e.target.value})}
                  />
                  <Input 
                    placeholder="Colonia / Barrio"
                    required
                    value={shippingData.neighborhood}
                    onChange={e => setShippingData({...shippingData, neighborhood: e.target.value})}
                  />
                </div>

                <Input 
                  placeholder="Ciudad"
                  required
                  value={shippingData.city}
                  onChange={e => setShippingData({...shippingData, city: e.target.value})}
                />
              </div>

              <div className="pt-2">
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Referencias (Opcional)</label>
                <textarea 
                  className="w-full bg-white/80 backdrop-blur-md border border-[#4B227A]/30 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0197AF]/20 focus:border-[#0197AF] transition-all resize-none"
                  rows="2"
                  placeholder="Ej. Casa blanca, portón negro..."
                  value={shippingData.references}
                  onChange={e => setShippingData({...shippingData, references: e.target.value})}
                />
              </div>

              <div className="pt-4 sticky bottom-0 bg-white/90 backdrop-blur-sm pb-2">
                <Button
                  fullWidth
                  type="submit"
                  size="lg"
                  disabled={shippingSubmitting}
                  className="bg-[#00EED0] hover:bg-[#00EED0]/90 text-black shadow-[0_0_20px_rgba(0,238,208,0.4)]"
                >
                  {shippingSubmitting ? 'ENVIANDO…' : 'ENVIAR DATOS AL COMERCIO'}
                </Button>
              </div>
            </form>
          </div>
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
            aria-label="Enviar mensaje"
            className="bg-[#00EED0] text-black p-3 rounded-xl hover:bg-[#00EED0]/90 transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(0,238,208,0.3)]"
            disabled={!inputText.trim() || timeLeft === 0}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
