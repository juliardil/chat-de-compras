
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, CheckCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuth } from '../../context/auth-context';

// Cambio de contraseña conectado al backend. InsForge no expone un cambio
// directo con contraseña actual: el flujo real envía un código al correo de
// la cuenta (igual que la recuperación) y la nueva contraseña se aplica tras
// canjearlo. En modo demo se conserva la confirmación simulada original.
export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, mode, requestPasswordReset, confirmPasswordReset, completePasswordReset } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('form'); // 'form' | 'code' | 'done'
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const validate = () => {
    const nextErrors = {};

    if (formData.newPassword.length < 8) {
      nextErrors.newPassword = 'La nueva contraseña debe tener al menos 8 caracteres.';
    }

    if (formData.confirmPassword !== formData.newPassword) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    // Modo demo: no hay backend, se conserva la confirmación simulada.
    if (mode === 'demo') {
      setStep('done');
      return;
    }

    setBusy(true);
    try {
      // El código llega al correo de la cuenta autenticada.
      await requestPasswordReset(user?.email);
      setStep('code');
    } catch (err) {
      setServerError(err?.message || 'No se pudo enviar el código.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setServerError(null);
    setBusy(true);

    try {
      const token = await confirmPasswordReset({ email: user?.email, code: otp.trim() });
      await completePasswordReset({ newPassword: formData.newPassword, otp: token });
      setStep('done');
    } catch (err) {
      setServerError(err?.message || 'El código no es válido o expiró.');
    } finally {
      setBusy(false);
    }
  };

  const errorBanner = serverError ? (
    <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
      {serverError}
    </p>
  ) : null;

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[#E7E7E7] p-6 flex flex-col">
        <header className="flex items-center gap-4 mb-8">
          <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">Cambiar contraseña</h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 bg-[#00EED0]/20 rounded-full flex items-center justify-center mb-6 border border-[#00EED0]/30">
            <CheckCircle className="w-8 h-8 text-[#4B227A]" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">¡Contraseña actualizada!</h2>
          <p className="text-gray-600 mb-8">
            {mode === 'demo'
              ? 'Modo demostración: la contraseña no se cambió en ningún servidor.'
              : 'Tu contraseña ha sido modificada exitosamente.'}
          </p>
          <Button fullWidth onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <div className="min-h-screen bg-[#E7E7E7] p-6 flex flex-col">
        <header className="flex items-center gap-4 mb-8">
          <button aria-label="Volver" onClick={() => setStep('form')} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">Confirmar cambio</h1>
        </header>

        <form onSubmit={handleVerify} className="flex-1 flex flex-col gap-4">
          <div className="bg-[#00EED0]/10 border border-[#00EED0]/30 rounded-xl p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-[#006E7A] shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              Enviamos un código de 6 dígitos a{' '}
              <span className="font-medium">{user?.email}</span>. Ingrésalo para confirmar tu
              nueva contraseña.
            </p>
          </div>

          <Input
            label="Código de verificación"
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            required
          />

          {errorBanner}

          <Button type="submit" fullWidth disabled={busy || otp.length < 6}>
            {busy ? 'CONFIRMANDO…' : 'CONFIRMAR CAMBIO'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E7E7E7] p-6 flex flex-col">
      <header className="flex items-center gap-4 mb-8">
        <button aria-label="Volver" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Cambiar contraseña</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
        <div className="bg-[#00EED0]/10 border border-[#00EED0]/30 rounded-xl p-4 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-[#006E7A] shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700">
            Por seguridad, te enviaremos un código a tu correo{' '}
            <span className="font-medium">{user?.email || '—'}</span> para confirmar el cambio.
          </p>
        </div>

        <Input 
          label="Nueva contraseña" 
          type={showPassword ? "text" : "password"}
          name="newPassword"
          placeholder="••••••••" 
          icon={Lock}
          value={formData.newPassword}
          onChange={handleChange}
          error={errors.newPassword}
          required
        />

        <Input 
          label="Confirmar nueva contraseña" 
          type={showPassword ? "text" : "password"}
          name="confirmPassword"
          placeholder="••••••••" 
          icon={Lock}
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          required
        />

        <button 
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#4B227A] self-start mt-2"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
        </button>

        {errorBanner}

        {mode === 'demo' ? (
          <p className="text-xs text-gray-500">
            Modo demostración: el cambio se simula, no se guarda en ningún servidor.
          </p>
        ) : null}

        <div className="mt-auto">
          <Button type="submit" fullWidth disabled={busy}>
            {busy ? 'ENVIANDO CÓDIGO…' : 'ACTUALIZAR CONTRASEÑA'}
          </Button>
        </div>
      </form>
    </div>
  );
}
