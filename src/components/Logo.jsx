import React from 'react';
import { ShoppingBag } from 'lucide-react';

export default function Logo({ size = "md", className = "" }) {
  const sizes = {
    sm: "text-xl",
    md: "text-3xl",
    lg: "text-5xl"
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="bg-primary p-3 rounded-2xl mb-2 shadow-lg">
        <ShoppingBag className="text-white w-8 h-8" />
      </div>
      <h1 className={`font-bold tracking-tight text-dark ${sizes[size]}`}>
        Chat <span className="text-primary">Express</span>
      </h1>
    </div>
  );
}
