import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Evita que un error de render deje la app en blanco.
 * Mantiene el estilo glass/neón del resto de la aplicación.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Sin backend de telemetría: se deja rastro en consola para depuración.
    console.error('Error no controlado en la interfaz:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00EED0]/10 via-[#E7E7E7] to-[#4B227A]/10 p-6">
        <div className="w-full max-w-sm bg-white/80 backdrop-blur-md rounded-3xl border border-white/40 shadow-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#4B227A]/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-[#4B227A]" />
          </div>
          <h1 className="text-xl font-black text-gray-800 mb-2">Algo salió mal</h1>
          <p className="text-sm text-gray-600 mb-6">
            La pantalla no se pudo mostrar. Puedes reintentar sin perder tu sesión.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="w-full flex items-center justify-center gap-2 bg-[#00EED0] text-black font-bold py-3.5 px-6 rounded-xl shadow-[0_0_20px_rgba(0,238,208,0.5)] hover:opacity-90 transition-all active:scale-95"
          >
            <RotateCcw className="w-5 h-5" />
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 w-full text-sm font-semibold text-[#0197AF] hover:underline"
          >
            Recargar la aplicación
          </button>
        </div>
      </div>
    );
  }
}
