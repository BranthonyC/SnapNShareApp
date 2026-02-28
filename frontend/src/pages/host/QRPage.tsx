import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Link2, Copy, Check, Share2, BarChart3 } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { useEvent } from '@/hooks/useEvent';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// QRPage — /e/:eventId/admin/qr
// Shows the event link, copy button, and share options.
// ---------------------------------------------------------------------------

const BASE_URL = 'https://eventalbum.codersatelier.com';

export default function QRPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuthStore();

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated() || role !== 'host') {
      navigate('/auth/host', { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  const { data: event, isLoading: eventLoading } = useEvent(eventId);

  const [copied, setCopied] = useState(false);

  const eventUrl = `${BASE_URL}/e/${eventId}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  }

  async function handleShare() {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: event?.title || 'EventAlbum',
        text: `Únete al evento "${event?.title}" y comparte tus fotos.`,
        url: eventUrl,
      });
    } catch {
      // User cancelled or share not available
    }
  }

  if (eventLoading) {
    return (
      <PageLayout
        title="Código QR"
        showBack
        onBack={() => navigate(`/e/${eventId}/admin`)}
      >
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Código QR"
      showBack
      onBack={() => navigate(`/e/${eventId}/admin`)}
    >
      {/* Event title */}
      <div className="text-center mb-6">
        <h2 className="font-heading text-xl font-bold text-primary mb-1">
          {event?.title ?? 'Evento'}
        </h2>
        <p className="font-body text-sm text-secondary">
          Comparte este enlace con tus invitados para que accedan al evento.
        </p>
      </div>

      {/* URL display card */}
      <Card padding="lg" className="mb-6">
        <div className="flex items-center justify-center mb-4">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-card bg-accent-green-light">
            <Link2 className="w-7 h-7 text-accent-green" aria-hidden="true" />
          </span>
        </div>

        {/* URL text */}
        <div className="bg-muted rounded-card px-4 py-3 mb-4">
          <p className="font-body text-sm text-primary text-center break-all select-all">
            {eventUrl}
          </p>
        </div>

        {/* Copy button */}
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          onClick={handleCopyLink}
        >
          {copied ? 'Enlace copiado' : 'Copiar enlace'}
        </Button>
      </Card>

      {/* Share section */}
      {typeof navigator.share === 'function' && (
        <Card padding="md" className="mb-6">
          <Button
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            icon={<Share2 className="w-4 h-4" />}
            onClick={handleShare}
          >
            Compartir evento
          </Button>
        </Card>
      )}

      {/* Event info */}
      <Card padding="md" className="mb-6">
        <h3 className="font-heading text-base font-semibold text-primary mb-3">
          Información del evento
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-secondary">Estado</span>
            <span className="font-body text-sm font-medium text-primary">
              {event?.status === 'active' ? 'Activo' : event?.status ?? '-'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-secondary">Tier</span>
            <span className="font-body text-sm font-medium text-primary capitalize">
              {event?.tier ?? '-'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-secondary">Fotos</span>
            <span className="font-body text-sm font-medium text-primary">
              {event?.uploadCount ?? 0} / {event?.uploadLimit ?? 0}
            </span>
          </div>
        </div>
      </Card>

      {/* Stats hint */}
      <Card padding="md">
        <button
          type="button"
          onClick={() => navigate(`/e/${eventId}/admin`)}
          className={[
            'w-full flex items-center gap-3 text-left',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green rounded-card',
          ].join(' ')}
        >
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-card bg-accent-green-light shrink-0">
            <BarChart3 className="w-5 h-5 text-accent-green" aria-hidden="true" />
          </span>
          <div>
            <p className="font-heading text-sm font-semibold text-primary">
              Ver estadísticas completas
            </p>
            <p className="font-body text-xs text-secondary">
              Visitas, subidas, reacciones y más.
            </p>
          </div>
        </button>
      </Card>
    </PageLayout>
  );
}
