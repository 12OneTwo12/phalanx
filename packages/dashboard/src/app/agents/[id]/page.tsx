'use client';

import { use } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import type { Agent } from '@phalanx/core';
import Link from 'next/link';
import { SoulEditor } from '@/components/soul-editor';
import { useTicketTitles } from '@/hooks/use-ticket-titles';

const STATUS_BADGE: Record<string, string> = {
  idle: 'bg-gray-500/20 text-gray-400',
  running: 'bg-green-500/20 text-green-400',
  completed: 'bg-blue-500/20 text-blue-400',
  error: 'bg-red-500/20 text-red-400',
  escalated: 'bg-yellow-500/20 text-yellow-400',
};

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: agent, isLoading } = useSWR<Agent>(`/api/agents/${id}`, fetcher);
  const ticketTitles = useTicketTitles();

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!agent) return <p className="text-gray-500">Agent not found</p>;

  return (
    <div>
      <Link href="/agents" className="mb-4 inline-block text-sm text-gray-400 hover:text-gray-200">
        ← Back to Agents
      </Link>

      <div className="mb-6">
        <h2 className="text-2xl font-bold">{agent.name}</h2>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[agent.status] ?? ''}`}>
            {agent.status}
          </span>
          <span className="text-gray-400">Role: {agent.role}</span>
          {agent.provider && <span className="text-gray-500">{agent.provider}/{agent.model}</span>}
        </div>
        {agent.currentTicketId && (
          <p className="mt-2 text-sm text-gray-400">
            Currently working on:{' '}
            <Link href={`/tickets/${agent.currentTicketId}`} className="text-gray-300 hover:text-blue-400">
              {ticketTitles.get(agent.currentTicketId) ?? agent.currentTicketId}
            </Link>
          </p>
        )}
      </div>

      <h3 className="mb-3 text-lg font-semibold">Soul Configuration</h3>
      <SoulEditor agentId={id} />
    </div>
  );
}
