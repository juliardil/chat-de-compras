
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { Car, Search } from 'lucide-react';
import Button from '../../components/ui/Button';

// Actualización Junio 2026 - Página Exclusiva Automotriz

export default function Categories() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#00EED0]/10 via-[#E7E7E7] to-[#4B227A]/10">
      {/* Header */}
      <header className="px-8 pt-12 pb-4 bg-white/70 backdrop-blur-md border-b border-white/30">
        <div className="flex justify-between items-center mb-1">
          <h1 className="text-3xl font-black text-gray-800 tracking-tight flex items-center gap-2">
            <Car className="w-8 h-8 text-[#00EED0]" />
            Automotriz
          </h1>
        </div>
        <p className="text-gray-600 text-sm font-medium">Encuentra repuestos y accesorios</p>
      </header>

      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl aspect-[4/5] relative"
        >
          {/* Background Image */}
          <img 
            src="https://images.unsplash.com/photo-1533473359331-0135ef1bcfb0?auto=format&fit=crop&q=80&w=800" 
            alt="Automotriz" 
            className="w-full h-full object-cover"
            loading="lazy"
          />
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#00EED0]/90 to-[#4B227A]/70 via-black/20 to-transparent" />

          {/* Content */}
          <div className="absolute inset-0 p-10 flex flex-col justify-end items-start">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-14 h-14 rounded-2xl bg-[#00EED0] flex items-center justify-center shadow-lg border-2 border-white/30">
                <Car className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-4xl font-black text-white leading-tight">Automotriz</h2>
            </div>
            <p className="text-white/90 text-lg font-medium leading-tight max-w-[200px]">
              Autos, motos, repuestos y accesorios
            </p>
          </div>
        </motion.div>
      </div>

      {/* Action Button */}
      <div className="px-6 py-4 bg-white/80 backdrop-blur-md border-t border-white/30">
        <Button 
          fullWidth 
          onClick={() => navigate('/request')}
          className="py-4 text-lg shadow-lg shadow-[#00EED0]/30"
        >
          <Search className="w-5 h-5 mr-2" />
          👉 ¿QUÉ NECESITAS?
        </Button>
      </div>

      <div className="pb-20">
        <UserBottomNav />
      </div>
    </div>
  );
}
