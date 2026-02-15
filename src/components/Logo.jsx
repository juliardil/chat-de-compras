import React from 'react';

export default function Logo({ size = "md", className = "" }) {
  const sizes = {
    sm: "w-12 h-12",
    md: "w-24 h-24",
    lg: "w-32 h-32"
  };

  const textSizes = {
    sm: "text-xl",
    md: "text-3xl",
    lg: "text-5xl"
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`${sizes[size]} relative mb-2 drop-shadow-xl filter`}>
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Main Bubble Shape */}
          <path 
            d="M50 5C25.1472 5 5 25.1472 5 50C5 68.3 15.9 84.1 31.6 91L26 102L42.5 94.2C44.9 94.7 47.4 95 50 95C74.8528 95 95 74.8528 95 50C95 25.1472 74.8528 5 50 5Z" 
            fill="#2563EB" 
            stroke="white" 
            strokeWidth="4"
          />
          {/* Lightning Bolt */}
          <path 
            d="M58 22L36 52H52L44 82L68 46H52L58 22Z" 
            fill="#FACC15" 
            stroke="white" 
            strokeWidth="2" 
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 className={`font-bold tracking-tight text-dark ${textSizes[size]}`}>
        Chat <span className="text-primary">Express</span>
      </h1>
    </div>
  );
}
