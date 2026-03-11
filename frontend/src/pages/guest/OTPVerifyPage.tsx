import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mail, Phone, ShieldCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import * as api from '@/services/api';
import type { ApiError } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useEvent } from '@/hooks/useEvent';

// ---------------------------------------------------------------------------
// OTPVerifyPage — /e/:eventId/verify
// Email-first OTP flow for guest upload verification.
// After 3 failed email OTP attempts, SMS fallback is offered.
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

export default function OTPVerifyPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, verified, setVerified } = useAuthStore();
  const { data: event } = useEvent(eventId);

  // SMS OTP is only available for premium events with smsOtp enabled by host
  const smsAvailable = event?.tier === 'premium' && (event as any).smsOtp === true;

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failCount, setFailCount] = useState(0);

  // OTP timer (5 min countdown)
  const [expiresIn, setExpiresIn] = useState(300);
  // Resend cooldown (60s)
  const [resendCooldown, setResendCooldown] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auth guard: redirect if not authenticated or already verified
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate(`/e/${eventId}`, { replace: true });
    } else if (verified) {
      navigate(`/e/${eventId}/upload`, { replace: true });
    }
  }, [isAuthenticated, verified, eventId, navigate]);

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

  // ---------------------------------------------------------------------------
  // Step 1 — Send OTP via email
  // ---------------------------------------------------------------------------
  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Por favor ingresa tu correo electrónico.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Por favor ingresa un correo electrónico válido.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.sendOtp(eventId!, { channel: 'email', destination: trimmed });
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

  // ---------------------------------------------------------------------------
  // Step 2 — Verify OTP (email)
  // ---------------------------------------------------------------------------
  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError('Por favor ingresa el código de verificación.');
      return;
    }
    if (trimmedCode.length !== 6) {
      setError('El código debe tener 6 dígitos.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await api.verifyOtp(eventId!, { code: trimmedCode, destination: email.trim() });
      setVerified(res.token);
      navigate(`/e/${eventId}/upload`, { replace: true });
    } catch (err) {
      const apiErr = err as ApiError;
      const newFailCount = failCount + 1;
      setFailCount(newFailCount);

      if (apiErr.code === 'OTP_INVALID' || apiErr.status === 401) {
        setError(
          newFailCount >= 3
            ? 'Código incorrecto. Puedes intentar verificarte por SMS.'
            : 'Código incorrecto. Intenta de nuevo.',
        );
      } else {
        setError(apiErr.message || 'No se pudo verificar. Intenta más tarde.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // SMS fallback — Send OTP via SMS
  // ---------------------------------------------------------------------------
  async function handleSendSms(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) {
      setError('Por favor ingresa tu número de teléfono.');
      return;
    }
    // Prepend +502 if the user didn't include a country code
    const destination = trimmed.startsWith('+') ? trimmed : `+502${trimmed}`;

    setIsLoading(true);
    setError('');

    try {
      await api.sendOtp(eventId!, { channel: 'sms', destination });
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

  // ---------------------------------------------------------------------------
  // SMS fallback — Verify OTP (SMS)
  // ---------------------------------------------------------------------------
  async function handleVerifySms(e: React.FormEvent) {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError('Por favor ingresa el código de verificación.');
      return;
    }
    if (trimmedCode.length !== 6) {
      setError('El código debe tener 6 dígitos.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await api.verifyOtp(eventId!, { code: trimmedCode, destination: phone });
      setVerified(res.token);
      navigate(`/e/${eventId}/upload`, { replace: true });
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

  // ---------------------------------------------------------------------------
  // Resend handlers
  // ---------------------------------------------------------------------------
  async function handleResendEmail() {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError('');
    try {
      await api.sendOtp(eventId!, { channel: 'email', destination: email.trim() });
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
      await api.sendOtp(eventId!, { channel: 'sms', destination: phone });
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
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-card rounded-card shadow-card border border-border-subtle p-8">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-card bg-accent-light">
            <ShieldCheck className="w-7 h-7 text-accent" aria-hidden="true" />
          </span>
        </div>

        {/* ---- Step: email input ---- */}
        {step === 'email' && (
          <>
            <h1 className="font-heading text-2xl font-bold text-primary text-center mb-1">
              Verifica tu identidad para subir fotos
            </h1>
            <p className="font-body text-sm text-secondary text-center mb-6">
              Te enviaremos un código de verificación a tu correo.
            </p>

            <form onSubmit={handleSendEmail} noValidate className="space-y-4">
              <Input
                label="Correo electrónico"
                type="email"
                id="verify-email"
                placeholder="tu@email.com"
                icon={<Mail className="w-4 h-4" aria-hidden="true" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error || undefined}
                autoComplete="email"
                autoFocus
                disabled={isLoading}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Enviando...' : 'Enviar código'}
              </Button>
            </form>

            {/* Back to gallery */}
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => navigate(`/e/${eventId}/gallery`)}
                className="font-body text-sm text-secondary hover:text-primary hover:underline focus:outline-none"
              >
                Volver a la galería
              </button>
            </div>
          </>
        )}

        {/* ---- Step: email OTP verification ---- */}
        {step === 'otp' && (
          <>
            <h1 className="font-heading text-2xl font-bold text-primary text-center mb-1">
              Revisa tu correo
            </h1>
            <p className="font-body text-sm text-secondary text-center mb-1">
              Enviamos un código de 6 dígitos a
            </p>
            <p className="font-body text-sm font-medium text-primary text-center mb-6">
              {maskEmail(email)}
            </p>

            <form onSubmit={handleVerifyEmail} noValidate className="space-y-4">
              <Input
                label="Código de verificación"
                type="text"
                variant="otp"
                id="otp-code"
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

              {/* Timer */}
              <p className="font-body text-xs text-secondary text-center">
                {expiresIn > 0
                  ? `El código expira en ${formatTime(expiresIn)}`
                  : 'El código ha expirado. Solicita uno nuevo.'}
              </p>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
                disabled={isLoading || expiresIn === 0}
              >
                {isLoading ? 'Verificando...' : 'Verificar'}
              </Button>
            </form>

            {/* Resend link */}
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resendCooldown > 0 || isLoading}
                className={[
                  'font-body text-sm',
                  resendCooldown > 0 || isLoading
                    ? 'text-tertiary cursor-not-allowed'
                    : 'text-accent hover:underline focus:outline-none',
                ].join(' ')}
              >
                {resendCooldown > 0
                  ? `Reenviar código (${resendCooldown}s)`
                  : 'Reenviar código'}
              </button>
            </div>

            {/* SMS fallback — only after 3 failures and if event supports SMS OTP */}
            {failCount >= 3 && smsAvailable && (
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('sms-input');
                    setCode('');
                    setError('');
                  }}
                  className="font-body text-sm text-accent hover:underline focus:outline-none"
                >
                  Intentar por SMS
                </button>
              </div>
            )}

            {/* Change email */}
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setError('');
                }}
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
            <h1 className="font-heading text-2xl font-bold text-primary text-center mb-1">
              Verificación por SMS
            </h1>
            <p className="font-body text-sm text-secondary text-center mb-6">
              Ingresa tu número de teléfono para recibir un código por SMS.
            </p>

            <form onSubmit={handleSendSms} noValidate className="space-y-4">
              <div className="w-full">
                <label
                  htmlFor="verify-phone"
                  className="block font-body text-xs font-medium text-primary mb-1"
                >
                  Número de teléfono
                </label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3 py-3 border border-border-strong rounded-card bg-muted font-body text-sm text-secondary">
                    +502
                  </span>
                  <Input
                    type="tel"
                    id="verify-phone"
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

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Enviando...' : 'Enviar código por SMS'}
              </Button>
            </form>

            {/* Back to email */}
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setPhone('');
                  setError('');
                }}
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
            <h1 className="font-heading text-2xl font-bold text-primary text-center mb-1">
              Revisa tu teléfono
            </h1>
            <p className="font-body text-sm text-secondary text-center mb-1">
              Enviamos un código de 6 dígitos a
            </p>
            <p className="font-body text-sm font-medium text-primary text-center mb-6">
              {maskPhone(phone)}
            </p>

            <form onSubmit={handleVerifySms} noValidate className="space-y-4">
              <Input
                label="Código de verificación"
                type="text"
                variant="otp"
                id="sms-otp-code"
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

              {/* Timer */}
              <p className="font-body text-xs text-secondary text-center">
                {expiresIn > 0
                  ? `El código expira en ${formatTime(expiresIn)}`
                  : 'El código ha expirado. Solicita uno nuevo.'}
              </p>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
                disabled={isLoading || expiresIn === 0}
              >
                {isLoading ? 'Verificando...' : 'Verificar'}
              </Button>
            </form>

            {/* Resend link */}
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={handleResendSms}
                disabled={resendCooldown > 0 || isLoading}
                className={[
                  'font-body text-sm',
                  resendCooldown > 0 || isLoading
                    ? 'text-tertiary cursor-not-allowed'
                    : 'text-accent hover:underline focus:outline-none',
                ].join(' ')}
              >
                {resendCooldown > 0
                  ? `Reenviar código (${resendCooldown}s)`
                  : 'Reenviar código'}
              </button>
            </div>

            {/* Change phone */}
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('sms-input');
                  setCode('');
                  setError('');
                }}
                className="font-body text-sm text-secondary hover:text-primary hover:underline focus:outline-none"
              >
                Cambiar número
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
