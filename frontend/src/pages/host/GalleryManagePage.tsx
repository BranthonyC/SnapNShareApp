import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search,
  CheckSquare,
  Square,
  Trash2,
  Image,
  X,
  AlertTriangle,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import PaymentGate from '@/components/admin/PaymentGate';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import { useEvent } from '@/hooks/useEvent';
import { useMedia } from '@/hooks/useMedia';
import { useAuthStore } from '@/stores/authStore';
import { bulkDeleteMedia, deleteMedia, searchMedia, type MediaItem } from '@/services/api';

// ---------------------------------------------------------------------------
// SelectableTile -- media thumbnail with selection checkbox & delete overlay
// ---------------------------------------------------------------------------
interface SelectableTileProps {
  item: MediaItem;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (mediaId: string) => void;
  onDelete: (mediaId: string) => void;
}

function SelectableTile({
  item,
  selectionMode,
  isSelected,
  onToggleSelect,
  onDelete,
}: SelectableTileProps) {
  return (
    <div className="relative group w-full aspect-square overflow-hidden rounded-card bg-muted">
      <img
        src={item.thumbnailUrl ?? item.url}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
      />

      {/* Selection overlay */}
      {selectionMode && (
        <button
          type="button"
          onClick={() => onToggleSelect(item.mediaId)}
          aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}
          className="absolute inset-0 flex items-start justify-start p-2 bg-black/10 transition-colors duration-150 focus:outline-none"
        >
          {isSelected ? (
            <CheckSquare className="w-6 h-6 text-accent drop-shadow-md" aria-hidden="true" />
          ) : (
            <Square className="w-6 h-6 text-white drop-shadow-md" aria-hidden="true" />
          )}
          {isSelected && (
            <div className="absolute inset-0 border-2 border-accent rounded-card pointer-events-none" />
          )}
        </button>
      )}

      {/* Hover delete icon (only visible when NOT in selection mode) */}
      {!selectionMode && (
        <button
          type="button"
          onClick={() => onDelete(item.mediaId)}
          aria-label="Eliminar"
          className={[
            'absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-pill',
            'bg-black/50 text-white hover:bg-accent-coral',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-coral',
          ].join(' ')}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      )}

      {/* Uploader info on hover */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <p className="font-body text-xs text-white truncate">{item.uploadedBy}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog -- confirmation overlay for bulk delete
// ---------------------------------------------------------------------------
interface ConfirmDialogProps {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function ConfirmDialog({ count, onConfirm, onCancel, isLoading }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <Card padding="lg" className="max-w-sm w-full">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-card bg-red-50 mb-3">
            <AlertTriangle className="w-6 h-6 text-accent-coral" aria-hidden="true" />
          </span>
          <h3 className="font-heading text-lg font-semibold text-primary mb-2">
            Eliminar contenido
          </h3>
          <p className="font-body text-sm text-secondary mb-6">
            {count === 1
              ? 'Se eliminara 1 elemento permanentemente. Esta accion no se puede deshacer.'
              : `Se eliminaran ${count} elementos permanentemente. Esta accion no se puede deshacer.`}
          </p>
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              size="md"
              fullWidth
              disabled={isLoading}
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="md"
              fullWidth
              loading={isLoading}
              onClick={onConfirm}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-card bg-accent-light mb-4">
        <Image className="w-8 h-8 text-accent" aria-hidden="true" />
      </span>
      <h2 className="font-heading text-xl font-semibold text-primary mb-2">
        No hay contenido
      </h2>
      <p className="font-body text-sm text-secondary max-w-xs">
        Aun no se ha subido contenido a este evento.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonTile
// ---------------------------------------------------------------------------
function SkeletonTile() {
  return (
    <div className="w-full aspect-square rounded-card bg-muted animate-pulse" aria-hidden="true" />
  );
}

// ---------------------------------------------------------------------------
// GalleryManagePage -- /e/:eventId/admin/gallery
// ---------------------------------------------------------------------------
export default function GalleryManagePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, role } = useAuthStore();

  // Auth guard: host only
  useEffect(() => {
    if (!isAuthenticated() || role !== 'host') {
      navigate('/auth/host', { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  const { data: event } = useEvent(eventId);
  const {
    items: mediaItems,
    fetchNextPage,
    hasNextPage,
    isLoading: mediaLoading,
    isFetchingNextPage,
  } = useMedia(eventId);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confirm dialog state
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage && !searchQuery) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage, searchQuery],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  // Debounced search
  useEffect(() => {
    if (!eventId) return;

    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await searchMedia(eventId, searchQuery.trim());
        setSearchResults(res.items);
      } catch {
        // Fallback: client-side filter
        const q = searchQuery.trim().toLowerCase();
        const filtered = mediaItems.filter(
          (item) => item.uploadedBy.toLowerCase().includes(q),
        );
        setSearchResults(filtered);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, eventId, mediaItems]);

  // Items to display (search results or all media)
  const displayItems = searchResults ?? mediaItems;

  // Selection helpers
  function toggleSelect(mediaId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(displayItems.map((item) => item.mediaId)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  // Delete handlers
  async function handleBulkDelete() {
    if (!eventId || selectedIds.size === 0) return;

    setIsDeleting(true);
    setError(null);

    try {
      await bulkDeleteMedia(eventId, Array.from(selectedIds));
      setSelectedIds(new Set());
      setShowConfirm(false);
      setSelectionMode(false);
      setSearchQuery('');
      setSearchResults(null);
      // Invalidate React Query cache to refetch
      queryClient.invalidateQueries({ queryKey: ['media', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    } catch {
      setError('Error al eliminar. Intenta de nuevo.');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSingleDelete(mediaId: string) {
    // Show confirmation first
    setSingleDeleteId(mediaId);
  }

  async function confirmSingleDelete() {
    if (!eventId || !singleDeleteId) return;
    setError(null);
    setIsDeleting(true);

    try {
      await deleteMedia(eventId, singleDeleteId);
      if (searchResults) {
        setSearchResults((prev) =>
          prev ? prev.filter((item) => item.mediaId !== singleDeleteId) : null,
        );
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(singleDeleteId);
        return next;
      });
      setSingleDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['media', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    } catch {
      setError('Error al eliminar. Intenta de nuevo.');
    } finally {
      setIsDeleting(false);
    }
  }

  const showSkeletons = mediaLoading && mediaItems.length === 0 && !searchQuery;
  const showEmpty = !mediaLoading && !isSearching && displayItems.length === 0;

  return (
    <AdminLayout
      title="Gestionar galería"
      onBack={() => navigate(`/e/${eventId}/admin`)}
      tier={event?.tier}
    >
      <PaymentGate eventId={eventId!} paymentStatus={event?.paymentStatus} tier={event?.tier ?? 'basic'}>
      {/* Search bar */}
      <div className="mb-4">
        <Input
          placeholder="Buscar por nombre de invitado..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="font-body text-sm text-secondary">
          {isSearching
            ? 'Buscando...'
            : searchResults
              ? `${displayItems.length} resultado${displayItems.length !== 1 ? 's' : ''}`
              : `${displayItems.length} elemento${displayItems.length !== 1 ? 's' : ''}`}
        </p>

        <div className="flex items-center gap-2">
          {selectionMode ? (
            <>
              <Button variant="secondary" size="sm" onClick={selectAll}>
                Seleccionar todo
              </Button>
              <Button variant="secondary" size="sm" onClick={deselectAll}>
                Deseleccionar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<X className="w-4 h-4" />}
                onClick={exitSelectionMode}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={<CheckSquare className="w-4 h-4" />}
              onClick={() => setSelectionMode(true)}
            >
              Seleccionar
            </Button>
          )}
        </div>
      </div>

      {/* Selection count & bulk actions */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-accent-light rounded-card px-4 py-3 mb-4">
          <p className="font-body text-sm font-medium text-primary">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </p>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => setShowConfirm(true)}
          >
            Eliminar seleccionados
          </Button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <Card padding="sm" className="mb-4 border border-accent-coral">
          <p className="font-body text-sm text-accent-coral">{error}</p>
        </Card>
      )}

      {/* Loading state */}
      {showSkeletons && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <SkeletonTile key={i} />
          ))}
        </div>
      )}

      {/* Search loading */}
      {isSearching && (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      )}

      {/* Empty state */}
      {showEmpty && !showSkeletons && <EmptyState />}

      {/* Grid — responsive: 3 → 4 → 5 cols */}
      {!isSearching && displayItems.length > 0 && (
        <div
          className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2"
          role="list"
          aria-label="Galeria de fotos"
        >
          {displayItems.map((item: MediaItem) => (
            <div key={item.mediaId} role="listitem">
              <SelectableTile
                item={item}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(item.mediaId)}
                onToggleSelect={toggleSelect}
                onDelete={handleSingleDelete}
              />
            </div>
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {!searchQuery && (
        <div ref={sentinelRef} aria-hidden="true" className="h-4 mt-4" />
      )}

      {/* Loading more indicator */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Spinner size="md" />
        </div>
      )}

      {/* Bulk delete confirm dialog */}
      {showConfirm && (
        <ConfirmDialog
          count={selectedIds.size}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowConfirm(false)}
          isLoading={isDeleting}
        />
      )}

      {/* Single delete confirm dialog */}
      {singleDeleteId && (
        <ConfirmDialog
          count={1}
          onConfirm={confirmSingleDelete}
          onCancel={() => setSingleDeleteId(null)}
          isLoading={isDeleting}
        />
      )}
      </PaymentGate>
    </AdminLayout>
  );
}
