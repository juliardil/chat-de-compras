import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { DataNotice } from '../../components/ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import { createReview, fetchBuyerProfileId, NOTICES } from '../../data/appData';
import { Star, CheckCircle, ArrowLeft } from 'lucide-react';

// Actualización estética Junio 2026

export default function Closing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  // La reseña necesita un pedido real. El cierre desde el chat todavía no crea
  // uno, así que sin orderId no se escribe nada (ni se simula el guardado).
  const orderId = location.state?.orderId || null;
  const commerceId = location.state?.commerceId || null;

  const handleSubmit = async () => {
    if (rating === 0) return;

    setBusy(true);
    setMessage(null);

    if (!orderId) {
      setBusy(false);
      setMessage({
        tone: 'warning',
        text: 'No hay un pedido asociado a este cierre. La calificación se guardará cuando el flujo de compra genere un pedido real en el backend.',
      });
      return;
    }

    const buyer = await fetchBuyerProfileId(user?.id);
    if (!buyer.item) {
      setBusy(false);
      setMessage({
        tone: 'error',
        text:
          buyer.error ||
          buyer.notice ||
          'Tu cuenta todavía no tiene un perfil de comprador en el backend.',
      });
      return;
    }

    const result = await createReview({
      order_id: orderId,
      buyer_id: buyer.item.id,
      commerce_id: commerceId,
      rating,
      comment: comment.trim() || null,
      status: 'pending',
    });

    setBusy(false);

    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error });
      return;
    }

    navigate('/history');
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] p-6 flex flex-col items-center">
      <header className="w-full mb-8">
        <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/50 rounded-full inline-block">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center w-full max-w-sm">
        <div className="w-20 h-20 bg-[#00EED0]/20 rounded-full flex items-center justify-center mb-6 border border-[#00EED0]/30">
          <CheckCircle className="w-10 h-10 text-[#4B227A]" />
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">Califica tu experiencia</h1>
        <p className="text-gray-600 text-center mb-6">
          Ayúdanos calificando tu experiencia con el comercio.
        </p>

        <div className="w-full mb-6">
          <DataNotice tone="info">
            {NOTICES.reviews} El cierre de compra todavía no genera un pedido real en el backend,
            así que la calificación no se guardará hasta que ese flujo esté conectado.
          </DataNotice>
        </div>

        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`Calificar con ${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
              aria-pressed={star <= rating}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-110 focus:outline-none"
            >
              <Star
                className={`w-10 h-10 ${star <= rating ? 'text-[#006E7A] fill-current' : 'text-gray-500'}`}
              />
            </button>
          ))}
        </div>

        <textarea
          placeholder="Escribe un comentario (opcional)..."
          className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-[#00EED0] transition-all mb-4 h-32 resize-none"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {message ? (
          <div className="w-full mb-4">
            <DataNotice tone={message.tone}>{message.text}</DataNotice>
          </div>
        ) : null}

        <Button fullWidth onClick={handleSubmit} disabled={rating === 0 || busy}>
          {busy ? 'GUARDANDO…' : 'ENVIAR CALIFICACIÓN'}
        </Button>

        <button
          type="button"
          onClick={() => navigate('/history')}
          className="mt-4 text-sm font-semibold text-[#006E7A] hover:underline"
        >
          Volver al historial
        </button>
      </div>
    </div>
  );
}
