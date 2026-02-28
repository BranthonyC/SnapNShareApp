import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, RefreshCw, CheckCircle } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/authStore';
import { listMedia, moderateMedia, type MediaItem } from '@/services/api';

// ---------------------------------------------------------------------------
// ModerationTile -- blurred thumbnail with approve/reject controls
// ---------------------------------------------------------------------------
interface ModerationTileProps {
  item: MediaItem;
  onApprove: (mediaId: string) => void;
  onReject: (mediaId: string) => void;
  isActioning: boolean;
}

function ModerationTile({ item, onApprove, onReject, isActioning }: ModerationTileProps) {
  const [revealed, setRevealed] = useState(false);

  const statusLabel: Record<string, string> = {
    reported: 'Reportado',
    pending_review: 'Pendiente',
  };

  const statusColor: Record<string, string> = {
    reported: 'bg-accent-coral text-white',
    pending_review: 'bg-yellow-500 text-white',
  };

  return (
    <Card padding="sm" className="overflow-hidden">
      {/* Thumbnail */}
      <div className="relative w-full aspect-square rounded-card overflow-hidden bg-muted mb-2">
        <img
          src={item.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className={[
            'w-full h-full object-cover transition-all duration-300',
            revealed ? '' : 'blur-[10px] scale-110',
          ].join(' ')}
        />

        {/* Status badge */}
        <span
          className={[
            'absolute top-2 left-2 px-2 py-0.5 rounded-pill text-xs font-body font-medium',
            statusColor[item.status] ?? 'bg-muted text-secondary',
          ].join(' ')}
        >
          {statusLabel[item.status] ?? item.status}
        </span>

        {/* Reveal toggle */}
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'Ocultar contenido' : 'Revelar contenido'}
          className={[
            'absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-pill',
            'bg-black/50 text-white hover:bg-black/70',
            'transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green',
          ].join(' ')}
        >
          {revealed ? (
            <EyeOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Info */}
      <p className="font-body text-xs text-secondary truncate mb-2">
        Subido por: {item.uploadedBy}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          fullWidth
          disabled={isActioning}
          loading={isActioning}
          onClick={() => onApprove(item.mediaId)}
        >
          Aprobar
        </Button>
        <Button
          variant="danger"
          size="sm"
          fullWidth
          disabled={isActioning}
          loading={isActioning}
          onClick={() => onReject(item.mediaId)}
        >
          Rechazar
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-card bg-accent-green-light mb-4">
        <CheckCircle className="w-8 h-8 text-accent-green" aria-hidden="true" />
      </span>
      <h2 className="font-heading text-xl font-semibold text-primary mb-2">
        No hay contenido pendiente de revision
      </h2>
      <p className="font-body text-sm text-secondary max-w-xs">
        Todo el contenido ha sido revisado. Vuelve mas tarde para verificar nuevas publicaciones.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModerationPage -- /e/:eventId/admin/moderation
// ---------------------------------------------------------------------------
export default function ModerationPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuthStore();

  // Auth guard: host only
  useEffect(() => {
    if (!isAuthenticated() || role !== 'host') {
      navigate('/auth/host', { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actioningIds, setActioningIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Load flagged / reported media
  const loadItems = useCallback(
    async (showRefreshing = false) => {
      if (!eventId) return;
      if (showRefreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      try {
        // Fetch reported items
        const reportedRes = await listMedia(eventId, undefined, 50, 'reported');
        // Also fetch pending_review items
        const pendingRes = await listMedia(eventId, undefined, 50, 'pending_review');

        const combined = [...reportedRes.items, ...pendingRes.items];
        // Deduplicate by mediaId
        const seen = new Set<string>();
        const unique = combined.filter((item) => {
          if (seen.has(item.mediaId)) return false;
          seen.add(item.mediaId);
          return true;
        });
        setItems(unique);
      } catch {
        setError('Error al cargar contenido. Intenta de nuevo.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Handle approve / reject
  async function handleModerate(mediaId: string, action: 'approve' | 'reject') {
    if (!eventId) return;

    setActioningIds((prev) => new Set(prev).add(mediaId));

    try {
      await moderateMedia(eventId, mediaId, action);
      // Remove from list on success
      setItems((prev) => prev.filter((item) => item.mediaId !== mediaId));
    } catch {
      setError(
        action === 'approve'
          ? 'Error al aprobar contenido.'
          : 'Error al rechazar contenido.',
      );
    } finally {
      setActioningIds((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
    }
  }

  return (
    <PageLayout
      title="Moderacion"
      showBack
      onBack={() => navigate(`/e/${eventId}/admin`)}
    >
      {/* Header actions */}
      <div className="flex items-center justify-between mb-4 -mt-1">
        <p className="font-body text-sm text-secondary">
          {isLoading ? 'Cargando...' : `${items.length} elemento${items.length !== 1 ? 's' : ''} pendiente${items.length !== 1 ? 's' : ''}`}
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="w-4 h-4" />}
          loading={isRefreshing}
          onClick={() => loadItems(true)}
        >
          Actualizar
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <Card padding="sm" className="mb-4 border border-accent-coral">
          <p className="font-body text-sm text-accent-coral">{error}</p>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && <EmptyState />}

      {/* Grid */}
      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item) => (
            <ModerationTile
              key={item.mediaId}
              item={item}
              onApprove={(id) => handleModerate(id, 'approve')}
              onReject={(id) => handleModerate(id, 'reject')}
              isActioning={actioningIds.has(item.mediaId)}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
