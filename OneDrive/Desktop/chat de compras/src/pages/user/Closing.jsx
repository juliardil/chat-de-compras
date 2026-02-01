import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { Star, CheckCircle, ArrowLeft } from 'lucide-react';

export default function Closing() {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    navigate('/history');
  };

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col items-center">
      <header className="w-full mb-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full inline-block">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center w-full max-w-sm">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-dark mb-2 text-center">¡Transacción Exitosa!</h1>
        <p className="text-gray-500 text-center mb-10">
          Has confirmado la entrega del producto. Ayúdanos calificando tu experiencia con <span className="font-bold text-dark">TechMaster</span>.
        </p>

        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-110 focus:outline-none"
            >
              <Star 
                className={`w-10 h-10 ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-200'}`} 
              />
            </button>
          ))}
        </div>

        <textarea 
          placeholder="Escribe un comentario (opcional)..." 
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-dark focus:outline-none focus:border-primary transition-all mb-8 h-32 resize-none"
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
