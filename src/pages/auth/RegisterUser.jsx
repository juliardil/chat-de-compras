import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { User, Mail, Lock, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function RegisterUser() {
  const navigate = useNavigate();
  const { register, confirmRegistration, resendVerificationCode, mode } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    terms: false
  });
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResent(false);
    setBusy(true);

    try {
      const result = await register({
        email: formData.email.trim(),
        password: formData.password,
        name: formData.name.trim(),
        role: 'user',
      });
      // Con InsForge, el alta exige verificar el correo con un código.
      if (result?.verificationRequired) setStep('verify');
    } catch (err) {
      setError(err?.message || 'No se pudo crear la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await confirmRegistration({
        email: formData.email.trim(),
        otp: otp.trim(),
        role: 'user',
      });
    } catch (err) {
      setError(err?.message || 'El código no es válido o expiró.');
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

  const verificationForm = (
    <form onSubmit={handleVerify} className="flex-1 flex flex-col gap-5">
      <div className="bg-[#00EED0]/10 border border-[#00EED0]/30 rounded-xl p-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-[#006E7A] shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700">
          Enviamos un código de 6 dígitos a{' '}
          <span className="font-medium">{formData.email}</span>. Ingrésalo para activar tu cuenta.
        </p>
      </div>

      <Input
        label="Código de verificación"
        placeholder="123456"
        inputMode="numeric"
        maxLength={6}
        value={otp}
        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
        required
      />

      {error ? (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </p>
      ) : null}

      <Button type="submit" fullWidth disabled={busy || otp.length < 6}>
        {busy ? 'VERIFICANDO…' : 'VERIFICAR Y ENTRAR'}
      </Button>

      <button
        type="button"
        onClick={handleResend}
        className="text-sm text-[#006E7A] font-semibold underline underline-offset-2"
      >
        Reenviar código
      </button>
      {resent ? <p className="text-xs text-[#006E7A]">Código reenviado. Revisa tu correo.</p> : null}
    </form>
  );

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col">
      <header className="flex items-center gap-4 mb-8">
        <button aria-label="Volver" onClick={() => navigate('/welcome')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          {step === 'verify' ? 'Verifica tu correo' : 'Crear cuenta'}
        </h1>
      </header>

      {step === 'verify' ? (
        verificationForm
      ) : (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
          <Input 
            label="Nombre completo" 
            placeholder="Ej. Juan Pérez" 
            icon={User}
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            required
          />
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

          <div className="flex items-start gap-3 mt-2">
            <input 
              type="checkbox" 
              id="terms" 
              className="mt-1 w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
              checked={formData.terms}
              onChange={e => setFormData({...formData, terms: e.target.checked})}
              required
            />
            <label htmlFor="terms" className="text-sm text-gray-600 leading-tight">
              Acepto los <a href="#" className="text-primary font-medium">Términos y Condiciones</a> y la Política de Privacidad.
            </label>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          ) : null}

          {mode === 'demo' ? (
            <p className="text-xs text-gray-500">
              Modo demostración: la cuenta se crea en este navegador, sin backend.
            </p>
          ) : null}

          <div className="mt-auto mb-4">
            <Button type="submit" fullWidth disabled={!formData.terms || busy}>
              {busy ? 'CREANDO CUENTA…' : 'REGISTRARME'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
