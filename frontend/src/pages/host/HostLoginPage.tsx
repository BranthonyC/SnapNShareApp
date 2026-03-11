import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import * as api from '@/services/api';
import type { HostVerifyResponse } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// HostLoginPage — /auth/host
// Two-step flow: email -> OTP code verification
// ---------------------------------------------------------------------------

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}@${domain}`;
}

export default function HostLoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role, setHostAuth } = useAuthStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // OTP timer (10 min countdown)
  const [expiresIn, setExpiresIn] = useState(600);
  // Resend cooldown (60s)
  const [resendCooldown, setResendCooldown] = useState(0);

  // Events from verify response (for multi-event selector)
  const [events, setEvents] = useState<HostVerifyResponse['events']>([]);
  const [showSelector, setShowSelector] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect if already authenticated as host → go to their dashboard
  const storedEventId = useAuthStore((s) => s.eventId);
  useEffect(() => {
    if (isAuthenticated() && role === 'host' && storedEventId) {
      navigate(`/e/${storedEventId}/admin`, { replace: true });
    }
  }, [isAuthenticated, role, storedEventId, navigate]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (step !== 2) return;
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

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Por favor ingresa tu correo electrónico.');
      return;
    }
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Por favor ingresa un correo electrónico válido.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.hostLogin(trimmed);
      setStep(2);
      setExpiresIn(600);
      setResendCooldown(60);
    } catch (err) {
      const apiErr = err as api.ApiError;
      setError(apiErr.message || 'No se pudo enviar el código. Intenta más tarde.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
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
      const res = await api.hostVerify(email.trim(), trimmedCode);

      if (res.events.length === 1 && res.events[0]) {
        const firstEvent = res.events[0];
        setHostAuth(res.token, firstEvent.eventId);
        navigate(`/e/${firstEvent.eventId}/admin`, { replace: true });
      } else if (res.events.length > 1) {
        setHostAuth(res.token);
        setEvents(res.events);
        setShowSelector(true);
      } else {
        // No events — go to create
        navigate('/create', { replace: true });
      }
    } catch (err) {
      const apiErr = err as api.ApiError;
      const msg =
        apiErr.status === 401 || apiErr.code === 'INVALID_CODE'
          ? 'Código incorrecto. Intenta de nuevo.'
          : apiErr.message || 'No se pudo verificar. Intenta más tarde.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError('');

    try {
      await api.hostLogin(email.trim());
      setExpiresIn(600);
      setResendCooldown(60);
      setCode('');
    } catch (err) {
      const apiErr = err as api.ApiError;
      setError(apiErr.message || 'No se pudo reenviar el código.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelectEvent(selectedEventId: string) {
    localStorage.setItem('ea:host:eventId', selectedEventId);
    useAuthStore.setState({ eventId: selectedEventId });
    navigate(`/e/${selectedEventId}/admin`, { replace: true });
  }

  // Event selector screen
  if (showSelector) {
    return (
      <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm bg-card rounded-card shadow-card border border-border-subtle p-8">
          <h1 className="font-heading text-2xl font-bold text-primary text-center mb-2">
            Selecciona un evento
          </h1>
          <p className="font-body text-sm text-secondary text-center mb-6">
            Tienes varios eventos. Elige cuál deseas administrar.
          </p>
          <div className="space-y-3">
            {events.map((ev) => (
              <button
                key={ev.eventId}
                type="button"
                onClick={() => handleSelectEvent(ev.eventId)}
                className={[
                  'w-full text-left px-4 py-3 rounded-card border border-border-subtle',
                  'bg-white hover:bg-muted transition-colors duration-150',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                ].join(' ')}
              >
                <span className="font-heading text-base font-semibold text-primary block">
                  {ev.title}
                </span>
                <span className="font-body text-xs text-secondary">
                  Estado: {ev.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-card rounded-card shadow-card border border-border-subtle p-8">
        {/* Logo / Icon */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-card bg-accent-light">
            <ShieldCheck className="w-7 h-7 text-accent" aria-hidden="true" />
          </span>
        </div>

        {step === 1 ? (
          <>
            <h1 className="font-heading text-2xl font-bold text-primary text-center mb-1">
              Inicia sesión como organizador
            </h1>
            <p className="font-body text-sm text-secondary text-center mb-6">
              Te enviaremos un código de verificación a tu correo.
            </p>

            <form onSubmit={handleSendCode} noValidate className="space-y-4">
              <Input
                label="Correo electrónico"
                type="email"
                id="host-email"
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
          </>
        ) : (
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

            <form onSubmit={handleVerify} noValidate className="space-y-4">
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
                onClick={handleResend}
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

            {/* Back to step 1 */}
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
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
      </div>
    </div>
  );
}
