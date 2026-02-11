'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import type { Agent } from '@phalanx/core';
import Link from 'next/link';

const STATUS_INDICATOR: Record<string, string> = {
  idle: 'bg-gray-500',
  running: 'bg-green-500 animate-pulse',
  completed: 'bg-blue-500',
  error: 'bg-red-500',
  escalated: 'bg-yellow-500',
};

const ROLE_ICONS: Record<string, string> = {
  'team-lead': '👑',
  backend: '⚙️',
  frontend: '🎨',
  qa: '🧪',
  devops: '🔧',
  customer: '👤',
};

export default function AgentsPage() {
  const { data: agents, isLoading } = useSWR<Agent[]>('/api/agents', fetcher);

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Agents</h2>
      {isLoading ? (
        <p className="text-gray-500">Loading agents...</p>
      ) : !agents?.length ? (
        <p className="text-gray-500">No agents registered.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{ROLE_ICONS[agent.role] ?? '🤖'}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{agent.name}</h3>
                    <span className={`h-2 w-2 rounded-full ${STATUS_INDICATOR[agent.status] ?? 'bg-gray-500'}`} />
                  </div>
                  <p className="text-sm text-gray-400">{agent.role}</p>
                </div>
              </div>
              {agent.currentTicketId && (
                <p className="mt-2 text-xs text-gray-500">
                  Working on: <span className="text-gray-400">{agent.currentTicketId}</span>
                </p>
              )}
              {agent.model && (
                <p className="mt-1 text-xs text-gray-600">{agent.model}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
