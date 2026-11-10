import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Mail, Lock, ArrowLeft, CheckCircle, ShieldCheck } from 'lucide-react';

// Flujo real de recuperación con InsForge (método por código):
// 1. El correo recibe un código de 6 dígitos.
// 2. El código se canjea por un token temporal.
// 3. El token + la nueva contraseña cierran el cambio.
// En modo demostración se muestra la confirmación simulada original.
export default function RecoverPassword() {
  const navigate = useNavigate();
  const { requestPasswordReset, confirmPasswordReset, completePasswordReset, mode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'reset' | 'sent' | 'done'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    if (mode === 'demo') {
      setStep('sent');
      setBusy(false);
      return;
    }

    try {
      await requestPasswordReset(email.trim());
      setStep(mode === 'demo' ? 'sent' : 'reset');
    } catch (err) {
      setError(err?.message || 'No se pudo enviar el código.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const token = await confirmPasswordReset({ email: email.trim(), code: code.trim() });
      await completePasswordReset({ newPassword, otp: token });
      setStep('done');
    } catch (err) {
      setError(err?.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'sent') {
    return (
      <div className="min-h-screen bg-white p-6 flex flex-col">
        <header className="flex items-center gap-4 mb-8">
          <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-dark" />
          </button>
          <h1 className="text-xl font-bold text-dark">Recuperar contraseña</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">¡Correo enviado!</h2>
          <p className="text-gray-600 mb-8">
            Hemos enviado las instrucciones para recuperar tu contraseña a <span className="font-medium text-dark">{email}</span>
          </p>
          <Button fullWidth variant="secondary" onClick={() => navigate('/login')}>
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-white p-6 flex flex-col">
        <header className="flex items-center gap-4 mb-8">
          <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-dark" />
          </button>
          <h1 className="text-xl font-bold text-dark">Recuperar contraseña</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">¡Contraseña actualizada!</h2>
          <p className="text-gray-600 mb-8">Ya puedes iniciar sesión con tu nueva contraseña.</p>
          <Button fullWidth variant="secondary" onClick={() => navigate('/login')}>
            Ir a iniciar sesión
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <div className="min-h-screen bg-white p-6 flex flex-col">
        <header className="flex items-center gap-4 mb-8">
          <button aria-label="Volver" onClick={() => setStep('email')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-dark" />
          </button>
          <h1 className="text-xl font-bold text-dark">Restablecer contraseña</h1>
        </header>

        <form onSubmit={handleReset} className="flex-1 flex flex-col gap-6">
          <div className="bg-[#00EED0]/10 border border-[#00EED0]/30 rounded-xl p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-[#006E7A] shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              Ingresa el código de 6 dígitos que enviamos a{' '}
              <span className="font-medium">{email}</span> y define tu nueva contraseña.
            </p>
          </div>

          <Input
            label="Código de verificación"
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          <Input
            label="Nueva contraseña"
            type="password"
            placeholder="••••••••"
            icon={Lock}
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            minLength={6}
          />

          {error ? (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          ) : null}

          <Button type="submit" fullWidth disabled={busy || code.length < 6 || newPassword.length < 6}>
            {busy ? 'GUARDANDO…' : 'CAMBIAR CONTRASEÑA'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col">
      <header className="flex items-center gap-4 mb-8">
        <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-dark" />
        </button>
        <h1 className="text-xl font-bold text-dark">Recuperar contraseña</h1>
      </header>

      <form onSubmit={handleSendCode} className="flex-1 flex flex-col gap-6">
        <p className="text-gray-600">
          Ingresa el correo electrónico asociado a tu cuenta y te enviaremos un código para
          restablecer tu contraseña.
        </p>
        
        <Input 
          label="Correo electrónico" 
          type="email" 
          placeholder="hola@ejemplo.com" 
          icon={Mail}
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />

        {error ? (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </p>
        ) : null}

        {mode === 'demo' ? (
          <p className="text-xs text-gray-500">
            Modo demostración: no se envía ningún correo porque no hay backend conectado.
          </p>
        ) : null}

        <Button type="submit" fullWidth className="mt-4" disabled={busy}>
          {busy ? 'ENVIANDO…' : 'ENVIAR INSTRUCCIONES'}
        </Button>
      </form>
    </div>
  );
}
