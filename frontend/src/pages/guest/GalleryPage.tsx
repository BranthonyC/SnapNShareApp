import { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Camera, Image } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Spinner from '@/components/ui/Spinner';
import { useEvent } from '@/hooks/useEvent';
import { useMedia } from '@/hooks/useMedia';
import { useAuthStore } from '@/stores/authStore';
import type { MediaItem } from '@/services/api';

// ---------------------------------------------------------------------------
// Skeleton tile — shown while first page is loading
// ---------------------------------------------------------------------------
function SkeletonTile() {
  return (
    <div className="w-full aspect-square rounded-card bg-muted animate-pulse" aria-hidden="true" />
  );
}

// ---------------------------------------------------------------------------
// Media tile — lazy-loaded thumbnail
// ---------------------------------------------------------------------------
interface MediaTileProps {
  item: MediaItem;
  eventId: string;
}

function MediaTile({ item, eventId }: MediaTileProps) {
  return (
    <Link
      to={`/e/${eventId}/media/${item.mediaId}`}
      className="block w-full aspect-square overflow-hidden rounded-card bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green"
      aria-label={`Foto subida por ${item.uploadedBy}`}
    >
      <img
        src={item.thumbnailUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover transition-transform duration-200 hover:scale-105"
      />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-card bg-accent-green-light mb-4">
        <Image className="w-8 h-8 text-accent-green" aria-hidden="true" />
      </span>
      <h2 className="font-heading text-xl font-semibold text-primary mb-2">
        Aún no hay fotos
      </h2>
      <p className="font-body text-sm text-secondary mb-6 max-w-xs">
        ¡Sé el primero en capturar un recuerdo de este evento!
      </p>
      <button
        onClick={onUpload}
        className="inline-flex items-center gap-2 font-body text-sm font-medium text-accent-green hover:underline focus:outline-none"
      >
        <Camera className="w-4 h-4" aria-hidden="true" />
        Subir primera foto
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GalleryPage — /e/:eventId/gallery
// ---------------------------------------------------------------------------
export default function GalleryPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const { isAuthenticated, eventId: storedEventId } = useAuthStore();

  // Redirect unauthenticated visitors back to entry
  useEffect(() => {
    if (!isAuthenticated() || storedEventId !== eventId) {
      navigate(`/e/${eventId}`, { replace: true });
    }
  }, [isAuthenticated, storedEventId, eventId, navigate]);

  const { data: event, isLoading: eventLoading } = useEvent(eventId);
  const { items: mediaItems, fetchNextPage, hasNextPage, isLoading: mediaLoading, isFetchingNextPage } =
    useMedia(eventId);

  // IntersectionObserver sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  const uploadCount = event?.uploadCount ?? mediaItems.length;
  const uploadLimit = event?.uploadLimit ?? 0;

  const headerTitle = eventLoading
    ? 'Cargando...'
    : event?.title ?? 'Galería';

  function goToUpload() {
    navigate(`/e/${eventId}/upload`);
  }

  const showSkeletons = mediaLoading && mediaItems.length === 0;
  const showEmpty = !mediaLoading && !isFetchingNextPage && mediaItems.length === 0;

  return (
    <PageLayout title={headerTitle}>
      {/* Upload counter */}
      {!eventLoading && event && (
        <p className="font-body text-xs text-secondary text-right mb-3 -mt-2">
          {uploadCount}/{uploadLimit} fotos
        </p>
      )}

      {/* Masonry-style CSS grid */}
      {!showEmpty && (
        <div
          className="columns-2 sm:columns-3 lg:columns-4 gap-2 space-y-2"
          role="list"
          aria-label="Galería de fotos"
        >
          {showSkeletons
            ? Array.from({ length: 12 }).map((_, i) => (
                <div key={i} role="listitem" className="break-inside-avoid mb-2">
                  <SkeletonTile />
                </div>
              ))
            : mediaItems.map((item: MediaItem) => (
                <div key={item.mediaId} role="listitem" className="break-inside-avoid mb-2">
                  <MediaTile item={item} eventId={eventId!} />
                </div>
              ))}
        </div>
      )}

      {/* Empty state */}
      {showEmpty && <EmptyState onUpload={goToUpload} />}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} aria-hidden="true" className="h-4 mt-4" />

      {/* Loading more indicator */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Spinner size="md" />
        </div>
      )}

      {/* Upload FAB */}
      <button
        type="button"
        onClick={goToUpload}
        aria-label="Subir foto"
        className={[
          'fixed bottom-6 right-6 z-20',
          'flex items-center justify-center w-14 h-14 rounded-pill',
          'bg-accent-green text-white shadow-modal',
          'hover:bg-accent-green-dark active:scale-95',
          'transition-all duration-150 ease-in-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green focus-visible:ring-offset-2',
        ].join(' ')}
      >
        <Camera className="w-6 h-6" aria-hidden="true" />
      </button>
    </PageLayout>
  );
}
