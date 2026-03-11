import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Heart, ThumbsUp, PartyPopper, MessageCircle, Send } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import { useMedia } from '@/hooks/useMedia';
import { useAuthStore } from '@/stores/authStore';
import * as api from '@/services/api';
import type { MediaItem, CommentItem } from '@/services/api';

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
// Avatar color palette — deterministic from name
// ---------------------------------------------------------------------------
const AVATAR_COLORS = [
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? 'bg-blue-500';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0]! + parts[1][0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
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
// Avatar component
// ---------------------------------------------------------------------------
function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div
      className={`${sizeClass} ${getAvatarColor(name)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
    >
      {getInitials(name)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommentBubble — single comment with avatar, text, time, and like
// ---------------------------------------------------------------------------
interface CommentBubbleProps {
  comment: CommentItem;
  onLike: (commentId: string) => void;
  isLiking: boolean;
  isLiked: boolean;
}

function CommentBubble({ comment, onLike, isLiking, isLiked }: CommentBubbleProps) {
  return (
    <div className="flex gap-2.5 group">
      <Avatar name={comment.authorName} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="bg-muted rounded-2xl rounded-tl-md px-3.5 py-2.5">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-body text-sm font-semibold text-primary truncate">
              {comment.authorName}
            </span>
            <span className="font-body text-[11px] text-tertiary flex-shrink-0">
              {timeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="font-body text-sm text-secondary leading-relaxed break-words">
            {comment.text}
          </p>
        </div>
        {/* Like row */}
        <div className="flex items-center gap-3 mt-1 ml-1">
          <button
            type="button"
            onClick={() => onLike(comment.commentId)}
            disabled={isLiking}
            className={[
              'flex items-center gap-1 font-body text-xs transition-colors',
              isLiked
                ? 'text-accent-coral font-medium'
                : 'text-tertiary hover:text-accent-coral',
              'focus:outline-none disabled:opacity-50',
            ].join(' ')}
          >
            <Heart
              className={`w-3 h-3 ${isLiked ? 'fill-current' : ''}`}
              aria-hidden="true"
            />
            {comment.likeCount > 0 && (
              <span>{comment.likeCount}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MediaViewPage — /e/:eventId/media/:mediaId
// ---------------------------------------------------------------------------
export default function MediaViewPage() {
  const { eventId, mediaId } = useParams<{ eventId: string; mediaId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const cameFromAdmin = (location.state as { from?: string })?.from === 'admin';

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
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const commentInputRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

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
      const res = await api.listComments(eventId, mediaId);
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
      if (showComments) return;
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
    if (cameFromAdmin) {
      navigate(`/e/${eventId}/admin`);
    } else {
      navigate(`/e/${eventId}/gallery`);
    }
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

  // Like comment
  async function handleLikeComment(commentId: string) {
    if (!eventId || !mediaId) return;

    const wasLiked = likedIds.has(commentId);

    // Optimistic update
    setLikingIds((prev) => new Set(prev).add(commentId));
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    setComments((prev) =>
      prev.map((c) =>
        c.commentId === commentId
          ? { ...c, likeCount: Math.max(0, c.likeCount + (wasLiked ? -1 : 1)) }
          : c,
      ),
    );

    try {
      await api.likeComment(eventId, mediaId, commentId);
    } catch {
      // Revert on failure
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(commentId);
        else next.delete(commentId);
        return next;
      });
      setComments((prev) =>
        prev.map((c) =>
          c.commentId === commentId
            ? { ...c, likeCount: Math.max(0, c.likeCount + (wasLiked ? 1 : -1)) }
            : c,
        ),
      );
    } finally {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
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
      // Scroll to bottom after new comment
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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
          className="font-body text-sm text-accent hover:underline"
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
          className="flex items-center justify-center w-10 h-10 rounded-pill bg-black/40 text-white hover:bg-black/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden sm:flex items-center justify-center w-10 h-10 rounded-pill bg-black/40 text-white hover:bg-black/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {currentItem && (
          <img
            src={currentItem.url}
            alt={`Foto subida por ${currentItem.uploadedBy}`}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            style={{ WebkitTouchCallout: 'none' }}
          />
        )}

        {/* Next button (desktop) */}
        {hasNext && (
          <button
            type="button"
            onClick={goToNext}
            aria-label="Foto siguiente"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden sm:flex items-center justify-center w-10 h-10 rounded-pill bg-black/40 text-white hover:bg-black/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                  ? 'bg-accent/20 text-accent'
                  : 'bg-white/10 text-white/80 hover:bg-white/20',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white/10 text-white/80 hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
          <div className="relative bg-card rounded-t-modal max-h-[75vh] flex flex-col animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 rounded-pill bg-border-strong" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3">
              <h3 className="font-heading text-base font-semibold text-primary">
                Comentarios
                {comments.length > 0 && (
                  <span className="font-body text-sm font-normal text-tertiary ml-2">
                    {comments.length}
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setShowComments(false)}
                aria-label="Cerrar"
                className="flex items-center justify-center w-8 h-8 rounded-full text-tertiary hover:text-primary hover:bg-muted transition-colors focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto px-4 pb-3">
              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <MessageCircle className="w-10 h-10 text-border-strong mb-3" aria-hidden="true" />
                  <p className="font-body text-sm text-secondary text-center">
                    Sin comentarios aún
                  </p>
                  <p className="font-body text-xs text-tertiary text-center mt-1">
                    Sé el primero en comentar
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <CommentBubble
                      key={comment.commentId}
                      comment={comment}
                      onLike={handleLikeComment}
                      isLiking={likingIds.has(comment.commentId)}
                      isLiked={likedIds.has(comment.commentId)}
                    />
                  ))}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>

            {/* Add comment input */}
            <form
              onSubmit={handleAddComment}
              className="flex items-center gap-2.5 px-4 py-3 border-t border-border-subtle bg-card"
            >
              <Avatar name={useAuthStore.getState().nickname || 'Invitado'} size="sm" />
              <div className="flex-1 relative">
                <input
                  ref={commentInputRef}
                  type="text"
                  placeholder="Escribe un comentario..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  disabled={sendingComment}
                  className={[
                    'w-full border rounded-pill px-4 py-2.5 pr-11 font-body text-sm text-primary',
                    'placeholder:text-tertiary bg-muted',
                    'transition-colors duration-150',
                    'focus:outline-none focus:ring-2 focus:ring-accent-light focus:border-accent',
                    'border-border-subtle',
                    'disabled:opacity-50',
                  ].join(' ')}
                />
                <button
                  type="submit"
                  disabled={sendingComment || !commentText.trim()}
                  aria-label="Enviar comentario"
                  className={[
                    'absolute right-1.5 top-1/2 -translate-y-1/2',
                    'flex items-center justify-center w-8 h-8 rounded-full',
                    'bg-accent text-white',
                    'hover:bg-accent-dark',
                    'disabled:opacity-30 disabled:cursor-not-allowed',
                    'transition-all duration-150',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  ].join(' ')}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
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
