import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Heart, ThumbsUp, PartyPopper, MessageCircle, Send } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import { useMedia } from '@/hooks/useMedia';
import { useAuthStore } from '@/stores/authStore';
import * as api from '@/services/api';
import type { MediaItem } from '@/services/api';

// ---------------------------------------------------------------------------
// Helper: relative time in Spanish
// ---------------------------------------------------------------------------
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `hace ${diffDay}d`;
}

// ---------------------------------------------------------------------------
// Reaction emoji config
// ---------------------------------------------------------------------------
const REACTIONS = [
  { emoji: 'heart', icon: Heart, label: 'Me encanta' },
  { emoji: 'thumbsup', icon: ThumbsUp, label: 'Me gusta' },
  { emoji: 'party', icon: PartyPopper, label: 'Fiesta' },
] as const;

// ---------------------------------------------------------------------------
// Comment interface
// ---------------------------------------------------------------------------
interface Comment {
  commentId: string;
  text: string;
  nickname: string;
  createdAt: string;
}

interface CommentsResponse {
  items: Comment[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// MediaViewPage — /e/:eventId/media/:mediaId
// ---------------------------------------------------------------------------
export default function MediaViewPage() {
  const { eventId, mediaId } = useParams<{ eventId: string; mediaId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate(`/e/${eventId}`, { replace: true });
    }
  }, [isAuthenticated, eventId, navigate]);

  const { items: mediaItems, isLoading: mediaLoading } = useMedia(eventId);

  // Current media item
  const currentIndex = mediaItems.findIndex((item: MediaItem) => item.mediaId === mediaId);
  const currentItem = currentIndex >= 0 ? mediaItems[currentIndex] : null;

  // Local reaction counts (optimistic)
  const [localReactions, setLocalReactions] = useState<Record<string, number>>({});
  const [activeReactions, setActiveReactions] = useState<Set<string>>(new Set());

  // Comment sheet
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Touch swipe state
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Sync reaction counts when currentItem changes
  useEffect(() => {
    if (currentItem) {
      setLocalReactions(currentItem.reactionCounts || {});
      setActiveReactions(new Set());
    }
  }, [currentItem]);

  // Load comments when sheet opens
  useEffect(() => {
    if (showComments && eventId && mediaId) {
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showComments, eventId, mediaId]);

  async function loadComments() {
    if (!eventId || !mediaId) return;
    setCommentsLoading(true);
    try {
      const res = (await api.listComments(eventId, mediaId)) as CommentsResponse;
      setComments(res.items || []);
    } catch {
      // Silent fail
    } finally {
      setCommentsLoading(false);
    }
  }

  // Navigation
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < mediaItems.length - 1;

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      const prevItem = mediaItems[currentIndex - 1] as MediaItem | undefined;
      if (prevItem) navigate(`/e/${eventId}/media/${prevItem.mediaId}`, { replace: true });
    }
  }, [hasPrev, mediaItems, currentIndex, eventId, navigate]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      const nextItem = mediaItems[currentIndex + 1] as MediaItem | undefined;
      if (nextItem) navigate(`/e/${eventId}/media/${nextItem.mediaId}`, { replace: true });
    }
  }, [hasNext, mediaItems, currentIndex, eventId, navigate]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (showComments) return; // Don't navigate while commenting
      if (e.key === 'ArrowLeft') goToPrev();
      else if (e.key === 'ArrowRight') goToNext();
      else if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goToPrev, goToNext, showComments]);

  // Touch swipe
  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (touch) touchStartX.current = touch.clientX;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (touch) touchEndX.current = touch.clientX;
  }

  function handleTouchEnd() {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (diff > threshold) goToNext();
    else if (diff < -threshold) goToPrev();
    touchStartX.current = 0;
    touchEndX.current = 0;
  }

  function handleClose() {
    navigate(`/e/${eventId}/gallery`);
  }

  // Reactions
  async function handleReaction(emoji: string) {
    if (!eventId || !mediaId) return;
    const isActive = activeReactions.has(emoji);

    // Optimistic update
    setLocalReactions((prev) => ({
      ...prev,
      [emoji]: Math.max(0, (prev[emoji] || 0) + (isActive ? -1 : 1)),
    }));

    setActiveReactions((prev) => {
      const next = new Set(prev);
      if (isActive) next.delete(emoji);
      else next.add(emoji);
      return next;
    });

    try {
      await api.addReaction(eventId, mediaId, emoji);
    } catch {
      // Revert on failure
      setLocalReactions((prev) => ({
        ...prev,
        [emoji]: Math.max(0, (prev[emoji] || 0) + (isActive ? 1 : -1)),
      }));
      setActiveReactions((prev) => {
        const next = new Set(prev);
        if (isActive) next.add(emoji);
        else next.delete(emoji);
        return next;
      });
    }
  }

  // Add comment
  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId || !mediaId || !commentText.trim()) return;

    setSendingComment(true);
    try {
      await api.addComment(eventId, mediaId, commentText.trim());
      setCommentText('');
      await loadComments();
    } catch {
      // Silent fail
    } finally {
      setSendingComment(false);
    }
  }

  // Loading state
  if (mediaLoading && !currentItem) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Not found
  if (!mediaLoading && !currentItem) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white">
        <p className="font-body text-lg mb-4">Foto no encontrada</p>
        <button
          type="button"
          onClick={handleClose}
          className="font-body text-sm text-accent-green hover:underline"
        >
          Volver a la galería
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar"
          className="flex items-center justify-center w-10 h-10 rounded-pill bg-black/40 text-white hover:bg-black/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Counter */}
        {currentIndex >= 0 && (
          <span className="font-body text-sm text-white/80">
            {currentIndex + 1} / {mediaItems.length}
          </span>
        )}
      </div>

      {/* Image area with swipe */}
      <div
        className="flex-1 flex items-center justify-center relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Prev button (desktop) */}
        {hasPrev && (
          <button
            type="button"
            onClick={goToPrev}
            aria-label="Foto anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden sm:flex items-center justify-center w-10 h-10 rounded-pill bg-black/40 text-white hover:bg-black/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {currentItem && (
          <img
            src={currentItem.fullUrl}
            alt={`Foto subida por ${currentItem.uploadedBy}`}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />
        )}

        {/* Next button (desktop) */}
        {hasNext && (
          <button
            type="button"
            onClick={goToNext}
            aria-label="Foto siguiente"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden sm:flex items-center justify-center w-10 h-10 rounded-pill bg-black/40 text-white hover:bg-black/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
        {/* Upload info */}
        {currentItem && (
          <p className="font-body text-xs text-white/60 mb-2">
            Subida por {currentItem.uploadedBy} · {timeAgo(currentItem.uploadedAt)}
          </p>
        )}

        {/* Reactions & comments row */}
        <div className="flex items-center gap-4">
          {/* Reaction buttons */}
          {REACTIONS.map(({ emoji, icon: Icon, label }) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReaction(emoji)}
              aria-label={label}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-pill transition-colors',
                activeReactions.has(emoji)
                  ? 'bg-accent-green/20 text-accent-green'
                  : 'bg-white/10 text-white/80 hover:bg-white/20',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green',
              ].join(' ')}
            >
              <Icon className="w-4 h-4" />
              <span className="font-body text-xs font-medium">
                {localReactions[emoji] || 0}
              </span>
            </button>
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Comment button */}
          <button
            type="button"
            onClick={() => setShowComments(true)}
            aria-label="Comentarios"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white/10 text-white/80 hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="font-body text-xs font-medium">
              {currentItem?.commentCount || 0}
            </span>
          </button>
        </div>
      </div>

      {/* Comment sheet */}
      {showComments && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowComments(false)}
            aria-label="Cerrar comentarios"
          />

          {/* Sheet */}
          <div className="relative bg-card rounded-t-modal max-h-[70vh] flex flex-col animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 rounded-pill bg-border-strong" />
            </div>

            <h3 className="font-heading text-base font-semibold text-primary px-4 pb-3">
              Comentarios
            </h3>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto px-4 pb-3">
              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : comments.length === 0 ? (
                <p className="font-body text-sm text-secondary text-center py-8">
                  Sin comentarios aún. Sé el primero.
                </p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.commentId}>
                      <div className="flex items-baseline gap-2">
                        <span className="font-body text-sm font-medium text-primary">
                          {comment.nickname}
                        </span>
                        <span className="font-body text-xs text-tertiary">
                          {timeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <p className="font-body text-sm text-secondary mt-0.5">
                        {comment.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add comment input */}
            <form
              onSubmit={handleAddComment}
              className="flex items-center gap-2 px-4 py-3 border-t border-border-subtle"
            >
              <input
                ref={commentInputRef}
                type="text"
                placeholder="Escribe un comentario..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                disabled={sendingComment}
                className={[
                  'flex-1 block border rounded-card px-3 py-2 font-body text-sm text-primary',
                  'placeholder:text-tertiary bg-white',
                  'transition-colors duration-150',
                  'focus:outline-none focus:ring-2 focus:ring-accent-green-light focus:border-accent-green',
                  'border-border-strong',
                  'disabled:opacity-50',
                ].join(' ')}
              />
              <button
                type="submit"
                disabled={sendingComment || !commentText.trim()}
                aria-label="Enviar comentario"
                className={[
                  'flex items-center justify-center w-10 h-10 rounded-pill',
                  'bg-accent-green text-white',
                  'hover:bg-accent-green-dark',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors duration-150',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green focus-visible:ring-offset-2',
                ].join(' ')}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Slide-up animation */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  );
}
