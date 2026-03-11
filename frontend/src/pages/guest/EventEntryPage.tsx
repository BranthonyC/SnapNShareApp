import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Lock, MapPin, Clock, Heart, ArrowRight, ChevronDown, Image } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import * as api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useEvent } from '@/hooks/useEvent';
import { useMedia } from '@/hooks/useMedia';
import type { MediaItem, ScheduleItem } from '@/services/api';

// ---------------------------------------------------------------------------
// Date formatter
// ---------------------------------------------------------------------------
function formatEventDate(dateStr: string): { weekday: string; full: string } {
  const d = new Date(dateStr);
  const weekday = d.toLocaleDateString('es-GT', { weekday: 'long' });
  const full = d.toLocaleDateString('es-GT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return { weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), full };
}

// ---------------------------------------------------------------------------
// Hero — iPhone lock screen style
// ---------------------------------------------------------------------------
function HeroSection({
  title,
  coverUrl,
  startDate,
  location,
  hostName,
  onScroll,
}: {
  title: string;
  coverUrl?: string | null;
  startDate: string;
  location?: string;
  hostName?: string;
  onScroll: () => void;
}) {
  const date = startDate ? formatEventDate(startDate) : null;

  return (
    <section className="relative w-full h-screen flex flex-col">
      {/* Background image */}
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-muted to-white" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />

      {/* Content overlaid at bottom */}
      <div className="relative flex-1 flex flex-col justify-end p-6 pb-24">
        <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight drop-shadow-lg">
          {title}
        </h1>
        {date && (
          <p className="font-body text-sm text-white/90 mt-2 drop-shadow-md">
            {date.full}
          </p>
        )}
        {location && (
          <p className="font-body text-sm text-white/80 mt-1 flex items-center gap-1.5 drop-shadow-md">
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            {location}
          </p>
        )}
        {hostName && (
          <p className="font-body text-xs text-white/60 mt-1 italic drop-shadow-md">
            Organizado por {hostName}
          </p>
        )}
      </div>

      {/* Scroll indicator */}
      <button
        type="button"
        onClick={onScroll}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors animate-bounce-gentle"
        aria-label="Desplazar hacia abajo"
      >
        <ChevronDown className="w-6 h-6" />
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// About section
// ---------------------------------------------------------------------------
function AboutSection({
  description,
  schedule,
}: {
  description?: string;
  schedule?: ScheduleItem[];
}) {
  if (!description && (!schedule || schedule.length === 0)) return null;

  return (
    <section className="px-4 py-6">
      <div className="bg-card rounded-modal shadow-card p-5 max-w-lg mx-auto">
        <h2 className="font-heading text-lg font-semibold text-primary mb-3 flex items-center gap-2">
          <span className="text-accent">&#x1F3DB;</span>
          Acerca del evento
        </h2>
        {description && (
          <p className="font-body text-sm text-secondary leading-relaxed whitespace-pre-line">
            {description}
          </p>
        )}
        {schedule && schedule.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {schedule.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 mt-0.5 text-accent">
                  {item.icon === 'location' ? (
                    <MapPin className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </span>
                <p className="font-body text-sm text-primary">
                  <span className="font-medium">{item.time}</span>
                  {' — '}
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Welcome message section
// ---------------------------------------------------------------------------
function WelcomeSection({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <section className="px-4 py-4">
      <div className="bg-card rounded-modal shadow-card p-5 max-w-lg mx-auto">
        <h2 className="font-heading text-lg font-semibold text-primary mb-3 flex items-center gap-2">
          <Heart className="w-5 h-5 text-accent-coral" aria-hidden="true" />
          Mensaje de bienvenida
        </h2>
        <p className="font-body text-sm text-secondary leading-relaxed whitespace-pre-line">
          {message}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Gallery preview
// ---------------------------------------------------------------------------
function GalleryPreview({ items }: { items: MediaItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="px-4 py-4">
      <div className="max-w-lg mx-auto">
        <h2 className="font-heading text-lg font-semibold text-primary mb-3">
          Galería
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {items.slice(0, 3).map((item) => (
            <div
              key={item.mediaId}
              className="aspect-square rounded-card overflow-hidden bg-muted"
            >
              <img
                src={item.thumbnailUrl ?? item.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer card
// ---------------------------------------------------------------------------
function FooterCard({
  text,
  isSticky,
}: {
  text?: string;
  isSticky: boolean;
}) {
  if (!text) return null;

  return (
    <div
      className={[
        'px-4 py-6 transition-all duration-300',
        isSticky ? 'bg-card border-t border-border-subtle' : '',
      ].join(' ')}
    >
      <div className="max-w-lg mx-auto text-center">
        <p className="font-body text-sm text-secondary leading-relaxed">
          {text}
        </p>
        <Heart className="w-4 h-4 text-accent-coral mx-auto mt-2" aria-hidden="true" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Enter dialog (nickname input)
// ---------------------------------------------------------------------------
function EnterDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  error,
  needsPassword,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (nickname: string, password?: string) => void;
  isLoading: boolean;
  error: string;
  needsPassword: boolean;
}) {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(nickname.trim(), needsPassword ? password : undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="relative bg-card rounded-t-modal sm:rounded-modal w-full max-w-sm mx-4 p-6 animate-slide-up">
        <div className="flex justify-center mb-2">
          <div className="w-10 h-1 rounded-pill bg-border-strong sm:hidden" />
        </div>
        <h3 className="font-heading text-xl font-semibold text-primary text-center mb-2">
          Ingresa al evento
        </h3>
        <p className="font-body text-sm text-secondary text-center mb-4">
          Escribe tu nombre para que todos sepan quién eres.
        </p>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="Tu nombre"
            type="text"
            id="guest-nickname"
            placeholder="¿Cómo te llamas?"
            icon={<User className="w-4 h-4" aria-hidden="true" />}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={isLoading}
            autoComplete="nickname"
            autoFocus
          />
          {needsPassword && (
            <Input
              label="Contraseña del evento"
              type="password"
              id="guest-password"
              placeholder="Ingresa la contraseña"
              icon={<Lock className="w-4 h-4" aria-hidden="true" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
            />
          )}
          {error && (
            <div className="p-3 rounded-card bg-red-50 border border-accent-coral" role="alert">
              <p className="font-body text-sm text-accent-coral">{error}</p>
            </div>
          )}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? 'Entrando...' : 'Entrar al evento'}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EventEntryPage — /e/:eventId (Lobby)
// ---------------------------------------------------------------------------
export default function EventEntryPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const { isAuthenticated, eventId: storedEventId, setGuestAuth, loadEventSession } = useAuthStore();

  const [showEnterDialog, setShowEnterDialog] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [footerSticky, setFooterSticky] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  // Restore session if returning to lobby (but don't redirect away)
  useEffect(() => {
    if (!eventId) return;
    if (!isAuthenticated() || storedEventId !== eventId) {
      loadEventSession(eventId);
    }
  }, [eventId, isAuthenticated, storedEventId, loadEventSession]);

  const alreadyAuthenticated = isAuthenticated() && storedEventId === eventId;

  // Fetch event data for the lobby display
  const { data: event, isLoading: eventLoading } = useEvent(eventId);

  // Fetch a few media items for gallery preview (if event is public-readable)
  const { items: mediaItems } = useMedia(eventId);

  // Footer sticky behavior
  const handleScroll = useCallback(() => {
    if (!footerRef.current) return;
    const rect = footerRef.current.getBoundingClientRect();
    setFooterSticky(rect.top <= window.innerHeight);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  function scrollToContent() {
    contentRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleEnter(nickname: string, password?: string) {
    if (!eventId) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await api.authEvent(eventId, {
        nickname: nickname || undefined,
        password: password || undefined,
      });

      setGuestAuth(res.token, eventId, res.nickname, res.verified);
      navigate(`/e/${eventId}/gallery`, { replace: true });
    } catch (err) {
      const apiErr = err as api.ApiError;
      let msg: string;
      if (apiErr.code === 'EVENT_NOT_FOUND') {
        msg = 'Evento no encontrado. Verifica el enlace e intenta de nuevo.';
      } else if (apiErr.code === 'EVENT_LOCKED') {
        msg = 'Este evento fue cerrado por el organizador.';
      } else if (apiErr.code === 'EVENT_UNPAID') {
        msg = 'Este evento aún no está disponible. El organizador debe completar el pago.';
      } else if (apiErr.code === 'WRONG_PASSWORD') {
        setNeedsPassword(true);
        msg = 'Contraseña incorrecta. Pídele la contraseña al organizador.';
      } else {
        msg = 'Ocurrió un error. Intenta más tarde.';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  // Loading
  if (eventLoading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Event not found
  if (!event) {
    return (
      <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4">
        <p className="font-heading text-xl font-semibold text-primary mb-2">
          Evento no encontrado
        </p>
        <p className="font-body text-sm text-secondary">
          Verifica el enlace e intenta de nuevo.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Hero — full viewport height */}
      <HeroSection
        title={event.title}
        coverUrl={event.coverUrl}
        startDate={event.startDate}
        location={event.location}
        hostName={event.hostName}
        onScroll={scrollToContent}
      />

      {/* Content sections */}
      <div ref={contentRef}>
        <AboutSection
          description={event.description}
          schedule={event.schedule}
        />
        <WelcomeSection message={event.welcomeMessage} />
        <GalleryPreview items={mediaItems} />

        {/* Footer */}
        <div ref={footerRef}>
          <FooterCard text={event.footerText} isSticky={footerSticky} />
        </div>

        {/* Spacer for floating button */}
        <div className="h-24" />
      </div>

      {/* Floating action button — "Ver galería" if authenticated, "Entrar al evento" if not */}
      <div className="fixed bottom-6 left-4 right-4 z-40 max-w-lg mx-auto">
        {alreadyAuthenticated ? (
          <button
            type="button"
            onClick={() => navigate(`/e/${eventId}/gallery`)}
            className={[
              'w-full flex items-center justify-center gap-2',
              'py-4 px-6 rounded-pill',
              'bg-accent text-white font-heading text-base font-semibold',
              'shadow-modal hover:bg-accent-dark',
              'active:scale-[0.98] transition-all duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            ].join(' ')}
          >
            <Image className="w-5 h-5" aria-hidden="true" />
            Ver galería
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowEnterDialog(true)}
            className={[
              'w-full flex items-center justify-center gap-2',
              'py-4 px-6 rounded-pill',
              'bg-accent text-white font-heading text-base font-semibold',
              'shadow-modal hover:bg-accent-dark',
              'active:scale-[0.98] transition-all duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            ].join(' ')}
          >
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
            Entrar al evento
          </button>
        )}
      </div>

      {/* Enter dialog */}
      <EnterDialog
        isOpen={showEnterDialog}
        onClose={() => setShowEnterDialog(false)}
        onSubmit={handleEnter}
        isLoading={isLoading}
        error={error}
        needsPassword={needsPassword}
      />

      {/* Animations */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        @keyframes bounce-gentle {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(6px); }
        }
        .animate-bounce-gentle { animation: bounce-gentle 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
