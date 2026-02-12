'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import { useEventStream } from '@/hooks/use-event-stream';
import Link from 'next/link';

interface Debate {
  id: string;
  topic: string;
  roleGroup: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  active: 'bg-blue-500/20 text-blue-400',
  concluded: 'bg-green-500/20 text-green-400',
};

export default function DebatesPage() {
  const { data: debates, isLoading, mutate } = useSWR<Debate[]>('/api/debates', fetcher);

  useEventStream({
    filterPrefix: 'debate:',
    onEvent: () => void mutate(),
  });

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Debates</h2>

      {isLoading && <p className="text-gray-500">Loading...</p>}

      {!debates?.length && !isLoading ? (
        <p className="py-8 text-center text-gray-600">No debates yet</p>
      ) : (
        <div className="space-y-3">
          {debates?.map((d) => (
            <Link
              key={d.id}
              href={`/debates/${d.id}`}
              className="block rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">{d.topic}</h3>
                  <p className="mt-1 text-xs text-gray-500">Role Group: {d.roleGroup}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[d.status] ?? ''}`}>
                  {d.status}
                </span>
              </div>
              {d.conclusion && (
                <p className="mt-2 text-xs text-gray-400 line-clamp-2">{d.conclusion}</p>
              )}
              <p className="mt-2 text-xs text-gray-600">
                {new Date(d.createdAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
