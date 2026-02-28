import { useQuery } from '@tanstack/react-query';
import { getEvent, type EventData, type ApiError } from '../services/api';

/**
 * Fetches a single event by ID.
 * Enabled only when eventId is a non-empty string.
 * Stale time: 60 s — event metadata changes infrequently.
 */
export function useEvent(eventId: string | undefined | null) {
  return useQuery<EventData, ApiError>({
    queryKey: ['event', eventId],
    queryFn: () => getEvent(eventId as string),
    enabled: typeof eventId === 'string' && eventId.length > 0,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      // Do not retry on 401/403/404
      if (error.status != null && [401, 403, 404].includes(error.status)) return false;
      return failureCount < 2;
    },
  });
}
