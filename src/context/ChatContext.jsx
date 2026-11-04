import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChatContext } from './chat-context';

const STORAGE_KEY = 'chat_compras_chats_v1';
const CHAT_DURATION = 300; // 5 minutos
const WARNING_AT = 120; // aviso a los 2 minutos restantes

const createId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
);

const nowLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const createMessage = (text, sender) => ({
  id: createId(),
  text,
  sender,
  time: nowLabel()
});

const INITIAL_MESSAGES = [
  { id: 'seed-1', text: 'Hola, vi tu solicitud. Tengo las pastillas de freno para Corolla 2018 listas para entrega.', sender: 'seller', time: '10:05 AM' },
  { id: 'seed-2', text: '¡Genial! ¿Aceptas transferencia?', sender: 'buyer', time: '10:06 AM' },
  { id: 'seed-3', text: 'Sí, claro. Y te incluyo el filtro de aceite de regalo 🎁', sender: 'seller', time: '10:07 AM' }
];

const EMPTY_CHAT = {
  messages: INITIAL_MESSAGES,
  timeLeft: CHAT_DURATION,
  sellerStep: 'initial',
  warningSent: false,
  closed: false
};

const createChat = () => ({
  messages: INITIAL_MESSAGES.map((message) => ({ ...message })),
  timeLeft: CHAT_DURATION,
  sellerStep: 'initial',
  warningSent: false,
  closed: false
});

const loadChats = () => {
  try {
    if (typeof localStorage === 'undefined') return {};

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    // Normaliza cada conversación para tolerar datos antiguos o corruptos
    return Object.entries(parsed).reduce((chats, [chatId, chat]) => {
      if (!chat || !Array.isArray(chat.messages)) return chats;

      const timeLeft = Number(chat.timeLeft);
      const messages = chat.messages
        .filter((message) => message && typeof message.text === 'string')
        .map((message) => ({
          id: message.id ?? createId(),
          text: message.text,
          sender: ['buyer', 'seller', 'system'].includes(message.sender) ? message.sender : 'system',
          time: message.time ?? ''
        }));

      chats[chatId] = {
        messages,
        timeLeft: Number.isFinite(timeLeft) ? Math.max(0, Math.min(CHAT_DURATION, timeLeft)) : CHAT_DURATION,
        sellerStep: ['initial', 'confirmed', 'shipped'].includes(chat.sellerStep) ? chat.sellerStep : 'initial',
        warningSent: Boolean(chat.warningSent),
        closed: Boolean(chat.closed) || timeLeft === 0
      };

      return chats;
    }, {});
  } catch {
    return {};
  }
};

export const ChatProvider = ({ children }) => {
  const messagesEndRef = useRef(null);
  const [chats, setChats] = useState(loadChats);
  const [activeChatId, setActiveChatId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showDeliveryOptions, setShowDeliveryOptions] = useState(false);
  const [showShippingForm, setShowShippingForm] = useState(false);

  // Datos de envío del comprador (no se persisten para no guardar imágenes en localStorage)
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

  const activeChat = (activeChatId && chats[activeChatId]) || EMPTY_CHAT;
  const { messages, timeLeft, sellerStep, closed } = activeChat;

  // Persistir las conversaciones para que sobrevivan a una recarga
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {
      // Si el almacenamiento está lleno o no disponible, el chat sigue en memoria.
    }
  }, [chats]);

  // Abrir (o crear) el chat indicado por la ruta y limpiar modales al cambiar de conversación
  const openChat = useCallback((chatId) => {
    const key = String(chatId);
    setActiveChatId(key);
    setShowHistory(false);
    setShowDeliveryOptions(false);
    setShowShippingForm(false);
    setInputText('');
    setChats((prev) => (prev[key] ? prev : { ...prev, [key]: createChat() }));
  }, []);

  // Scroll al final cuando cambian los mensajes
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Un único temporizador global que descuenta solo la conversación activa
  useEffect(() => {
    if (!activeChatId) return undefined;

    const timer = setInterval(() => {
      setChats((prev) => {
        const chat = prev[activeChatId];
        if (!chat || chat.timeLeft <= 0) return prev;

        const nextTime = chat.timeLeft - 1;
        let nextMessages = chat.messages;
        let warningSent = chat.warningSent;
        let closed = chat.closed;

        if (nextTime === WARNING_AT && !warningSent) {
          nextMessages = [...nextMessages, createMessage(
            'Necesitas dar respuesta o este chat cerrará en 2 minutos',
            'system'
          )];
          warningSent = true;
        }

        if (nextTime === 0 && !closed) {
          nextMessages = [...nextMessages, createMessage(
            'El tiempo del chat ha terminado. Ya no es posible enviar mensajes.',
            'system'
          )];
          closed = true;
        }

        return {
          ...prev,
          [activeChatId]: { ...chat, timeLeft: nextTime, messages: nextMessages, warningSent, closed }
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeChatId]);

  // Formatear tiempo del contador
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Enviar mensaje en la conversación activa (comprador o vendedor)
  const sendMessage = (senderRole, autoReplyRole = null) => {
    const text = inputText.trim();
    if (!text || !activeChatId) return;

    const chat = chats[activeChatId];
    if (!chat || chat.timeLeft <= 0) return;

    setChats((prev) => {
      const current = prev[activeChatId];
      if (!current) return prev;
      return {
        ...prev,
        [activeChatId]: { ...current, messages: [...current.messages, createMessage(text, senderRole)] }
      };
    });
    setInputText('');

    // Respuesta automática simulada del otro lado de la conversación
    if (autoReplyRole) {
      const chatIdAtSend = activeChatId;
      setTimeout(() => {
        setChats((prev) => {
          const current = prev[chatIdAtSend];
          if (!current || current.timeLeft <= 0) return prev;

          const reply = senderRole === 'buyer'
            ? 'Perfecto, confirmemos el acuerdo.'
            : 'Perfecto, gracias por la información.';

          return {
            ...prev,
            [chatIdAtSend]: { ...current, messages: [...current.messages, createMessage(reply, autoReplyRole)] }
          };
        });
      }, 2000);
    }
  };

  // Acciones del vendedor: marcar venta y luego envío
  const handleSellerAction = () => {
    if (!activeChatId) return;

    setChats((prev) => {
      const chat = prev[activeChatId];
      if (!chat || chat.timeLeft <= 0) return prev;

      if (chat.sellerStep === 'initial') {
        return { ...prev, [activeChatId]: { ...chat, sellerStep: 'confirmed' } };
      }

      if (chat.sellerStep === 'confirmed') {
        return {
          ...prev,
          [activeChatId]: {
            ...chat,
            sellerStep: 'shipped',
            messages: [
              ...chat.messages,
              createMessage('El vendedor ha marcado el producto como enviado. 🚚', 'system')
            ]
          }
        };
      }

      return prev;
    });
  };

  // Acciones del comprador para confirmar llegada
  const handleProductArrivedYes = (navigateFunction, chatId) => {
    navigateFunction(`/closing/${chatId}`);
  };

  const handleProductArrivedNo = (navigateFunction) => {
    navigateFunction('/support');
  };

  // Gestión del formulario de envío
  const handleShippingSubmit = (e) => {
    e.preventDefault();
    setTimeout(() => {
      setShowShippingForm(false);
      setShowDeliveryOptions(true);
    }, 500);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setShippingData((prev) => ({ ...prev, photo: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // Historial mock del comprador (para la vista del comercio)
  const buyerHistory = {
    rating: 4.7,
    totalPurchases: 42,
    reviews: [
      { id: 1, seller: 'Repuestos del Sur', comment: 'Comprador excelente, pago rápido y sin complicaciones.', stars: 5, date: 'Hace 3 días' },
      { id: 2, seller: 'AutoPartes Gómez', comment: 'Muy puntual y comunicativo. 100% recomendado.', stars: 5, date: 'Hace 1 semana' },
      { id: 3, seller: 'Taller Central', comment: 'Todo bien, aunque tardó un poco en confirmar.', stars: 4, date: 'Hace 2 semanas' }
    ]
  };

  return (
    <ChatContext.Provider value={{
      // Conversación activa
      activeChatId,
      openChat,
      messages,
      timeLeft,
      sellerStep,
      closed,
      // Entrada y modales
      inputText,
      setInputText,
      showHistory,
      setShowHistory,
      showDeliveryOptions,
      setShowDeliveryOptions,
      showShippingForm,
      setShowShippingForm,
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
