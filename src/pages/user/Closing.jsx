
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { Star, CheckCircle, ArrowLeft } from 'lucide-react';

// Actualización estética Junio 2026

export default function Closing() {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    navigate('/history');
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] p-6 flex flex-col items-center">
      <header className="w-full mb-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/50 rounded-full inline-block">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center w-full max-w-sm">
        <div className="w-20 h-20 bg-[#00EED0]/20 rounded-full flex items-center justify-center mb-6 animate-pulse border border-[#00EED0]/30">
          <CheckCircle className="w-10 h-10 text-[#4B227A]" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">¡Transacción Exitosa!</h1>
        <p className="text-gray-600 text-center mb-10">
          Has confirmado la entrega del producto. Ayúdanos calificando tu experiencia con <span className="font-bold text-gray-800">TechMaster</span>.
        </p>

        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-110 focus:outline-none"
            >
              <Star 
                className={`w-10 h-10 ${star <= rating ? 'text-[#00EED0] fill-current' : 'text-gray-400'}`} 
              />
            </button>
          ))}
        </div>

        <textarea 
          placeholder="Escribe un comentario (opcional)..." 
          className="w-full bg-white/70 border border-white/30 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-[#00EED0] transition-all mb-8 h-32 resize-none"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <Button fullWidth onClick={handleSubmit} disabled={rating === 0}>
          ENVIAR CALIFICACIÓN
        </Button>
      </div>
    </div>
  );
}

