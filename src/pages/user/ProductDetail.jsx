
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Heart, Share2, Star, Check } from 'lucide-react';
import Button from '../../components/ui/Button';

// Actualización estética Junio 2026

export default function ProductDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { product } = location.state || {
    product: {
      id: 1,
      name: 'Camiseta Básica Premium',
      price: 25.00,
      description: 'Camiseta de algodón 100% orgánico, corte regular fit. Ideal para el uso diario con una suavidad incomparable.',
      images: [
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&q=80&w=600'
      ],
      colors: ['Negro', 'Blanco', 'Azul'],
      sizes: ['S', 'M', 'L', 'XL'],
      rating: 4.8,
      reviews: 124,
      store: 'ModaUrbana'
    }
  };

  const [selectedColor, setSelectedColor] = useState(product.colors[0]);
  const [selectedSize, setSelectedSize] = useState(product.sizes[1]);
  const [isWishlist, setIsWishlist] = useState(false);

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-24">
      {/* Header Image */}
      <div className="relative h-[50vh] bg-white/70">
        <button 
          onClick={() => navigate(-1)} 
          className="absolute top-4 left-4 z-10 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-white/30"
        >
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <button 
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-white/30"
        >
          <Share2 className="w-5 h-5 text-gray-800" />
        </button>
        
        <img 
          src={product.images[0]} 
          alt={product.name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Content */}
      <div className="px-6 py-6 -mt-8 relative bg-white/80 backdrop-blur-md rounded-t-3xl border-t border-white/30">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">{product.name}</h1>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[#00EED0] fill-[#00EED0]" />
              <span className="text-sm font-medium text-gray-800">{product.rating}</span>
              <span className="text-sm text-gray-600">({product.reviews} reseñas)</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-[#00EED0]">
            ${product.price.toFixed(2)}
          </div>
        </div>

        <p className="text-gray-600 leading-relaxed mb-6">
          {product.description}
        </p>

        {/* Color Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Color</h3>
          <div className="flex gap-3">
            {product.colors.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`h-10 px-4 rounded-full border flex items-center gap-2 transition-all ${
                  selectedColor === color 
                    ? 'border-[#00EED0] bg-[#00EED0]/20 text-[#4B227A] ring-1 ring-[#00EED0]' 
                    : 'border-white/30 text-gray-600 hover:border-[#0197AF]/30 bg-white/70'
                }`}
              >
                {selectedColor === color && <Check className="w-3 h-3" />}
                <span className="text-sm font-medium">{color}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Size Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Talla</h3>
          <div className="flex gap-3">
            {product.sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                  selectedSize === size 
                    ? 'bg-[#4B227A] text-white border-[#4B227A]' 
                    : 'border-white/30 text-gray-600 hover:border-[#0197AF]/30 bg-white/70'
                }`}
              >
                <span className="text-sm font-medium">{size}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Store Info */}
        <div className="flex items-center gap-3 p-4 bg-white/70 rounded-xl mb-6 border border-white/30">
          <div className="w-10 h-10 rounded-full bg-[#0197AF]/20 flex items-center justify-center text-xl">
            🏪
          </div>
          <div>
            <p className="text-xs text-gray-600">Vendido por</p>
            <p className="font-bold text-gray-800">{product.store}</p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-white/30 flex items-center gap-4 z-50">
        <button 
          onClick={() => setIsWishlist(!isWishlist)}
          className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-colors ${
            isWishlist 
              ? 'border-[#4B227A]/30 bg-[#4B227A]/10 text-[#4B227A]' 
              : 'border-white/30 text-gray-600 hover:bg-white/50'
          }`}
        >
          <Heart className={`w-6 h-6 ${isWishlist ? 'fill-current' : ''}`} />
        </button>
        <Button 
          fullWidth 
          className="shadow-lg shadow-[#00EED0]/30 py-3.5"
          onClick={() => alert('¡Producto añadido al carrito!')}
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          COMPRAR AHORA
        </Button>
      </div>
    </div>
  );
}

