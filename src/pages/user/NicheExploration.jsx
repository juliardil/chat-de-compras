import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, ChevronRight } from 'lucide-react';
import Button from '../../components/ui/Button';

// Mock Data
const INITIAL_MERCHANTS = [
  {
    id: 1,
    name: 'TechStore',
    niche: 'tech',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=100',
    active: true,
    stories: [
      { id: 101, type: 'image', url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=600', text: 'Nuevos iPhone disponibles' },
      { id: 102, type: 'image', url: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=600', text: 'Ofertas en accesorios' }
    ]
  },
  {
    id: 2,
    name: 'ModaUrbana',
    niche: 'fashion',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100',
    active: true,
    stories: [
      { id: 201, type: 'image', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600', text: 'Colección Verano 2024' },
      { id: 202, type: 'image', url: 'https://images.unsplash.com/photo-1529139574466-a302d2d3f524?auto=format&fit=crop&q=80&w=600', text: 'Descuentos exclusivos' }
    ]
  },
  {
    id: 3,
    name: 'AutoParts',
    niche: 'auto',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100',
    active: false,
    stories: [
      { id: 301, type: 'image', url: 'https://images.unsplash.com/photo-1486262715619-01b80250e0dc?auto=format&fit=crop&q=80&w=600', text: 'Repuestos originales' }
    ]
  }
];

export default function NicheExploration() {
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState(INITIAL_MERCHANTS);
  const [currentMerchantIndex, setCurrentMerchantIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  useEffect(() => {
    const customAds = JSON.parse(localStorage.getItem('custom_ads') || '[]');
    if (customAds.length > 0) {
      setMerchants(prev => {
        const newMerchants = [...prev];
        const techStoreIndex = newMerchants.findIndex(m => m.id === 1);
        if (techStoreIndex >= 0) {
          const techStore = { ...newMerchants[techStoreIndex] };
          techStore.stories = [...customAds, ...techStore.stories];
          newMerchants[techStoreIndex] = techStore;
        }
        return newMerchants;
      });
    }
  }, []);

  const merchant = merchants[currentMerchantIndex];
  const story = merchant?.stories[currentStoryIndex];

  if (!merchant || !story) return null; // Safety check

  // Auto-advance stories
  useEffect(() => {
    const timer = setTimeout(() => {
      handleNext();
    }, 5000);
    return () => clearTimeout(timer);
  }, [currentStoryIndex, currentMerchantIndex, merchants]); // Added merchants dep

  const handleNext = () => {
    if (currentStoryIndex < merchant.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      // Next merchant
      if (currentMerchantIndex < merchants.length - 1) {
        setCurrentMerchantIndex(prev => prev + 1);
        setCurrentStoryIndex(0);
      } else {
        // End of all stories, loop back or stop
        setCurrentMerchantIndex(0);
        setCurrentStoryIndex(0);
      }
    }
  };

  const handlePrev = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else {
      // Prev merchant
      if (currentMerchantIndex > 0) {
        setCurrentMerchantIndex(prev => prev - 1);
        setCurrentStoryIndex(merchants[currentMerchantIndex - 1].stories.length - 1);
      }
    }
  };

  const handleMerchantSelect = (index) => {
    setCurrentMerchantIndex(index);
    setCurrentStoryIndex(0);
  };

  return (
    <div className="h-screen bg-black relative flex flex-col">
      {/* Top Bar - Bubbles (Moved to Bottom) */}
      <div className="absolute bottom-20 left-0 right-0 z-50 p-4 pb-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">
          {merchants.map((m, idx) => (
            <button 
              key={m.id}
              onClick={() => handleMerchantSelect(idx)}
              className={`flex flex-col items-center gap-1 min-w-[50px] transition-all ${currentMerchantIndex === idx ? 'scale-110' : 'opacity-70'}`}
            >
              <div className={`w-10 h-10 rounded-full p-[1.5px] ${m.active ? 'bg-gradient-to-tr from-yellow-400 to-purple-600' : 'bg-gray-500'}`}>
                <img src={m.avatar} className="w-full h-full rounded-full border border-black object-cover" alt={m.name} />
              </div>
              <span className="text-[9px] text-white font-medium truncate w-full text-center">{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Story Content */}
      <div className="flex-1 relative bg-gray-900">
        <img src={story.url} alt="Story" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        
          
        {/* Progress Bar (Removed) */}
        {/* <div className="absolute top-24 left-0 right-0 flex justify-center gap-2 z-40">
          {merchant.stories.map((s, idx) => (
            <div 
              key={s.id} 
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                idx === currentStoryIndex ? 'bg-white scale-125' : 
                idx < currentStoryIndex ? 'bg-white/60' : 'bg-white/30'
              }`}
            />
          ))}
        </div> */}

        {/* Tap Areas */}
        <div className="absolute inset-0 flex z-30">
          <div className="w-1/3 h-full" onClick={handlePrev}></div>
          <div className="w-2/3 h-full" onClick={handleNext}></div>
        </div>

        {/* Info Overlay (Moved to Top) */}
        <div className="absolute top-6 left-4 right-4 z-40">
           <div className="flex items-center justify-between mb-0">
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(-1)} className="text-white hover:bg-white/10 rounded-full p-1 -ml-1">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-white text-base font-bold">{merchant.name}</h3>
              </div>
              <button 
                onClick={() => navigate(`/product/${merchant.id}`, { state: { product: {
                  id: merchant.id,
                  name: 'Colección ' + merchant.name,
                  price: 89.99,
                  description: 'Descubre nuestra nueva colección exclusiva. Calidad premium y diseño único.',
                  images: [story.url],
                  colors: ['Estándar'],
                  sizes: ['Única'],
                  rating: 4.9,
                  reviews: 85,
                  store: merchant.name
                }}})}
                className="text-[10px] font-medium text-white/80 border border-white/30 px-2 py-1 rounded-full hover:bg-white/10 transition-colors backdrop-blur-sm"
              >
                Ver detalle
              </button>
            </div>
           <p className="text-white/90 text-xs ml-8">{story.text}</p>
        </div>
      </div>

      {/* Fixed CTA */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-black z-50">
        <Button 
          fullWidth 
          onClick={() => navigate('/request', { state: { niche: merchant.niche } })}
          className="bg-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30"
        >
          👉 ¿QUÉ NECESITAS?
        </Button>
      </div>
    </div>
  );
}
