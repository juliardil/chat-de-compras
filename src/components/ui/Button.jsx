
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Actualización estética Junio 2026
export default function Button({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className, 
  ...props 
}) {
  const baseStyles = "py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-[#00EED0] text-black hover:opacity-90 shadow-[0_0_20px_rgba(0,238,208,0.5)]",
    secondary: "bg-white/70 backdrop-blur-md text-gray-800 border border-[#4B227A]/30 hover:bg-white/90",
    outline: "bg-transparent border-2 border-[#0197AF] text-[#0197AF] hover:bg-[#0197AF]/10",
    ghost: "bg-transparent text-gray-600 hover:text-gray-800 hover:bg-white/50 shadow-none",
    danger: "bg-red-500 text-white hover:bg-red-600"
  };

  return (
    <button 
      className={twMerge(
        baseStyles, 
        variants[variant], 
        fullWidth ? "w-full" : "",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

