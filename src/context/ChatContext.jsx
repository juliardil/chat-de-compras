import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChatContext } from './chat-context';
import { useAuth } from './auth-context';
import { isInsforgeConfigured } from '../lib/insforge';
import {
  createOrderForChat,
  fetchChatMessages,
  fetchChatCounterpart,
  fetchChatThread,
  fetchOrderById,
  mapChatMessage,
  sendChatMessage as sendChatMessageToBackend,
  updateOrderStatusForChat,
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

// Opción de marca guardada en el hilo al abrir el chat desde una oferta.
const readSelectedOption = (thread) => {
  const stored = thread?.selected_offer_option;
  if (!stored || typeof stored !== 'object') return null;

  const price = Number(stored.price);
  return {
    id: stored.id || null,
    brand: String(stored.brand || ''),
    price: Number.isFinite(price) ? price : null,
    note: String(stored.note || ''),
  };
};

// Acuerdos por producto guardados en el hilo (o en el snapshot del pedido).
const readSelectedItemOptions = (value) => {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).map(([itemKey, option]) => ({ item_key: itemKey, ...option }))
      : [];

  return entries
    .map((entry) => {
      const price = Number(entry?.price);
      const quantity = Number(entry?.quantity) || 1;
      return {
        itemKey: String(entry?.item_key ?? entry?.key ?? ''),
        itemName: String(entry?.item_name ?? entry?.name ?? ''),
        brand: String(entry?.brand ?? ''),
        price: Number.isFinite(price) ? price : null,
        quantity,
        note: String(entry?.note ?? ''),
      };
    })
    .filter((entry) => entry.brand);
};

const formatItemBrands = (entries) =>
  entries
    .map((entry) => `${entry.itemName || entry.itemKey}: ${entry.brand}`.trim())
    .filter(Boolean)
    .join(' · ');

const createMessage = (text, sender) => ({
  id: createId(),
  text,
  sender,
  time: nowLabel()
});

// Un chat nuevo empieza vacío: no se siembran mensajes de ejemplo. Con backend
// los mensajes viven en chat_messages; en demostración quedan en localStorage.
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

// Los datos de envío se envían al comercio como un mensaje real del chat. El
// prefijo permite reconocerlos al recargar la conversación y mostrar las
// acciones de recepción en lugar del formulario.
export const SHIPPING_MARKER = '📦 Datos de envío';
export const RECEIPT_MARKER = '✅ Recepción confirmada';

const formatShippingMessage = (data) => {
  const address = [
    String(data.street || '').trim(),
    String(data.interior || '').trim() ? `Int. ${String(data.interior).trim()}` : '',
    String(data.neighborhood || '').trim(),
    String(data.city || '').trim(),
  ]
    .filter(Boolean)
    .join(', ');

  return [
    `${SHIPPING_MARKER} del comprador`,
    `Destinatario: ${String(data.name || '').trim()}`,
    `Teléfono: ${String(data.phone || '').trim()}`,
    `Dirección: ${address}`,
    String(data.references || '').trim()
      ? `Referencias: ${String(data.references).trim()}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
};

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
  const [shippingSubmitting, setShippingSubmitting] = useState(false);
  const [receiptSending, setReceiptSending] = useState(false);
  // Pedido real vinculado a la conversación (se crea al confirmar la compra).
  const [orderInfo, setOrderInfo] = useState({
    id: null,
    commerceId: null,
    number: '',
    total: null,
    currency: 'MXN',
    status: null,
    product: '',
    brand: '',
    itemBrands: '',
    optionNote: '',
  });

  // Nombre y foto de la contraparte para la cabecera del chat.
  const [counterpart, setCounterpart] = useState({
    id: null,
    name: '',
    avatarUrl: null,
  });

  // Datos de envío del comprador (se envían al comercio como mensaje del chat)
  const [shippingData, setShippingData] = useState({
    name: '',
    phone: '',
    street: '',
    interior: '',
    neighborhood: '',
    city: '',
    references: '',
  });

  const activeChat = (activeChatId && chats[activeChatId]) || EMPTY_CHAT;
  const { messages, timeLeft, sellerStep, closed } = activeChat;

  // Se derivan de los mensajes para que el estado se mantenga al recargar y
  // para que ambas partes vean el mismo avance de la compra.
  const shippingSent = messages.some((message) =>
    String(message.text || '').startsWith(SHIPPING_MARKER)
  );
  const receiptConfirmed = messages.some((message) =>
    String(message.text || '').startsWith(RECEIPT_MARKER)
  );

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

  // Mantiene a la vista el pedido real de esta conversación (si ya existe) y
  // el comercio al que pertenece.
  const refreshThreadMeta = useCallback(async (chatId) => {
    if (!connected || !chatId) {
      setOrderInfo({
        id: null,
        commerceId: null,
        number: '',
        total: null,
        currency: 'MXN',
        status: null,
        product: '',
        brand: '',
        itemBrands: '',
        optionNote: '',
      });
      setCounterpart({ id: null, name: '', avatarUrl: null });
      return;
    }

    const threadResult = await fetchChatThread(chatId);
    const thread = threadResult.item;
    if (!thread) return;

    const counterpartInfo = await fetchChatCounterpart(thread, userRole);
    setCounterpart(counterpartInfo);

    // La opción elegida en la oferta es el acuerdo inicial de la conversación.
    const selected = readSelectedOption(thread);
    const threadItems = readSelectedItemOptions(thread.selected_offer_items);
    const agreedItems = threadItems.length > 0 ? threadItems : [];
    const agreedBrand = formatItemBrands(agreedItems);
    const agreedNote = agreedItems
      .map((entry) => entry.note)
      .filter(Boolean)
      .join(' · ');
    const agreedTotal = agreedItems.reduce(
      (total, entry) => total + (entry.price ?? 0) * entry.quantity,
      0
    );

    if (!thread.order_id) {
      setOrderInfo({
        id: null,
        commerceId: thread.commerce_id || null,
        number: '',
        total: agreedItems.length > 0 ? agreedTotal : (selected?.price ?? null),
        currency: 'MXN',
        status: null,
        product: agreedBrand || selected?.brand || '',
        brand: agreedBrand || selected?.brand || '',
        itemBrands: agreedBrand,
        optionNote: agreedNote || selected?.note || '',
      });
      return;
    }

    const orderResult = await fetchOrderById(thread.order_id);
    const order = orderResult.item;
    const orderItems = readSelectedItemOptions(order?.snapshot?.selectedItemOptions);

    setOrderInfo({
      id: thread.order_id,
      commerceId: thread.commerce_id || null,
      number: order?.order_number || '',
      total: order?.total_amount ?? null,
      currency: order?.currency || 'MXN',
      status: order?.status || null,
      product: order?.snapshot?.product || '',
      brand: order?.snapshot?.brand || agreedBrand || selected?.brand || '',
      itemBrands: formatItemBrands(orderItems) || agreedBrand,
      optionNote:
        order?.snapshot?.selectedOption?.note ||
        orderItems.map((entry) => entry.note).filter(Boolean).join(' · ') ||
        agreedNote ||
        selected?.note ||
        '',
    });
  }, [connected, userRole]);

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

  // Carga el pedido vinculado al abrir la conversación.
  useEffect(() => {
    void refreshThreadMeta(activeChatId);
  }, [activeChatId, refreshThreadMeta]);

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

  // Acciones del vendedor: confirmar la venta y luego marcar el envío. Cada
  // paso actualiza el pedido real (confirmed → shipped) y avisa en el chat.
  const handleSellerAction = () => {
    if (!activeChatId) return;

    const chat = chats[activeChatId];
    if (!chat || chat.timeLeft <= 0) return;

    if (chat.sellerStep === 'initial') {
      setChatError('');

      if (connected) {
        void updateOrderStatusForChat({
          chatId: activeChatId,
          status: 'confirmed',
          patch: { confirmed_at: new Date().toISOString() },
        }).then((result) => {
          if (result.error) {
            setChatError(result.error);
          } else {
            void refreshThreadMeta(activeChatId);
          }
        });
      }

      setChats((prev) => {
        const current = prev[activeChatId];
        if (!current) return prev;
        return { ...prev, [activeChatId]: { ...current, sellerStep: 'confirmed' } };
      });
      return;
    }

    if (chat.sellerStep === 'confirmed') {
      const note = 'El vendedor ha marcado el producto como enviado. 🚚';

      setChats((prev) => {
        const current = prev[activeChatId];
        if (!current) return prev;
        return {
          ...prev,
          [activeChatId]: {
            ...current,
            sellerStep: 'shipped',
            messages: [...current.messages, createMessage(note, 'system')],
          },
        };
      });

      if (connected) {
        void sendChatMessageToBackend({
          chat_id: activeChatId,
          sender_type: 'system',
          sender_name: 'Sistema',
          body: note,
        }).then((result) => {
          if (result.ok) void refreshChat(activeChatId);
        });

        void updateOrderStatusForChat({ chatId: activeChatId, status: 'shipped' }).then(
          (result) => {
            if (result.error) {
              setChatError(result.error);
            } else {
              void refreshThreadMeta(activeChatId);
            }
          }
        );
      }
    }
  };

  // El comprador confirma que recibió el producto. Queda como mensaje de
  // sistema en el chat para que el comercio también lo vea.
  const handleProductArrivedYes = async () => {
    if (!activeChatId) return;

    const note = `${RECEIPT_MARKER}: el comprador indicó que ya recibió el producto.`;
    setChatError('');
    setReceiptSending(true);

    try {
      if (connected) {
        const result = await sendChatMessageToBackend({
          chat_id: activeChatId,
          sender_type: 'system',
          sender_name: 'Sistema',
          body: note,
        });

        if (!result.ok) {
          setChatError(result.error || 'No se pudo confirmar la recepción.');
          return;
        }

        await refreshChat(activeChatId);

        // El pedido pasa a «entregado» para que el comercio lo vea en ventas.
        const orderUpdate = await updateOrderStatusForChat({
          chatId: activeChatId,
          status: 'delivered',
          patch: { delivered_at: new Date().toISOString() },
        });

        if (orderUpdate.error) {
          setChatError(orderUpdate.error);
        } else {
          await refreshThreadMeta(activeChatId);
        }
      } else {
        setChats((prev) => {
          const chat = prev[activeChatId];
          if (!chat) return prev;
          return {
            ...prev,
            [activeChatId]: {
              ...chat,
              messages: [...chat.messages, createMessage(note, 'system')],
            },
          };
        });
      }

      setShowDeliveryOptions(false);
    } finally {
      setReceiptSending(false);
    }
  };

  const handleProductArrivedNo = (navigateFunction) => {
    navigateFunction('/support');
  };

  // Envía los datos de envío al comercio como mensaje real del chat y registra
  // el pedido en el backend. El comercio los lee desde su propia sesión.
  const handleShippingSubmit = async (e) => {
    e.preventDefault();
    if (!activeChatId) return;

    const missing = [
      ['nombre', shippingData.name],
      ['teléfono', shippingData.phone],
      ['calle', shippingData.street],
      ['colonia', shippingData.neighborhood],
      ['ciudad', shippingData.city],
    ]
      .filter(([, value]) => !String(value || '').trim())
      .map(([label]) => label);

    if (missing.length > 0) {
      setChatError(`Completa ${missing.join(', ')} para enviar los datos al comercio.`);
      return;
    }

    const body = formatShippingMessage(shippingData);
    setChatError('');
    setShippingSubmitting(true);

    try {
      if (connected) {
        // Primero se registra el pedido real usando la oferta guardada en el
        // hilo. Solo si el pedido quedó guardado se envían los datos al
        // comercio, para que no exista una compra «a medias».
        const orderResult = await createOrderForChat({
          chatId: activeChatId,
          shipping: shippingData,
        });

        if (!orderResult.ok) {
          setChatError(orderResult.error || 'No se pudo registrar el pedido.');
          return;
        }

        if (orderResult.orderId) {
          await refreshThreadMeta(activeChatId);
        }

        const result = await sendChatMessageToBackend({
          chat_id: activeChatId,
          sender_type: 'buyer',
          sender_name: displayName,
          body,
        });

        if (!result.ok) {
          setChatError(result.error || 'No se pudieron enviar los datos de envío.');
          return;
        }

        await refreshChat(activeChatId);
      } else {
        setChats((prev) => {
          const chat = prev[activeChatId];
          if (!chat) return prev;
          return {
            ...prev,
            [activeChatId]: {
              ...chat,
              messages: [...chat.messages, createMessage(body, 'buyer')],
            },
          };
        });
      }

      setShowShippingForm(false);
      setShowDeliveryOptions(true);
    } finally {
      setShippingSubmitting(false);
    }
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
      shippingSent,
      receiptConfirmed,
      shippingSubmitting,
      receiptSending,
      orderInfo,
      counterpart,
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
      scrollToBottom
    }}>
      {children}
    </ChatContext.Provider>
  );
};
