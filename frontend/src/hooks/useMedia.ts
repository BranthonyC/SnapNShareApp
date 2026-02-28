import { useInfiniteQuery } from '@tanstack/react-query';
import { listMedia, type MediaItem, type MediaListResponse, type ApiError } from '../services/api';

interface UseMediaResult {
  /** Flattened array of all loaded media items across all pages */
  items: MediaItem[];
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  error: ApiError | null;
}

const PAGE_LIMIT = 20;

/**
 * Infinite-scroll hook for event media.
 * Enabled only when eventId is a non-empty string.
 * Each page is fetched using the cursor returned by the previous page.
 */
export function useMedia(eventId: string | undefined | null): UseMediaResult {
  const query = useInfiniteQuery<MediaListResponse, ApiError>({
    queryKey: ['media', eventId],
    queryFn: ({ pageParam }) =>
      listMedia(eventId as string, pageParam as string | undefined, PAGE_LIMIT),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    enabled: typeof eventId === 'string' && eventId.length > 0,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error.status != null && [401, 403, 404].includes(error.status)) return false;
      return failureCount < 2;
    },
  });

  const items: MediaItem[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    items,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    error: query.error,
  };
}
