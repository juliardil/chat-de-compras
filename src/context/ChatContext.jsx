
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

// Contexto creado: Junio 2026 - Centraliza la gestión de chats y mensajes
const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  // Junio 2026 - Datos mock iniciales para el chat
  const initialMessages = [
    { id: 1, text: 'Hola, vi tu solicitud. Tengo el iPhone en Titanio listo para entrega.', sender: 'seller', time: '10:05 AM' },
    { id: 2, text: '¡Genial! ¿Aceptas transferencia?', sender: 'buyer', time: '10:06 AM' },
    { id: 3, text: 'Sí, claro. Y te incluyo una funda de regalo 🎁', sender: 'seller', time: '10:07 AM' },
  ];

  const { id } = useParams();
  const messagesEndRef = useRef(null);
  
  // Estados centralizados - Junio 2026
  const [messages, setMessages] = useState(initialMessages);
  const [inputText, setInputText] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutos
  const [showHistory, setShowHistory] = useState(false);
  const [showDeliveryOptions, setShowDeliveryOptions] = useState(false);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [sellerStep, setSellerStep] = useState('initial'); // initial, confirmed, shipped

  // Junio 2026 - Historial mock del comprador (para vistas de comercio)
  const buyerHistory = {
    rating: 4.7,
    totalPurchases: 42,
    reviews: [
      { id: 1, seller: 'ElectroMundo', comment: 'Comprador excelente, pago rápido y sin complicaciones.', stars: 5, date: 'Hace 3 días' },
      { id: 2, seller: 'FashionStore', comment: 'Muy puntual y comunicativo. 100% recomendado.', stars: 5, date: 'Hace 1 semana' },
      { id: 3, seller: 'TechShop', comment: 'Todo bien, aunque tardó un poco en confirmar.', stars: 4, date: 'Hace 2 semanas' }
    ]
  };

  // Junio 2026 - Datos de envío (para flujo de usuario)
  const [shippingData, setShippingData] = useState({
    name: '',
    phone: '',
    street: '',
    interior: '',
    neighborhood: '',
    city: '',
    references: '',
    photo: null
  });

  // Junio 2026 - Scroll al final del chat cuando cambian los mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Junio 2026 - Contador regresivo
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Junio 2026 - Efectos del timer (avisos del sistema)
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

  // Junio 2026 - Formatear tiempo del contador
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Junio 2026 - Enviar mensaje genérico (para comprador y vendedor)
  const sendMessage = (senderRole, autoReplyRole = null) => {
    if (!inputText.trim()) return;
    
    const newMsg = {
      id: messages.length + 1,
      text: inputText,
      sender: senderRole,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages([...messages, newMsg]);
    setInputText('');

    // Simular respuesta automática si hay rol definido
    if (autoReplyRole) {
      setTimeout(() => {
          setMessages(prev => [...prev, {
              id: prev.length + 1,
              text: senderRole === 'buyer' ? 'Perfecto, confirmemos el acuerdo.' : 'Perfecto, gracias por la información.',
              sender: autoReplyRole,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
      }, 2000);
    }
  };

  // Junio 2026 - Acciones del vendedor
  const handleSellerAction = () => {
    if (sellerStep === 'initial') {
      setSellerStep('confirmed');
    } else if (sellerStep === 'confirmed') {
      setSellerStep('shipped');
      // Enviar mensaje del sistema
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: 'El vendedor ha marcado el producto como enviado. 🚚',
        sender: 'system',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  };

  // Junio 2026 - Acciones del comprador para confirmar llegada
  const handleProductArrivedYes = (navigateFunction, chatId) => {
    navigateFunction(`/closing/${chatId}`);
  };

  const handleProductArrivedNo = (navigateFunction) => {
    navigateFunction('/support');
  };

  // Junio 2026 - Gestión de formulario de envío
  const handleShippingSubmit = (e) => {
    e.preventDefault();
    setTimeout(() => {
      setShowShippingForm(false);
      setShowDeliveryOptions(true);
    }, 500);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setShippingData({ ...shippingData, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <ChatContext.Provider value={{
      // Estados
      messages,
      setMessages,
      inputText,
      setInputText,
      timeLeft,
      setTimeLeft,
      showHistory,
      setShowHistory,
      showDeliveryOptions,
      setShowDeliveryOptions,
      showShippingForm,
      setShowShippingForm,
      sellerStep,
      setSellerStep,
      buyerHistory,
      shippingData,
      setShippingData,
      messagesEndRef,
      // Funciones
      formatTime,
      sendMessage,
      handleSellerAction,
      handleProductArrivedYes,
      handleProductArrivedNo,
      handleShippingSubmit,
      handleFileChange,
      scrollToBottom
    }}>
      {children}
    </ChatContext.Provider>
  );
};

