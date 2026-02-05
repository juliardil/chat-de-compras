import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Image as ImageIcon } from 'lucide-react';
import Button from '../../components/ui/Button';

export default function CreateAd() {
  const navigate = useNavigate();
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(file);
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveAd = (callback) => {
    if (!preview || !text) return;
    
    setLoading(true);
    
    setTimeout(() => {
      const newAd = {
        id: Date.now(),
        type: 'image',
        url: preview,
        text: text,
        timestamp: new Date().toISOString()
      };

      const existingAds = JSON.parse(localStorage.getItem('custom_ads') || '[]');
      localStorage.setItem('custom_ads', JSON.stringify([newAd, ...existingAds]));
      
      setLoading(false);
      if (callback) callback();
    }, 1500);
  };

  const handlePublish = () => {
    saveAd(() => navigate('/niches'));
  };

  const handlePublishAndCreateAnother = () => {
    saveAd(() => {
      setPreview('');
      setText('');
      setImage(null);
      // Optional: Add a toast notification here
      alert('¡Historia publicada! Puedes crear otra.');
    });
  };

  return (
    <div className="h-screen bg-black relative flex flex-col overflow-hidden">
      {/* Background / Image Layer */}
      <div 
        className="absolute inset-0 z-0 bg-gray-900"
        onClick={() => !preview && document.getElementById('file-upload').click()}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white/50 gap-4 cursor-pointer hover:text-white transition-colors">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
              <Upload className="w-10 h-10" />
            </div>
            <span className="font-bold text-sm tracking-widest uppercase">Toca para subir imagen</span>
          </div>
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Hidden File Input */}
      <input 
        id="file-upload" 
        type="file" 
        className="hidden" 
        accept="image/*" 
        onChange={handleImageChange} 
      />

      {/* Top Info Overlay */}
      <div className="absolute top-6 left-4 right-4 z-40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate(-1)} 
              className="text-white hover:bg-white/10 rounded-full p-1 -ml-1 transition-colors"
            >
              <ArrowLeft className="w-6 h-6 shadow-sm" />
            </button>
            <h3 className="text-white text-base font-bold drop-shadow-md">TechStore</h3>
          </div>
          
          <button 
            onClick={() => document.getElementById('file-upload').click()}
            className="text-[10px] font-bold text-white/90 border border-white/30 px-3 py-1.5 rounded-full hover:bg-white/20 transition-all backdrop-blur-md flex items-center gap-1"
          >
            <ImageIcon className="w-3 h-3" />
            {preview ? 'CAMBIAR FOTO' : 'SUBIR FOTO'}
          </button>
        </div>

        {/* Text Input Area */}
        <div className="ml-9 relative group">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe aquí tu oferta o descripción..."
            className="w-full bg-transparent text-white/90 text-sm border-none focus:ring-0 p-0 placeholder-white/50 resize-none font-medium drop-shadow-sm"
            rows={2}
            maxLength={100}
          />
          <div className="h-0.5 w-full bg-white/20 mt-1 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white/80 transition-all duration-300"
              style={{ width: `${(text.length / 100) * 100}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-1">
             <span className="text-[10px] text-white/40 italic">Se verá así en la app</span>
             <span className={`text-[10px] font-medium ${text.length >= 100 ? 'text-red-400' : 'text-white/60'}`}>
               {text.length}/100
             </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-black z-50 flex flex-col gap-3">
        <Button 
          fullWidth 
          onClick={handlePublish}
          disabled={!preview || !text || loading}
          className={`shadow-lg shadow-blue-500/20 py-4 h-auto text-sm font-bold tracking-wider ${loading ? 'opacity-80' : ''}`}
        >
          {loading ? 'PUBLICANDO...' : 'PUBLICAR HISTORIA'}
        </Button>
        
        <Button 
          fullWidth 
          variant="outline"
          onClick={handlePublishAndCreateAnother}
          disabled={!preview || !text || loading}
          className={`border-white/20 text-white hover:bg-white/10 py-4 h-auto text-sm font-bold tracking-wider ${loading ? 'opacity-50' : ''}`}
        >
          PUBLICAR Y CREAR OTRA
        </Button>
      </div>
    </div>
  );
}
