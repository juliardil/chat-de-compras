import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import Logo from '../../components/Logo';

export default function Login() {
  const navigate = useNavigate();
  const { login, mode, resendVerificationCode } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setResent(false);
    setBusy(true);

    try {
      await login({
        email: formData.email.trim(),
        password: formData.password,
        // En modo demo el rol se sigue deduciendo del correo.
        role: formData.email.toLowerCase().includes('shop') ? 'commerce' : 'user',
      });
    } catch (err) {
      const message = err?.message || 'No se pudo iniciar sesión.';
      // InsForge responde 403 cuando el correo aún no está verificado.
      if (err?.statusCode === 403 || /verif/i.test(message)) {
        setNeedsVerification(true);
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setResent(false);
    setError(null);
    try {
      await resendVerificationCode(formData.email.trim());
      setResent(true);
    } catch (err) {
      setError(err?.message || 'No se pudo reenviar el código.');
    }
  };

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col">
      <header className="flex items-center gap-4 mb-8">
        <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
      </header>

      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-10 text-center">
          <Logo size="md" />
          <h2 className="text-xl font-semibold mt-6 text-gray-800">¡Bienvenido de nuevo!</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input 
            label="Correo electrónico" 
            type="email" 
            placeholder="hola@ejemplo.com" 
            icon={Mail}
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
            required
          />
          <Input 
            label="Contraseña" 
            type="password" 
            placeholder="••••••••" 
            icon={Lock}
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
            required
          />

          {error ? (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          ) : null}

          {needsVerification ? (
            <div className="text-sm bg-[#00EED0]/10 border border-[#00EED0]/30 rounded-xl px-4 py-3 space-y-2">
              <p className="text-gray-700">
                Tu correo aún no está verificado. Revisa el código que enviamos a{' '}
                <span className="font-medium">{formData.email}</span> e ingrésalo al registrarte,
                o solicita uno nuevo:
              </p>
              <button
                type="button"
                onClick={handleResend}
                className="text-[#006E7A] font-semibold underline underline-offset-2"
              >
                Reenviar código de verificación
              </button>
              {resent ? (
                <p className="text-xs text-[#006E7A]">Código reenviado. Revisa tu correo.</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Link to="/recover-password" className="text-sm text-primary font-medium hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <Button type="submit" fullWidth className="mt-4" disabled={busy}>
            {busy ? 'INGRESANDO…' : 'INICIAR SESIÓN'}
          </Button>
        </form>
      </div>
      
      <div className="mt-auto py-4 text-center">
        {mode === 'demo' ? (
          <p className="text-xs text-gray-500 mb-2">
            Modo demostración: cualquier correo y contraseña abren una sesión local, sin backend.
          </p>
        ) : null}
        <p className="text-gray-600 text-sm">
          ¿No tienes cuenta? <Link to="/welcome" className="text-primary font-bold">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}
