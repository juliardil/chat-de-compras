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

// Un chat nuevo empieza vacío: no se siembran mensajes de ejemplo. Los
// mensajes que se ven son los que escriben las personas usuarias y quedan en
// localStorage (este dispositivo) hasta que se conecte chat_messages.
const EMPTY_CHAT = {
  messages: [],
  timeLeft: CHAT_DURATION,
  sellerStep: 'initial',
  warningSent: false,
  closed: false
};

const createChat = () => ({
  messages: [],
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

  // Enviar mensaje en la conversación activa (comprador o vendedor).
  // No hay respuestas automáticas: el otro lado debe escribir de verdad.
  const sendMessage = (senderRole) => {
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

  // El historial del comprador requiere compras/reseñas reales (purchase_orders
  // y commerce_reviews), que hoy no están expuestas a la app. Se entrega null
  // para que la vista muestre un estado vacío en lugar de datos inventados.
  const buyerHistory = null;

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
