import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { Shirt, Smartphone, Car, ChevronLeft, ChevronRight } from 'lucide-react';

// Actualización estética Junio 2026

export default function Categories() {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);

  const categories = [
    { 
      id: 'fashion', 
      name: 'Moda', 
      subtitle: 'Ropa, accesorios, tendencias',
      icon: Shirt, 
      color: 'bg-[#4B227A]', 
      gradient: 'from-[#4B227A]/90 to-[#0197AF]/70',
      bgGradient: 'from-[#4B227A]/10 via-[#E7E7E7] to-[#0197AF]/10',
      image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800' 
    },
    { 
      id: 'tech', 
      name: 'Tecnología', 
      subtitle: 'Gadgets, computadoras, innovacion',
      icon: Smartphone, 
      color: 'bg-[#0197AF]', 
      gradient: 'from-[#0197AF]/90 to-[#00EED0]/70',
      bgGradient: 'from-[#0197AF]/10 via-[#E7E7E7] to-[#00EED0]/10',
      image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=800'
    },
    { 
      id: 'auto', 
      name: 'Automotriz', 
      subtitle: 'Autos, motos, mecanica',
      icon: Car, 
      color: 'bg-[#00EED0]', 
      gradient: 'from-[#00EED0]/90 to-[#4B227A]/70',
      bgGradient: 'from-[#00EED0]/10 via-[#E7E7E7] to-[#4B227A]/10',
      image: 'https://images.unsplash.com/photo-1533473359331-0135ef1bcfb0?auto=format&fit=crop&q=80&w=800'
    }
  ];

  const handleDragEnd = (event, info) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold && activeIndex < categories.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else if (info.offset.x > swipeThreshold && activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const activeCategory = categories[activeIndex];

  return (
    <div className={`h-screen overflow-hidden flex flex-col bg-gradient-to-br ${activeCategory.bgGradient} transition-all duration-1000`}>
      {/* Header */}
      <header className="px-8 pt-12 pb-4 z-20 bg-white/70 backdrop-blur-md border-b border-white/30">
        <div className="flex justify-between items-center mb-1">
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Explorar</h1>
        </div>
        <p className="text-gray-600 text-sm font-medium">Selecciona una categoría</p>
      </header>

      {/* Carousel Container */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden touch-none">
        <div className="flex items-center w-full relative">
          <AnimatePresence mode='popLayout'>
            <motion.div
              key="carousel"
              className="flex items-center"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={handleDragEnd}
              animate={{ x: `calc(50% - ${(activeIndex * 80) + 40}% - ${activeIndex * 20}px)` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{ width: `${categories.length * 80}%` }}
            >
              {categories.map((cat, index) => {
                const isActive = index === activeIndex;
                return (
                  <motion.div
                    key={cat.id}
                    onClick={() => isActive && navigate('/niches', { state: { category: cat.id } })}
                    className="relative shrink-0 rounded-[40px] overflow-hidden shadow-2xl cursor-pointer mx-[10px] aspect-[4/5]"
                    style={{ width: '80%' }}
                    animate={{
                      scale: isActive ? 1 : 0.9,
                      opacity: isActive ? 1 : 0.6,
                      filter: isActive ? 'blur(0px)' : 'blur(2px)',
                    }}
                    transition={{ duration: 0.4 }}
                  >
                    {/* Background Image */}
                    <img 
                      src={cat.image} 
                      alt={cat.name} 
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                    
                    {/* Gradient Overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-t ${cat.gradient} via-black/20 to-transparent`} />

                    {/* Left/Right Arrows for visual guide */}
                    {isActive && index > 0 && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">
                            <ChevronLeft className="w-6 h-6" />
                        </div>
                    )}
                    {isActive && index < categories.length - 1 && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50">
                            <ChevronRight className="w-6 h-6" />
                        </div>
                    )}

                    {/* Content */}
                    <div className="absolute inset-0 p-10 flex flex-col justify-end items-start">
                        <div className="flex items-center gap-4 mb-3">
                            <div className={`w-14 h-14 rounded-2xl ${cat.color} flex items-center justify-center shadow-lg border-2 border-white/30`}>
                                <cat.icon className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-4xl font-black text-white leading-tight">{cat.name}</h2>
                        </div>
                        <p className="text-white/90 text-lg font-medium leading-tight max-w-[200px]">
                            {cat.subtitle}
                        </p>
                    </div>

                    {/* Dots indicator inside card like the image */}
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
                        {categories.map((_, dotIdx) => (
                            <div 
                                key={dotIdx}
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                    dotIdx === activeIndex ? 'w-4 bg-[#00EED0] shadow-[0_0_10px_rgba(0,238,208,0.7)]' : 'w-1.5 bg-white/40'
                                }`}
                            />
                        ))}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="h-24"></div> {/* Spacer for Nav */}
      <UserBottomNav />
    </div>
  );
}