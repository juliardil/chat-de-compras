import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChatContext } from './chat-context';
import { useAuth } from './auth-context';
import { isInsforgeConfigured } from '../lib/insforge';
import {
  fetchChatMessages,
  mapChatMessage,
  sendChatMessage as sendChatMessageToBackend,
} from '../data/appData';

const STORAGE_KEY = 'chat_compras_chats_v1';
const CHAT_DURATION = 300; // 5 minutos (solo modo demostración)
const WARNING_AT = 120; // aviso a los 2 minutos restantes
const POLL_INTERVAL = 3000;

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
  const refreshingRef = useRef(false);
  const { user } = useAuth() || {};
  const userId = user?.id || null;
  const userRole = user?.role === 'commerce' ? 'commerce' : 'user';
  const displayName = user?.name || (userRole === 'commerce' ? 'Comercio' : 'Comprador');
  // En modo InsForge los mensajes viven en chat_messages y se consultan de
  // forma periódica; en demostración se conserva el comportamiento local.
  const connected = isInsforgeConfigured && Boolean(userId);
  const [chats, setChats] = useState(loadChats);
  const [activeChatId, setActiveChatId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showDeliveryOptions, setShowDeliveryOptions] = useState(false);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [chatError, setChatError] = useState('');

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

  // Persistir las conversaciones para que sobrevivan a una recarga. En modo
  // InsForge la fuente de verdad es el backend, así que no se cachea.
  useEffect(() => {
    if (connected) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {
      // Si el almacenamiento está lleno o no disponible, el chat sigue en memoria.
    }
  }, [chats, connected]);

  // Descarga los mensajes reales de la conversación activa.
  const refreshChat = useCallback(async (chatId) => {
    if (!connected || !chatId || refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      const result = await fetchChatMessages(chatId);
      if (result.error) {
        setChatError(result.error);
        return;
      }

      setChatError('');
      const nextMessages = result.items.map(mapChatMessage);
      setChats((prev) => {
        const current = prev[chatId] || createChat();
        return { ...prev, [chatId]: { ...current, messages: nextMessages } };
      });
    } finally {
      refreshingRef.current = false;
    }
  }, [connected]);

  // Abrir (o crear) el chat indicado por la ruta y limpiar modales al cambiar de conversación
  const openChat = useCallback((chatId) => {
    const key = String(chatId);
    setActiveChatId(key);
    setShowHistory(false);
    setShowDeliveryOptions(false);
    setShowShippingForm(false);
    setInputText('');
    setChatError('');
    setChats((prev) => (prev[key] ? prev : { ...prev, [key]: createChat() }));
  }, []);

  // Scroll al final cuando cambian los mensajes
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Un único temporizador global que descuenta solo la conversación activa.
  // Con backend conectado no se cierra el chat: la conversación es real.
  useEffect(() => {
    if (connected || !activeChatId) return undefined;

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
  }, [activeChatId, connected]);

  // Sondeo de mensajes nuevos. Ambos lados ven lo que escribe el otro aunque
  // estén en dispositivos distintos.
  useEffect(() => {
    if (!connected || !activeChatId) return undefined;

    const tick = () => {
      void refreshChat(activeChatId);
    };

    tick();
    const interval = setInterval(tick, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [activeChatId, connected, refreshChat]);

  // Formatear tiempo del contador
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Enviar mensaje en la conversación activa (comprador o vendedor).
  // Con backend se guarda en chat_messages; en demostración queda en el
  // dispositivo. No hay respuestas automáticas: el otro lado escribe de verdad.
  const sendMessage = async (senderRole) => {
    const text = inputText.trim();
    if (!text || !activeChatId) return;

    const chat = chats[activeChatId];
    if (!chat) return;

    if (connected) {
      const senderType =
        senderRole === 'seller' ? 'commerce' : senderRole === 'system' ? 'system' : 'buyer';

      setChatError('');
      setInputText('');

      const result = await sendChatMessageToBackend({
        chat_id: activeChatId,
        sender_type: senderType,
        sender_name: displayName,
        body: text,
      });

      if (!result.ok) {
        setChatError(result.error || 'No se pudo enviar el mensaje.');
        setInputText(text);
        return;
      }

      await refreshChat(activeChatId);
      return;
    }

    if (chat.timeLeft <= 0) return;

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
        const note = 'El vendedor ha marcado el producto como enviado. 🚚';

        if (connected) {
          void sendChatMessageToBackend({
            chat_id: activeChatId,
            sender_type: 'system',
            sender_name: 'Sistema',
            body: note,
          }).then((result) => {
            if (result.ok) void refreshChat(activeChatId);
          });
        }

        return {
          ...prev,
          [activeChatId]: {
            ...chat,
            sellerStep: 'shipped',
            messages: [
              ...chat.messages,
              createMessage(note, 'system')
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
      connected,
      chatError,
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
