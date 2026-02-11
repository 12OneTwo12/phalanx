'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { fetcher, apiUrl } from '@/lib/api-client';
import type { ActivityLog } from '@phalanx/core';
import { useEventStream } from '@/hooks/use-event-stream';

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  debug: 'text-gray-500',
};

/** Debounce a value by the given delay in ms */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timerRef.current);
  }, [value, delayMs]);

  return debounced;
}

export default function ActivityPage() {
  const [filter, setFilter] = useState<{ agentId?: string; ticketId?: string }>({});
  const debouncedFilter = useDebouncedValue(filter, 300);

  const url = apiUrl('/activity', {
    agentId: debouncedFilter.agentId,
    ticketId: debouncedFilter.ticketId,
    limit: 200,
  });

  const { data: logs, isLoading, mutate: refreshLogs } = useSWR<ActivityLog[]>(url, fetcher);

  // Real-time refresh on activity events
  useEventStream({
    filterPrefix: 'activity:',
    onEvent: () => {
      void refreshLogs();
    },
  });

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Activity Log</h2>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <input
          type="text"
          placeholder="Filter by agent ID..."
          value={filter.agentId ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, agentId: e.target.value || undefined }))}
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Filter by ticket ID..."
          value={filter.ticketId ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, ticketId: e.target.value || undefined }))}
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        {(filter.agentId || filter.ticketId) && (
          <button
            onClick={() => setFilter({})}
            className="text-sm text-gray-400 hover:text-gray-200"
          >
            Clear
          </button>
        )}
      </div>

      {/* Log entries */}
      {isLoading ? (
        <p className="text-gray-500">Loading activity...</p>
      ) : !logs?.length ? (
        <p className="text-gray-500">No activity recorded yet.</p>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 rounded px-3 py-2 text-sm hover:bg-gray-900/50"
            >
              <span className="shrink-0 text-xs text-gray-600">{log.createdAt}</span>
              <span className={`shrink-0 w-12 text-xs font-medium ${LEVEL_COLORS[log.level] ?? 'text-gray-400'}`}>
                {log.level.toUpperCase()}
              </span>
              <span className="shrink-0 w-24 truncate text-xs text-gray-500" title={log.agentId ?? undefined}>
                {log.agentId ?? '—'}
              </span>
              <span className="flex-1 text-gray-300">{log.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
