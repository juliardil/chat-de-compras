import React from 'react';
import SafeImage from './SafeImage';

// Logo reutilizable de negocio/marca. Muestra la imagen cuando hay URL y un
// fallback con iniciales cuando todavía no se ha subido (mismo patrón que los
// avatares de marcas patrocinadoras del club).
const initials = (name) =>
  String(name || 'N')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'N';

export default function BusinessLogo({
  src,
  name = '',
  className = '',
  imageClassName = 'h-full w-full object-cover',
  label,
}) {
  const alt = label || `Logo de ${name || 'negocio'}`;
  const base = `flex shrink-0 items-center justify-center overflow-hidden ${className}`;

  if (!src) {
    return (
      <span className={base} role="img" aria-label={alt}>
        {initials(name)}
      </span>
    );
  }

  return (
    <span className={base}>
      <SafeImage src={src} alt={alt} className={imageClassName} />
    </span>
  );
}
