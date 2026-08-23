
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

function rowToMessage(row) {
  return {
    id: row.id,
    text: row.text,
    sender: row.sender,
    time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export const ChatProvider = ({ children }) => {
  const { id } = useParams();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const realtimeSubRef = useRef(null);

  const initialMessages = [
    { id: 'welcome', text: 'Escribe un mensaje para empezar la negociación.', sender: 'system', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  ];

  const [messages, setMessages] = useState(initialMessages);
  const [inputText, setInputText] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);
  const [showHistory, setShowHistory] = useState(false);
  const [showDeliveryOptions, setShowDeliveryOptions] = useState(false);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [sellerStep, setSellerStep] = useState('initial');
  const [chatLoaded, setChatLoaded] = useState(false);

  const [buyerHistory, setBuyerHistory] = useState({
    rating: 0,
    totalPurchases: 0,
    reviews: [],
  });

  const [shippingData, setShippingData] = useState({
    name: '',
    phone: '',
    street: '',
    interior: '',
    neighborhood: '',
    city: '',
    references: '',
    photo: null,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!id) {
      setMessages(initialMessages);
      setChatLoaded(false);
      return () => {};
    }

    let mounted = true;
    setChatLoaded(false);

    const loadChat = async () => {
      try {
        const { data: chat, error: chatErr } = await supabase
          .from('chats')
          .select('*, requests(buyer_id, status), buyer:buyer_id(*, user_profiles(rating, total_purchases, reviews_count)), commerce:commerce_id(*)')
          .eq('id', id)
          .maybeSingle();

        if (chatErr) console.warn('[Chat] error cargando chat:', chatErr.message);
        if (chat && mounted) {
          setTimeLeft(chat.time_left_seconds || 300);
          setSellerStep(chat.seller_step || 'initial');

          const buyerProf = chat.buyer?.user_profiles;
          if (buyerProf) {
            setBuyerHistory({
              rating: buyerProf.rating || 0,
              totalPurchases: buyerProf.total_purchases || 0,
              reviews: [],
            });
          }

          const { data: ship, error: shipErr } = await supabase
            .from('shipping_data')
            .select('*')
            .eq('chat_id', id)
            .maybeSingle();
          if (!shipErr && ship && mounted) {
            setShippingData({
              name: ship.name || '',
              phone: ship.phone || '',
              street: ship.street || '',
              interior: ship.interior || '',
              neighborhood: ship.neighborhood || '',
              city: ship.city || '',
              references: ship.references_ || '',
              photo: ship.photo_url || null,
            });
          }
        }

        const { data: msgs, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', id)
          .order('created_at', { ascending: true });

        if (error) {
          console.warn('[Chat] error cargando mensajes:', error.message);
        } else if (mounted) {
          setMessages(msgs?.length ? msgs.map(rowToMessage) : initialMessages);
        }
      } finally {
        if (mounted) setChatLoaded(true);
      }
    };

    loadChat();

    const channelName = `chat:${id}`;
    const c = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, rowToMessage(payload.new)];
          });
        }
      )
      .subscribe();
    realtimeSubRef.current = c;

    return () => {
      mounted = false;
      c?.unsubscribe?.();
      realtimeSubRef.current = null;
    };
  }, [id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [id]);

  useEffect(() => {
    if (timeLeft === 120) {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          text: 'Necesitas dar respuesta o este chat cerrará en 2 minutos',
          sender: 'system',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const ensureChatRow = async () => {
    if (!id) return null;
    const existing = (await supabase.from('chats').select('id').eq('id', id).maybeSingle()).data;
    if (existing) return existing;
    return null;
  };

  const sendMessage = async (senderRole, autoReplyRole = null) => {
    if (!inputText.trim()) return;
    if (!id) return;

    const localMsg = {
      id: `local-${Date.now()}`,
      text: inputText,
      sender: senderRole,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, localMsg]);
    const textToSend = inputText;
    setInputText('');

    try {
      const { error } = await supabase.from('messages').insert({
        chat_id: id,
        sender: senderRole,
        text: textToSend,
      });
      if (error) console.warn('[Chat] error insertando mensaje:', error.message);
    } catch (e) {
      console.warn('[Chat] excepción insertando mensaje:', e);
    }

    if (autoReplyRole) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `auto-${Date.now()}`,
            text: senderRole === 'buyer' ? 'Perfecto, confirmemos el acuerdo.' : 'Perfecto, gracias por la información.',
            sender: autoReplyRole,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }, 2000);
    }
  };

  const handleSellerAction = async () => {
    let next = sellerStep;
    if (sellerStep === 'initial') next = 'confirmed';
    else if (sellerStep === 'confirmed') next = 'shipped';
    setSellerStep(next);

    if (next === 'shipped') {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          text: 'El vendedor ha marcado el producto como enviado. 🚚',
          sender: 'system',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
    if (id) {
      const { error } = await supabase.from('chats').update({ seller_step: next, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) console.warn('[Chat] error actualizando seller_step:', error.message);
    }
  };

  const handleProductArrivedYes = (navigateFunction, chatId) => {
    navigateFunction(`/closing/${chatId}`);
  };

  const handleProductArrivedNo = (navigateFunction) => {
    navigateFunction('/support');
  };

  const handleShippingSubmit = async (e) => {
    e.preventDefault();
    if (id) {
      try {
        const payload = {
          chat_id: id,
          name: shippingData.name || null,
          phone: shippingData.phone || null,
          street: shippingData.street || null,
          interior: shippingData.interior || null,
          neighborhood: shippingData.neighborhood || null,
          city: shippingData.city || null,
          references_: shippingData.references || null,
          photo_url: shippingData.photo || null,
        };
        const { error } = await supabase.from('shipping_data').upsert(payload, { onConflict: 'chat_id' });
        if (error) console.warn('[Chat] error guardando envío:', error.message);
      } catch (e) {
        console.warn('[Chat] excepción guardando envío:', e);
      }
    }
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
    <ChatContext.Provider
      value={{
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
        chatLoaded,
        ensureChatRow,
        formatTime,
        sendMessage,
        handleSellerAction,
        handleProductArrivedYes,
        handleProductArrivedNo,
        handleShippingSubmit,
        handleFileChange,
        scrollToBottom,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
