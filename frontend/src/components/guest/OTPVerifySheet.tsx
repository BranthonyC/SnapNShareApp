import { useState, useEffect, useRef } from 'react';
import { Mail, Phone, ShieldCheck, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import * as api from '@/services/api';
import type { ApiError } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// OTPVerifySheet — Bottom-sheet modal for guest OTP verification.
// Shown inline on the gallery page when an unverified guest taps the upload FAB.
// ---------------------------------------------------------------------------

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-2);
}

type Step = 'email' | 'otp' | 'sms-input' | 'sms-otp';

interface OTPVerifySheetProps {
  eventId: string;
  smsAvailable: boolean;
  onVerified: () => void;
  onClose: () => void;
}

export default function OTPVerifySheet({ eventId, smsAvailable, onVerified, onClose }: OTPVerifySheetProps) {
  const { setVerified } = useAuthStore();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failCount, setFailCount] = useState(0);

  const [expiresIn, setExpiresIn] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (step !== 'otp' && step !== 'sms-otp') return;
    timerRef.current = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [resendCooldown]);

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ---- Send OTP via email ----
  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) { setError('Por favor ingresa tu correo electrónico.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Por favor ingresa un correo electrónico válido.'); return; }

    setIsLoading(true);
    setError('');
    try {
      await api.sendOtp(eventId, { channel: 'email', destination: trimmed });
      setStep('otp');
      setExpiresIn(300);
      setResendCooldown(60);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'No se pudo enviar el código. Intenta más tarde.');
    } finally {
      setIsLoading(false);
    }
  }

  // ---- Verify OTP (email) ----
  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) { setError('Por favor ingresa el código de verificación.'); return; }
    if (trimmedCode.length !== 6) { setError('El código debe tener 6 dígitos.'); return; }

    setIsLoading(true);
    setError('');
    try {
      const res = await api.verifyOtp(eventId, { code: trimmedCode, destination: email.trim() });
      setVerified(res.token);
      onVerified();
    } catch (err) {
      const apiErr = err as ApiError;
      const newFailCount = failCount + 1;
      setFailCount(newFailCount);
      if (apiErr.code === 'OTP_INVALID' || apiErr.status === 401) {
        setError(newFailCount >= 3 ? 'Código incorrecto. Puedes intentar verificarte por SMS.' : 'Código incorrecto. Intenta de nuevo.');
      } else {
        setError(apiErr.message || 'No se pudo verificar. Intenta más tarde.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ---- Send OTP via SMS ----
  async function handleSendSms(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) { setError('Por favor ingresa tu número de teléfono.'); return; }
    const destination = trimmed.startsWith('+') ? trimmed : `+502${trimmed}`;

    setIsLoading(true);
    setError('');
    try {
      await api.sendOtp(eventId, { channel: 'sms', destination });
      setPhone(destination);
      setStep('sms-otp');
      setCode('');
      setExpiresIn(300);
      setResendCooldown(60);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'No se pudo enviar el código por SMS. Intenta más tarde.');
    } finally {
      setIsLoading(false);
    }
  }

  // ---- Verify OTP (SMS) ----
  async function handleVerifySms(e: React.FormEvent) {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) { setError('Por favor ingresa el código de verificación.'); return; }
    if (trimmedCode.length !== 6) { setError('El código debe tener 6 dígitos.'); return; }

    setIsLoading(true);
    setError('');
    try {
      const res = await api.verifyOtp(eventId, { code: trimmedCode, destination: phone });
      setVerified(res.token);
      onVerified();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.code === 'OTP_INVALID' || apiErr.status === 401) {
        setError('Código incorrecto. Intenta de nuevo.');
      } else {
        setError(apiErr.message || 'No se pudo verificar. Intenta más tarde.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ---- Resend handlers ----
  async function handleResendEmail() {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError('');
    try {
      await api.sendOtp(eventId, { channel: 'email', destination: email.trim() });
      setExpiresIn(300);
      setResendCooldown(60);
      setCode('');
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'No se pudo reenviar el código.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendSms() {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError('');
    try {
      await api.sendOtp(eventId, { channel: 'sms', destination: phone });
      setExpiresIn(300);
      setResendCooldown(60);
      setCode('');
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'No se pudo reenviar el código.');
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-modal border border-border-subtle p-6 pb-8 animate-slide-up">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-pill text-secondary hover:text-primary hover:bg-muted focus:outline-none"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-card bg-accent-light">
            <ShieldCheck className="w-6 h-6 text-accent" aria-hidden="true" />
          </span>
        </div>

        {/* ---- Step: email input ---- */}
        {step === 'email' && (
          <>
            <h2 className="font-heading text-xl font-bold text-primary text-center mb-1">
              Verifica tu identidad
            </h2>
            <p className="font-body text-sm text-secondary text-center mb-5">
              Para subir fotos, necesitamos verificar tu correo electrónico.
            </p>

            <form onSubmit={handleSendEmail} noValidate className="space-y-4">
              <Input
                label="Correo electrónico"
                type="email"
                id="sheet-verify-email"
                placeholder="tu@email.com"
                icon={<Mail className="w-4 h-4" aria-hidden="true" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error || undefined}
                autoComplete="email"
                autoFocus
                disabled={isLoading}
              />
              <Button type="submit" variant="primary" size="lg" fullWidth loading={isLoading} disabled={isLoading}>
                {isLoading ? 'Enviando...' : 'Enviar código'}
              </Button>
            </form>
          </>
        )}

        {/* ---- Step: email OTP verification ---- */}
        {step === 'otp' && (
          <>
            <h2 className="font-heading text-xl font-bold text-primary text-center mb-1">
              Revisa tu correo
            </h2>
            <p className="font-body text-sm text-secondary text-center mb-1">
              Enviamos un código de 6 dígitos a
            </p>
            <p className="font-body text-sm font-medium text-primary text-center mb-5">
              {maskEmail(email)}
            </p>

            <form onSubmit={handleVerifyEmail} noValidate className="space-y-4">
              <Input
                label="Código de verificación"
                type="text"
                variant="otp"
                id="sheet-otp-code"
                placeholder="000000"
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(val);
                }}
                error={error || undefined}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                disabled={isLoading}
              />
              <p className="font-body text-xs text-secondary text-center">
                {expiresIn > 0
                  ? `El código expira en ${formatTime(expiresIn)}`
                  : 'El código ha expirado. Solicita uno nuevo.'}
              </p>
              <Button type="submit" variant="primary" size="lg" fullWidth loading={isLoading} disabled={isLoading || expiresIn === 0}>
                {isLoading ? 'Verificando...' : 'Verificar'}
              </Button>
            </form>

            <div className="flex flex-col items-center gap-2 mt-4">
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resendCooldown > 0 || isLoading}
                className={[
                  'font-body text-sm',
                  resendCooldown > 0 || isLoading ? 'text-tertiary cursor-not-allowed' : 'text-accent hover:underline focus:outline-none',
                ].join(' ')}
              >
                {resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : 'Reenviar código'}
              </button>

              {failCount >= 3 && smsAvailable && (
                <button
                  type="button"
                  onClick={() => { setStep('sms-input'); setCode(''); setError(''); }}
                  className="font-body text-sm text-accent hover:underline focus:outline-none"
                >
                  Intentar por SMS
                </button>
              )}

              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                className="font-body text-sm text-secondary hover:text-primary hover:underline focus:outline-none"
              >
                Cambiar correo
              </button>
            </div>
          </>
        )}

        {/* ---- Step: SMS phone input (fallback) ---- */}
        {step === 'sms-input' && (
          <>
            <h2 className="font-heading text-xl font-bold text-primary text-center mb-1">
              Verificación por SMS
            </h2>
            <p className="font-body text-sm text-secondary text-center mb-5">
              Ingresa tu número de teléfono para recibir un código por SMS.
            </p>

            <form onSubmit={handleSendSms} noValidate className="space-y-4">
              <div className="w-full">
                <label htmlFor="sheet-verify-phone" className="block font-body text-xs font-medium text-primary mb-1">
                  Número de teléfono
                </label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3 py-3 border border-border-strong rounded-card bg-muted font-body text-sm text-secondary">
                    +502
                  </span>
                  <Input
                    type="tel"
                    id="sheet-verify-phone"
                    placeholder="1234 5678"
                    icon={<Phone className="w-4 h-4" aria-hidden="true" />}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
                    error={error || undefined}
                    inputMode="tel"
                    autoComplete="tel"
                    autoFocus
                    disabled={isLoading}
                  />
                </div>
              </div>
              <Button type="submit" variant="primary" size="lg" fullWidth loading={isLoading} disabled={isLoading}>
                {isLoading ? 'Enviando...' : 'Enviar código por SMS'}
              </Button>
            </form>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setStep('email'); setPhone(''); setError(''); }}
                className="font-body text-sm text-secondary hover:text-primary hover:underline focus:outline-none"
              >
                Volver a verificación por correo
              </button>
            </div>
          </>
        )}

        {/* ---- Step: SMS OTP verification ---- */}
        {step === 'sms-otp' && (
          <>
            <h2 className="font-heading text-xl font-bold text-primary text-center mb-1">
              Revisa tu teléfono
            </h2>
            <p className="font-body text-sm text-secondary text-center mb-1">
              Enviamos un código de 6 dígitos a
            </p>
            <p className="font-body text-sm font-medium text-primary text-center mb-5">
              {maskPhone(phone)}
            </p>

            <form onSubmit={handleVerifySms} noValidate className="space-y-4">
              <Input
                label="Código de verificación"
                type="text"
                variant="otp"
                id="sheet-sms-otp-code"
                placeholder="000000"
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(val);
                }}
                error={error || undefined}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                disabled={isLoading}
              />
              <p className="font-body text-xs text-secondary text-center">
                {expiresIn > 0
                  ? `El código expira en ${formatTime(expiresIn)}`
                  : 'El código ha expirado. Solicita uno nuevo.'}
              </p>
              <Button type="submit" variant="primary" size="lg" fullWidth loading={isLoading} disabled={isLoading || expiresIn === 0}>
                {isLoading ? 'Verificando...' : 'Verificar'}
              </Button>
            </form>

            <div className="flex flex-col items-center gap-2 mt-4">
              <button
                type="button"
                onClick={handleResendSms}
                disabled={resendCooldown > 0 || isLoading}
                className={[
                  'font-body text-sm',
                  resendCooldown > 0 || isLoading ? 'text-tertiary cursor-not-allowed' : 'text-accent hover:underline focus:outline-none',
                ].join(' ')}
              >
                {resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : 'Reenviar código'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('sms-input'); setCode(''); setError(''); }}
                className="font-body text-sm text-secondary hover:text-primary hover:underline focus:outline-none"
              >
                Cambiar número
              </button>
            </div>
          </>
        )}
      </div>

      {/* Slide-up animation */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
