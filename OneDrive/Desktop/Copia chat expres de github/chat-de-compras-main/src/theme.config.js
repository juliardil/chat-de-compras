
// Archivo de configuración de temas - Junio 2026
// Centraliza bordes, sombras, colores y estilos para mantener coherencia visual
// Actualización estética Junio 2026

// Redondeos (border-radius) - Junio 2026
export const BORDER_RADIUS = {
  xsmall: 'rounded-lg',
  small: 'rounded-xl',
  medium: 'rounded-2xl',
  large: 'rounded-[24px]',
  xlarge: 'rounded-[28px]',
  xxlarge: 'rounded-[32px]',
  full: 'rounded-full'
};

// Sombras (box-shadow) - Junio 2026
export const SHADOWS = {
  subtle: 'shadow-sm',
  medium: 'shadow-md',
  large: 'shadow-lg',
  xlarge: 'shadow-xl',
  glow: 'shadow-[0_0_20px_rgba(0,238,208,0.5)]'
};

// Colores base - Junio 2026
// Actualización estética Junio 2026
export const COLORS = {
  primary: 'bg-primary',
  primaryText: 'text-primary',
  success: 'bg-green-600',
  successText: 'text-green-600',
  warning: 'bg-yellow-50',
  warningText: 'text-yellow-700',
  danger: 'bg-red-500',
  dangerText: 'text-red-500',
  background: 'bg-[#E7E7E7]',
  backgroundLight: 'bg-[#E7E7E7]/50',
  // Nuevos colores - Actualización estética Junio 2026
  deepPurple: 'bg-[#4B227A]',
  deepPurpleText: 'text-[#4B227A]',
  steelBlue: 'bg-[#0197AF]',
  steelBlueText: 'text-[#0197AF]',
  neonMint: 'bg-[#00EED0]',
  neonMintText: 'text-[#00EED0]',
  glass: 'bg-white/70'
};

// Transiciones - Junio 2026
export const TRANSITIONS = {
  default: 'transition-all duration-200',
  smooth: 'transition-all duration-300',
  slow: 'transition-all duration-500'
};

// Espaciados - Junio 2026
export const SPACING = {
  xsmall: 'p-1.5',
  small: 'p-2',
  medium: 'p-3',
  large: 'p-4',
  xlarge: 'p-6'
};

// Configuración unificada para componentes - Junio 2026
// Actualización estética Junio 2026
export const THEME = {
  // Botones
  button: {
    base: `${SPACING.medium} px-6 ${BORDER_RADIUS.small} font-semibold ${TRANSITIONS.default} active:scale-95 flex items-center justify-center gap-2`,
    primary: `${COLORS.neonMint} text-black hover:opacity-90 ${SHADOWS.glow}`,
    secondary: `${COLORS.glass} text-dark border border-[#4B227A]/30 hover:bg-white/90 backdrop-blur-md`,
    success: `${COLORS.success} text-white hover:bg-green-700 shadow-green-200`
  },
  // Tarjetas
  card: {
    base: `${COLORS.glass} backdrop-blur-md ${BORDER_RADIUS.large} ${SHADOWS.subtle} border border-white/30 overflow-hidden`,
    glass: 'backdrop-blur-md bg-white/70'
  },
  // Inputs
  input: {
    base: `bg-white/80 backdrop-blur-md border border-[#4B227A]/30 ${BORDER_RADIUS.small} px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0197AF]/30 focus:border-[#0197AF] ${TRANSITIONS.default}`
  }
};

export default THEME;
