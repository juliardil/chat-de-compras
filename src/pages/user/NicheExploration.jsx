import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, ChevronRight } from 'lucide-react';
import Button from '../../components/ui/Button';

// Mock Data
const MERCHANTS = [
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
  const [currentMerchantIndex, setCurrentMerchantIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  const merchant = MERCHANTS[currentMerchantIndex];
  const story = merchant.stories[currentStoryIndex];

  // Auto-advance stories
  useEffect(() => {
    const timer = setTimeout(() => {
      handleNext();
    }, 5000);
    return () => clearTimeout(timer);
  }, [currentStoryIndex, currentMerchantIndex]);

  const handleNext = () => {
    if (currentStoryIndex < merchant.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      // Next merchant
      if (currentMerchantIndex < MERCHANTS.length - 1) {
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
        setCurrentStoryIndex(MERCHANTS[currentMerchantIndex - 1].stories.length - 1);
      }
    }
  };

  const handleMerchantSelect = (index) => {
    setCurrentMerchantIndex(index);
    setCurrentStoryIndex(0);
  };

  return (
    <div className="h-screen bg-black relative flex flex-col">
      {/* Top Bar - Bubbles */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 pt-8 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">
          <button onClick={() => navigate(-1)} className="text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          {MERCHANTS.map((m, idx) => (
            <button 
              key={m.id}
              onClick={() => handleMerchantSelect(idx)}
              className={`flex flex-col items-center gap-1 min-w-[60px] transition-all ${currentMerchantIndex === idx ? 'scale-110' : 'opacity-70'}`}
            >
              <div className={`w-14 h-14 rounded-full p-[2px] ${m.active ? 'bg-gradient-to-tr from-yellow-400 to-purple-600' : 'bg-gray-500'}`}>
                <img src={m.avatar} className="w-full h-full rounded-full border-2 border-black object-cover" alt={m.name} />
              </div>
              <span className="text-[10px] text-white font-medium truncate w-full text-center">{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Story Content */}
      <div className="flex-1 relative bg-gray-900">
        <img src={story.url} alt="Story" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        
        {/* Progress Bar */}
        <div className="absolute top-24 left-2 right-2 flex gap-1 z-40">
          {merchant.stories.map((s, idx) => (
            <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-white transition-all duration-300 ${
                  idx < currentStoryIndex ? 'w-full' : 
                  idx === currentStoryIndex ? 'w-full animate-progress' : 'w-0'
                }`} 
              />
            </div>
          ))}
        </div>

        {/* Tap Areas */}
        <div className="absolute inset-0 flex z-30">
          <div className="w-1/3 h-full" onClick={handlePrev}></div>
          <div className="w-2/3 h-full" onClick={handleNext}></div>
        </div>

        {/* Info Overlay */}
        <div className="absolute bottom-24 left-4 right-4 z-40">
           <h3 className="text-white text-xl font-bold mb-2">{merchant.name}</h3>
           <p className="text-white/90 text-lg">{story.text}</p>
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
