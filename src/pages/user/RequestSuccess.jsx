import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Search, Store, Tags } from 'lucide-react';
import Button from '../../components/ui/Button';

// Confirmación posterior a una publicación exitosa.
// Solo se llega aquí cuando createPurchaseRequest devolvió ok; la solicitud ya
// quedó guardada en InsForge y sus ofertas seguirán apareciendo en /offers.
export default function RequestSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const products = Array.isArray(location.state?.products) ? location.state.products : [];
  const publishedProduct = products[0]?.item || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00EED0]/10 via-[#E7E7E7] to-[#4B227A]/10 px-4 py-10 flex items-center justify-center">
      <section className="w-full max-w-md bg-white/80 backdrop-blur-md rounded-3xl border border-white/30 shadow-xl p-6 sm:p-8 text-center">
        <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#00EED0]/40 to-[#4B227A]/30 border border-white/40">
          <Store className="h-9 w-9 text-[#006E7A]" aria-hidden="true" />
          <span className="absolute -bottom-1 -right-1 rounded-full bg-[#00EED0] p-1 border-2 border-white">
            <CheckCircle2 className="h-4 w-4 text-[#4B227A]" aria-hidden="true" />
          </span>
        </div>

        <h1 className="text-2xl font-black text-gray-800 leading-tight">
          ¡Tu solicitud está en camino!
        </h1>

        <p className="mt-2 text-base font-semibold text-[#006E7A]">
          Los comercios están revisando tu pedido.
        </p>

        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Pronto podrás recibir sus propuestas. Mantente pendiente de tu bandeja de
          Ofertas para conocer los precios y opciones que tienen para ti.
        </p>

        {publishedProduct ? (
          <p className="mt-4 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-gray-700 border border-white/40">
            <Store className="h-3.5 w-3.5 shrink-0 text-[#006E7A]" aria-hidden="true" />
            <span className="truncate">Publicaste: {publishedProduct}</span>
          </p>
        ) : null}

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#0197AF]/25 bg-[#0197AF]/10 p-4 text-left">
          <Tags className="mt-0.5 h-5 w-5 shrink-0 text-[#006E7A]" aria-hidden="true" />
          <p className="text-sm font-medium text-[#006E7A]">
            Entra en la sección Ofertas y consulta las propuestas que recibas.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Button fullWidth onClick={() => navigate('/categories')}>
            <Search className="h-5 w-5" aria-hidden="true" />
            Buscar otro producto
          </Button>
          <Button variant="secondary" fullWidth onClick={() => navigate('/offers')}>
            <Tags className="h-5 w-5" aria-hidden="true" />
            Ver mis ofertas
          </Button>
        </div>
      </section>
    </div>
  );
}
