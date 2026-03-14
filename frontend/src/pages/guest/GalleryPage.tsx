import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Camera, Image } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Spinner from '@/components/ui/Spinner';
import OTPVerifySheet from '@/components/guest/OTPVerifySheet';
import { useEvent } from '@/hooks/useEvent';
import { useMedia } from '@/hooks/useMedia';
import { useEventSocket } from '@/hooks/useEventSocket';
import { useAuthStore } from '@/stores/authStore';
import type { MediaItem } from '@/services/api';

// ---------------------------------------------------------------------------
// Engagement scoring
// ---------------------------------------------------------------------------

const EMOJI_MAP: Record<string, string> = {
  heart: '❤️',
  thumbsup: '👍',
  party: '🎉',
};

function getEngagementScore(item: MediaItem): number {
  const reactions = Object.values(item.reactionCounts ?? {}).reduce((a, b) => a + b, 0);
  return reactions + (item.commentCount ?? 0) * 2;
}

/** Returns the dominant emoji for an item, or null */
function getDominantEmoji(item: MediaItem): string | null {
  const counts = item.reactionCounts ?? {};
  let max = 0;
  let dominant: string | null = null;
  for (const [key, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      dominant = key;
    }
  }
  return dominant && max > 0 ? (EMOJI_MAP[dominant] ?? null) : null;
}

type TileSize = 'lg' | 'md' | 'sm';

function getTileSize(score: number, rank: number, total: number): TileSize {
  if (score === 0) return 'sm';
  const topTen = Math.max(1, Math.ceil(total * 0.08));
  const topThirty = Math.max(2, Math.ceil(total * 0.25));
  if (rank < topTen && score >= 3) return 'lg';
  if (rank < topThirty && score >= 1) return 'md';
  return 'sm';
}

// ---------------------------------------------------------------------------
// Floating emoji animation (TikTok Live-style)
// ---------------------------------------------------------------------------

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number; // % from left
  delay: number; // ms
  duration: number; // ms
}

let emojiIdCounter = 0;

function FloatingEmojis({ item }: { item: MediaItem }) {
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Spawn emojis on mount based on reaction counts, then periodically for high-engagement items
  useEffect(() => {
    const counts = item.reactionCounts ?? {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) return;

    // Initial burst — spawn a few emojis
    const initialEmojis: FloatingEmoji[] = [];
    const entries = Object.entries(counts).filter(([, c]) => c > 0);
    const burstCount = Math.min(total, 5);

    for (let i = 0; i < burstCount; i++) {
      const entry = entries[i % entries.length];
      if (!entry) continue;
      initialEmojis.push({
        id: ++emojiIdCounter,
        emoji: EMOJI_MAP[entry[0]] ?? '❤️',
        x: 15 + Math.random() * 70,
        delay: Math.random() * 1500,
        duration: 2000 + Math.random() * 1500,
      });
    }
    setEmojis(initialEmojis);

    // Periodic spawns for high-engagement items
    if (total < 3) return;
    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      const entry = entries[Math.floor(Math.random() * entries.length)];
      if (!entry) return;
      const newEmoji: FloatingEmoji = {
        id: ++emojiIdCounter,
        emoji: EMOJI_MAP[entry[0]] ?? '❤️',
        x: 15 + Math.random() * 70,
        delay: 0,
        duration: 2000 + Math.random() * 1500,
      };
      setEmojis((prev) => [...prev.slice(-8), newEmoji]);
    }, 2500 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, [item.reactionCounts]);

  // Clean up old emojis
  useEffect(() => {
    if (emojis.length === 0) return;
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setEmojis((prev) => prev.slice(Math.max(0, prev.length - 6)));
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [emojis.length]);

  if (emojis.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10" aria-hidden="true">
      {emojis.map((e) => (
        <span
          key={e.id}
          className="absolute bottom-0 animate-emoji-float text-lg drop-shadow-sm"
          style={{
            left: `${e.x}%`,
            animationDelay: `${e.delay}ms`,
            animationDuration: `${e.duration}ms`,
          }}
        >
          {e.emoji}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reaction badge — small pill showing dominant emoji + count
// ---------------------------------------------------------------------------
function ReactionBadge({ item }: { item: MediaItem }) {
  const score = getEngagementScore(item);
  if (score === 0) return null;

  const emoji = getDominantEmoji(item);
  const reactions = Object.values(item.reactionCounts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-pill bg-black/50 backdrop-blur-sm">
      {emoji && <span className="text-xs">{emoji}</span>}
      {reactions > 0 && <span className="text-[10px] font-medium text-white">{reactions}</span>}
      {(item.commentCount ?? 0) > 0 && (
        <>
          <span className="text-[10px] text-white/60 mx-0.5">·</span>
          <span className="text-[10px] text-white/80">💬 {item.commentCount}</span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton tile
// ---------------------------------------------------------------------------
function SkeletonTile({ size = 'sm' }: { size?: TileSize }) {
  const sizeClasses = {
    lg: 'col-span-2 row-span-2',
    md: 'col-span-2 row-span-1',
    sm: 'col-span-1 row-span-1',
  };
  return (
    <div
      className={`${sizeClasses[size]} aspect-square rounded-card bg-muted animate-pulse`}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Media tile — engagement-sized with floating emojis
// ---------------------------------------------------------------------------
interface MediaTileProps {
  item: MediaItem;
  eventId: string;
  size: TileSize;
}

function MediaTile({ item, eventId, size }: MediaTileProps) {
  const sizeClasses = {
    lg: 'col-span-2 row-span-2',
    md: 'col-span-2 row-span-1',
    sm: 'col-span-1 row-span-1',
  };

  const score = getEngagementScore(item);

  return (
    <Link
      to={`/e/${eventId}/media/${item.mediaId}`}
      className={`${sizeClasses[size]} relative block w-full aspect-square overflow-hidden rounded-card bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent group`}
      aria-label={`Foto subida por ${item.uploadedBy}`}
    >
      <img
        src={item.thumbnailUrl ?? item.url}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      {/* Gradient overlay for tiles with interactions */}
      {score > 0 && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}

      {/* Floating emoji animations */}
      {score >= 2 && <FloatingEmojis item={item} />}

      {/* Reaction badge */}
      <ReactionBadge item={item} />

      {/* Featured glow ring for top items */}
      {size === 'lg' && (
        <div className="absolute inset-0 rounded-card ring-2 ring-accent/30 pointer-events-none" />
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-card bg-accent-light mb-4">
        <Image className="w-8 h-8 text-accent" aria-hidden="true" />
      </span>
      <h2 className="font-heading text-xl font-semibold text-primary mb-2">
        Aún no hay fotos
      </h2>
      <p className="font-body text-sm text-secondary mb-6 max-w-xs">
        ¡Sé el primero en capturar un recuerdo de este evento!
      </p>
      <button
        onClick={onUpload}
        className="inline-flex items-center gap-2 font-body text-sm font-medium text-accent hover:underline focus:outline-none"
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

  // Real-time updates from other guests in this event
  useEventSocket(eventId);

  // Sort items by engagement and assign tile sizes
  const rankedItems = useMemo(() => {
    if (mediaItems.length === 0) return [];

    // Create scored + ranked array
    const scored = mediaItems.map((item) => ({
      item,
      score: getEngagementScore(item),
    }));

    // Sort by score descending to determine rank
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const rankMap = new Map<string, number>();
    sorted.forEach((s, i) => rankMap.set(s.item.mediaId, i));

    // Return in original order but with size metadata
    return scored.map(({ item, score }) => ({
      item,
      score,
      size: getTileSize(score, rankMap.get(item.mediaId)!, mediaItems.length),
    }));
  }, [mediaItems]);

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

  // For guests, show the count of visible photos (what they can actually see),
  // not the total uploadCount which includes processing/pending items.
  const { role, verified } = useAuthStore();
  const isHost = role === 'host';
  const uploadCount = isHost ? (event?.uploadCount ?? mediaItems.length) : mediaItems.length;
  const uploadLimit = event?.uploadLimit ?? 0;

  const headerTitle = eventLoading
    ? 'Cargando...'
    : event?.title ?? 'Galería';

  // OTP bottom sheet state
  const [showOtpSheet, setShowOtpSheet] = useState(false);

  const smsAvailable = event?.tier === 'premium' && (event as any).smsOtp === true;

  function goToUpload() {
    // If guest is not verified, show OTP sheet instead of navigating
    if (!verified && role === 'guest') {
      setShowOtpSheet(true);
      return;
    }
    navigate(`/e/${eventId}/upload`);
  }

  function handleOtpVerified() {
    setShowOtpSheet(false);
    navigate(`/e/${eventId}/upload`);
  }

  const showSkeletons = mediaLoading && mediaItems.length === 0;
  const showEmpty = !mediaLoading && !isFetchingNextPage && mediaItems.length === 0;

  return (
    <PageLayout title={headerTitle} showBack onBack={() => navigate(`/e/${eventId}`)}>
      {/* Upload counter */}
      {!eventLoading && event && (
        <p className="font-body text-xs text-secondary text-right mb-3 -mt-2">
          {uploadCount}/{uploadLimit} fotos
        </p>
      )}

      {/* Masonry-style CSS grid with engagement sizing */}
      {!showEmpty && (
        <div
          className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 auto-rows-[minmax(100px,1fr)] gap-2"
          style={{ gridAutoFlow: 'dense' }}
          role="list"
          aria-label="Galería de fotos"
        >
          {showSkeletons
            ? Array.from({ length: 12 }).map((_, i) => (
                <SkeletonTile key={i} size={i === 0 ? 'lg' : i < 3 ? 'md' : 'sm'} />
              ))
            : rankedItems.map(({ item, size }) => (
                <MediaTile key={item.mediaId} item={item} eventId={eventId!} size={size} />
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
          'bg-accent text-white shadow-modal',
          'hover:bg-accent-dark active:scale-95',
          'transition-all duration-150 ease-in-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        ].join(' ')}
      >
        <Camera className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* OTP verification bottom sheet */}
      {showOtpSheet && eventId && (
        <OTPVerifySheet
          eventId={eventId}
          smsAvailable={smsAvailable}
          onVerified={handleOtpVerified}
          onClose={() => setShowOtpSheet(false)}
        />
      )}

      {/* Floating emoji keyframes */}
      <style>{`
        @keyframes emoji-float {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.5);
          }
          15% {
            opacity: 1;
            transform: translateY(-20%) scale(1);
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-120%) scale(1.2);
          }
        }
        .animate-emoji-float {
          animation: emoji-float ease-out forwards;
        }
      `}</style>
    </PageLayout>
  );
}
