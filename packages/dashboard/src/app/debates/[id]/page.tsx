'use client';

import { use } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import { useEventStream } from '@/hooks/use-event-stream';
import Link from 'next/link';

interface DebateArgument {
  id: string;
  agentId: string;
  position: string;
  argument: string;
  evidence: string | null;
  round: number;
  createdAt: string;
}

interface DebateDetail {
  id: string;
  topic: string;
  roleGroup: string;
  status: string;
  conclusion: string | null;
  arguments: DebateArgument[];
  createdAt: string;
}

const POSITION_COLORS: Record<string, string> = {
  for: 'border-green-500 bg-green-500/10',
  against: 'border-red-500 bg-red-500/10',
  neutral: 'border-gray-500 bg-gray-500/10',
};

export default function DebateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: debate, isLoading, mutate } = useSWR<DebateDetail>(`/api/debates/${id}`, fetcher);

  useEventStream({
    filterPrefix: 'debate:',
    onEvent: () => void mutate(),
  });

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!debate) return <p className="text-gray-500">Debate not found</p>;

  return (
    <div>
      <Link href="/debates" className="mb-4 inline-block text-sm text-gray-400 hover:text-gray-200">
        &larr; Back to Debates
      </Link>

      <div className="mb-6">
        <h2 className="text-2xl font-bold">{debate.topic}</h2>
        <p className="mt-1 text-sm text-gray-400">
          Role Group: {debate.roleGroup} | Status: {debate.status}
        </p>
      </div>

      {debate.conclusion && (
        <div className="mb-6 rounded-lg border border-green-800 bg-green-900/20 p-4">
          <h3 className="mb-2 text-sm font-semibold text-green-400">Conclusion</h3>
          <p className="whitespace-pre-wrap text-sm text-gray-200">{debate.conclusion}</p>
        </div>
      )}

      <h3 className="mb-3 text-lg font-semibold">Arguments ({debate.arguments.length})</h3>

      {debate.arguments.length === 0 ? (
        <p className="py-4 text-center text-gray-600">No arguments yet</p>
      ) : (
        <div className="space-y-3">
          {debate.arguments.map((arg) => (
            <div
              key={arg.id}
              className={`rounded-lg border-l-4 p-4 ${POSITION_COLORS[arg.position] ?? POSITION_COLORS.neutral}`}
            >
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className="font-medium text-gray-300">{arg.agentId}</span>
                <span className="text-gray-500">Round {arg.round}</span>
                <span className="rounded bg-gray-700 px-1.5 py-0.5 text-gray-300">
                  {arg.position}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-200">{arg.argument}</p>
              {arg.evidence && (
                <p className="mt-2 text-xs text-gray-400">Evidence: {arg.evidence}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
