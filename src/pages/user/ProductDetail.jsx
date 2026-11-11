import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Heart, Share2, Star, Check, PackageX } from 'lucide-react';
import Button from '../../components/ui/Button';
import SafeImage from '../../components/ui/SafeImage';
import { EmptyModule } from '../../components/ui/ModuleState';
import { NOTICES } from '../../data/appData';

// Actualización estética Junio 2026

export default function ProductDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const product = location.state?.product || null;

  const [selectedColor, setSelectedColor] = useState(product?.colors?.[0] || '');
  const [selectedSize, setSelectedSize] = useState(product?.sizes?.[1] || product?.sizes?.[0] || '');
  const [isWishlist, setIsWishlist] = useState(false);
  const [shareStatus, setShareStatus] = useState('');

  useEffect(() => {
    if (!shareStatus) return;
    const timer = setTimeout(() => setShareStatus(''), 2500);
    return () => clearTimeout(timer);
  }, [shareStatus]);

  const handleShare = async () => {
    if (!product) return;

    const shareData = {
      title: product.name,
      text: `Mira este producto: ${product.name}`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        setShareStatus('Enlace copiado');
        return;
      }

      setShareStatus('No se pudo compartir el enlace');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setShareStatus('No se pudo compartir el enlace');
      }
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-[#E7E7E7] p-6">
        <button
          aria-label="Volver"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-white/50 rounded-full"
        >
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>

        <div className="mt-10">
          <EmptyModule
            icon={PackageX}
            title="Producto no disponible"
            description="No hay un producto cargado en esta ruta. El catálogo de comercios todavía no está conectado al backend."
            notice={NOTICES.categories}
            tone="info"
          >
            <Button fullWidth onClick={() => navigate('/request')}>
              Crear una solicitud de compra
            </Button>
          </EmptyModule>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-24">
      {/* Header Image */}
      <div className="relative h-[50vh] bg-white/70">
        <button
          aria-label="Volver"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-10 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-white/30"
        >
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <button
          onClick={handleShare}
          aria-label="Compartir producto"
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-white/30"
        >
          <Share2 className="w-5 h-5 text-gray-800" />
        </button>

        {shareStatus && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-gray-900/80 text-white text-xs font-medium px-3 py-1.5 rounded-full">
            {shareStatus}
          </div>
        )}

        <SafeImage
          src={product.images?.[0]}
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
              <Star className="w-4 h-4 text-[#006E7A] fill-[#00EED0]" />
              <span className="text-sm font-medium text-gray-800">
                {product.rating ?? 'Sin calificación'}
              </span>
              {product.reviews !== undefined && (
                <span className="text-sm text-gray-600">({product.reviews} reseñas)</span>
              )}
            </div>
          </div>
          <div className="text-2xl font-bold text-[#006E7A]">
            {typeof product.price === 'number' ? `$${product.price.toFixed(2)}` : '—'}
          </div>
        </div>

        <p className="text-gray-600 leading-relaxed mb-6">
          {product.description || 'Sin descripción.'}
        </p>

        {Array.isArray(product.colors) && product.colors.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Posición</h3>
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
        )}

        {Array.isArray(product.sizes) && product.sizes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Marca</h3>
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
        )}

        {/* Store Info */}
        <div className="flex items-center gap-3 p-4 bg-white/70 rounded-xl mb-6 border border-white/30">
          <div className="w-10 h-10 rounded-full bg-[#0197AF]/20 flex items-center justify-center text-xl">
            🏪
          </div>
          <div>
            <p className="text-xs text-gray-600">Vendido por</p>
            <p className="font-bold text-gray-800">{product.store || 'Comercio'}</p>
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
          onClick={() => navigate('/request', { state: { system: product.category, productName: product.name } })}
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          CREAR SOLICITUD
        </Button>
      </div>
    </div>
  );
}
