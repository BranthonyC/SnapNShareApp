import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, User, Camera } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import * as api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// EventEntryPage — /e/:eventId
// Guests enter the event password (and optional nickname) to access the gallery.
// ---------------------------------------------------------------------------

export default function EventEntryPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const { isAuthenticated, eventId: storedEventId, setGuestAuth } = useAuthStore();

  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Redirect if already authenticated for this event
  useEffect(() => {
    if (isAuthenticated() && storedEventId === eventId) {
      navigate(`/e/${eventId}/gallery`, { replace: true });
    }
  }, [isAuthenticated, storedEventId, eventId, navigate]);

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId) return;

    if (!password.trim()) {
      setError('Por favor ingresa la contraseña del evento.');
      triggerShake();
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await api.authEvent(eventId, {
        password: password.trim(),
        nickname: nickname.trim() || undefined,
      });

      setGuestAuth(res.token, eventId, res.nickname, res.verified);
      navigate(`/e/${eventId}/gallery`, { replace: true });
    } catch (err) {
      const apiErr = err as api.ApiError;
      const msg =
        apiErr.status === 401 || apiErr.code === 'INVALID_PASSWORD'
          ? 'Contraseña incorrecta. Intenta de nuevo.'
          : apiErr.message || 'Ocurrió un error. Intenta más tarde.';
      setError(msg);
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 py-12">
      {/* Card container */}
      <div
        className={[
          'w-full max-w-sm bg-card rounded-card shadow-card border border-border-subtle p-8 transition-transform',
          shake ? 'animate-shake' : '',
        ].join(' ')}
      >
        {/* Logo / Icon */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-card bg-accent-green-light">
            <Camera className="w-7 h-7 text-accent-green" aria-hidden="true" />
          </span>
        </div>

        {/* Heading */}
        <h1 className="font-heading text-2xl font-bold text-primary text-center mb-1">
          Bienvenido al evento
        </h1>
        <p className="font-body text-sm text-secondary text-center mb-6">
          Ingresa la contraseña para acceder a la galería.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="Contraseña del evento"
            type="password"
            id="event-password"
            placeholder="••••••••"
            icon={<Lock className="w-4 h-4" aria-hidden="true" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error || undefined}
            autoComplete="current-password"
            autoFocus
            disabled={isLoading}
          />

          <Input
            label="Tu nombre (opcional)"
            type="text"
            id="guest-nickname"
            placeholder="¿Cómo te llamas?"
            icon={<User className="w-4 h-4" aria-hidden="true" />}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={isLoading}
            autoComplete="nickname"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>

      {/* Shake keyframe — injected inline so no extra CSS file needed */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(8px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(6px); }
          75%       { transform: translateX(-4px); }
          90%       { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.55s ease-in-out; }
      `}</style>
    </div>
  );
}
