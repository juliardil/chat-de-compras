import React, { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import BusinessLogo from '../ui/BusinessLogo';
import { LOGO_NOTICES, saveCommerceLogo, saveWorkshopLogo, uploadLogo } from '../../data/businessLogos';

// Selector de logo de negocio. Usa exactamente el mismo flujo que «Cambiar
// foto»: valida con validateProfilePhoto (JPG/PNG/WEBP/GIF, máx. 5 MB), sube al
// bucket público `avatars` y guarda la URL con una RPC que verifica propiedad.
export default function WorkshopLogoUpload({
  userId,
  scope = 'workshop',
  name = '',
  logoUrl = null,
  onSaved,
  shape = 'rounded-2xl',
}) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(logoUrl || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setPreview(logoUrl || null);
  }, [logoUrl]);

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const upload = await uploadLogo({ userId, scope, file });
      if (upload.error) {
        setError(upload.error);
        return;
      }

      // La vista previa se muestra en cuanto se selecciona la imagen.
      setPreview(upload.url);

      if (upload.demo) {
        setNotice('Modo demostración: vista previa local, sin guardar en el backend.');
        onSaved?.(upload.url);
        return;
      }

      const saved =
        scope === 'commerce' ? await saveCommerceLogo(upload.url) : await saveWorkshopLogo(upload.url);
      if (saved.error) {
        setError(saved.error);
        return;
      }

      setNotice('Logo actualizado.');
      onSaved?.(upload.url);
    } catch (err) {
      setError(err?.message || LOGO_NOTICES.save);
    } finally {
      setBusy(false);
    }
  };

  const sizeClass = shape === 'rounded-full' ? 'h-16 w-16' : 'h-16 w-20';
  const scopeLabel = scope === 'commerce' ? 'del comercio' : 'del taller';

  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#4B227A]/15 bg-white/70 p-3">
      <div className="relative shrink-0">
        <BusinessLogo
          src={preview}
          name={name}
          label={`Logo ${scopeLabel}`}
          className={`${sizeClass} ${shape} border-2 border-white bg-[#4B227A]/10 text-sm font-bold text-[#4B227A] shadow-sm`}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={preview ? `Cambiar logo ${scopeLabel}` : `Subir logo ${scopeLabel}`}
          className="absolute -bottom-1 -right-1 rounded-full bg-[#00EED0] p-1.5 text-gray-800 shadow-md border-2 border-white hover:bg-[#00EED0]/90 disabled:opacity-60"
        >
          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-800">
          {busy ? 'Subiendo logo…' : preview ? 'Cambiar logo' : `Subir logo ${scopeLabel}`}
        </p>
        <p className="mt-0.5 text-[10px] text-gray-500">JPG, PNG, WEBP o GIF · máx. 5 MB</p>
        {error ? (
          <p role="alert" className="mt-1 text-[11px] font-medium text-red-700">{error}</p>
        ) : null}
        {notice && !error ? (
          <p role="status" className="mt-1 text-[11px] font-medium text-[#006E7A]">{notice}</p>
        ) : null}
      </div>
    </div>
  );
}
