import React from 'react';
import Logo from '../components/Logo';
import { Loader2 } from 'lucide-react';

export default function Splash() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-[-20%] left-[-20%] w-64 h-64 bg-green-100 rounded-full blur-3xl opacity-50" />

      <div className="z-10 flex flex-col items-center gap-8">
        <Logo size="lg" />
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    </div>
  );
}
