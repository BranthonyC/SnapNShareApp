import { useQuery } from '@tanstack/react-query';
import { getStats, type EventStats, type ApiError } from '../services/api';

/**
 * Fetches stats for a single event.
 * Enabled only when eventId is a non-empty string.
 * Stale time: 30 s — stats may change frequently.
 */
export function useStats(eventId: string | undefined | null) {
  return useQuery<EventStats, ApiError>({
    queryKey: ['stats', eventId],
    queryFn: () => getStats(eventId as string),
    enabled: typeof eventId === 'string' && eventId.length > 0,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error.status != null && [401, 403, 404].includes(error.status)) return false;
      return failureCount < 2;
    },
  });
}
