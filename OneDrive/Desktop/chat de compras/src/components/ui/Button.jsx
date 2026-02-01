import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export default function Button({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className, 
  ...props 
}) {
  const baseStyles = "py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 shadow-sm";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-blue-700 shadow-blue-200",
    secondary: "bg-white text-dark border border-gray-200 hover:bg-gray-50",
    outline: "bg-transparent border-2 border-primary text-primary hover:bg-blue-50",
    ghost: "bg-transparent text-gray-500 hover:text-dark hover:bg-gray-100 shadow-none",
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
