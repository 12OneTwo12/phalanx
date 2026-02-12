'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import { useEventStream } from '@/hooks/use-event-stream';
import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  type: string;
  status: string;
  summary: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-yellow-500/20 text-yellow-400',
  active: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
};

const TYPE_BADGE: Record<string, string> = {
  standup: 'bg-purple-500/20 text-purple-400',
  review: 'bg-blue-500/20 text-blue-400',
  planning: 'bg-green-500/20 text-green-400',
  retrospective: 'bg-orange-500/20 text-orange-400',
};

export default function MeetingsPage() {
  const { data: meetings, isLoading, mutate } = useSWR<Meeting[]>('/api/meetings', fetcher);

  useEventStream({
    filterPrefix: 'meeting:',
    onEvent: () => void mutate(),
  });

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Meetings</h2>

      {isLoading && <p className="text-gray-500">Loading...</p>}

      {!meetings?.length && !isLoading ? (
        <p className="py-8 text-center text-gray-600">No meetings yet</p>
      ) : (
        <div className="space-y-3">
          {meetings?.map((m) => (
            <Link
              key={m.id}
              href={`/meetings/${m.id}`}
              className="block rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">{m.title}</h3>
                  <div className="mt-1 flex gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${TYPE_BADGE[m.type] ?? ''}`}>
                      {m.type}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[m.status] ?? ''}`}>
                      {m.status}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-gray-600">
                  {new Date(m.createdAt).toLocaleDateString()}
                </span>
              </div>
              {m.summary && (
                <p className="mt-2 text-xs text-gray-400 line-clamp-2">{m.summary}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
