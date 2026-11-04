import React, { useEffect, useState } from 'react';
import placeholder from '../../assets/image-placeholder.svg';

/**
 * Imagen con fallback local.
 * Si la URL remota falla (o llega vacía), muestra un placeholder en lugar de un hueco roto.
 */
export default function SafeImage({ src, alt = '', className, fallback = placeholder, ...props }) {
  const [failed, setFailed] = useState(false);

  // Si cambia la fuente (p. ej. nueva foto de perfil), reintenta cargarla.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const finalSrc = !src || failed ? fallback : src;

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}
