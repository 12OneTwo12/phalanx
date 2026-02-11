'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { BusEvent } from '@/lib/event-bus';

export interface UseEventStreamOptions {
  /** URL of the SSE endpoint. Defaults to /api/events */
  url?: string;
  /** Filter events by type prefix (e.g. 'ticket:') */
  filterPrefix?: string;
  /** Callback invoked for each matching event */
  onEvent?: (event: BusEvent) => void;
  /** Auto-reconnect delay in ms. Default: 3000 */
  reconnectDelay?: number;
  /** Whether the stream is enabled. Default: true */
  enabled?: boolean;
}

export interface UseEventStreamReturn {
  /** Whether the SSE connection is currently open */
  connected: boolean;
  /** Last received event */
  lastEvent: BusEvent | null;
}

/**
 * React hook for consuming SSE events with auto-reconnect.
 */
export function useEventStream(options: UseEventStreamOptions = {}): UseEventStreamReturn {
  const {
    url = '/api/events',
    filterPrefix,
    onEvent,
    reconnectDelay = 3000,
    enabled = true,
  } = options;

  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<BusEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!enabled) return;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as BusEvent;
        if (filterPrefix && !event.type.startsWith(filterPrefix)) return;
        setLastEvent(event);
        onEventRef.current?.(event);
      } catch {
        // Ignore parse errors (e.g. heartbeat comments)
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Auto-reconnect with cleanup tracking
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, reconnectDelay);
    };
  }, [url, filterPrefix, reconnectDelay, enabled]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      setConnected(false);
    };
  }, [connect]);

  return { connected, lastEvent };
}
