import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';

const WS_URL = import.meta.env.VITE_WS_URL as string | undefined;

const PING_INTERVAL = 5 * 60 * 1000; // 5 min keep-alive
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30_000;

/**
 * Connects to the event WebSocket and auto-invalidates React Query caches
 * when other guests/hosts make changes (uploads, reactions, comments).
 *
 * Event isolation: the JWT token determines which eventId the connection
 * subscribes to — guests can only receive updates for their own event.
 */
export function useEventSocket(eventId: string | undefined) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (!WS_URL || !eventId || unmountedRef.current) return;

    const { token } = useAuthStore.getState();
    if (!token) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const url = `${WS_URL}?token=${encodeURIComponent(token)}&eventId=${encodeURIComponent(eventId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      // Keep-alive pings to prevent idle timeout (API Gateway = 10 min)
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);

        if (data.type === 'media_added') {
          queryClient.invalidateQueries({ queryKey: ['media', eventId] });
          queryClient.invalidateQueries({ queryKey: ['event', eventId] });
        } else {
          // reaction_changed, comment_added, comment_updated
          queryClient.invalidateQueries({ queryKey: ['media', eventId] });
        }
      } catch {
        // Ignore non-JSON messages (e.g., pong)
      }
    };

    ws.onclose = () => {
      clearInterval(pingRef.current);
      if (!unmountedRef.current) {
        const delay = Math.min(
          RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptRef.current),
          RECONNECT_MAX_DELAY,
        );
        reconnectAttemptRef.current++;
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      // onclose fires after onerror — reconnect handled there
    };
  }, [eventId, queryClient]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      clearInterval(pingRef.current);
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}
