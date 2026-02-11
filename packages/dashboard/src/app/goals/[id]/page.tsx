'use client';

import { use } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import type { Goal, Epic, Ticket } from '@phalanx/core';
import Link from 'next/link';

interface EpicWithTickets extends Epic {
  tickets: Ticket[];
}

interface GoalDetail extends Goal {
  epics: EpicWithTickets[];
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-gray-400',
};

export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: goal, isLoading } = useSWR<GoalDetail>(`/api/goals/${id}`, fetcher);

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!goal) return <p className="text-gray-500">Goal not found</p>;

  return (
    <div>
      <Link href="/goals" className="mb-4 inline-block text-sm text-gray-400 hover:text-gray-200">
        ← Back to Goals
      </Link>
      <h2 className="mb-2 text-2xl font-bold">{goal.description}</h2>
      <div className="mb-6 text-sm text-gray-400">
        Status: <span className="font-medium text-gray-200">{goal.status}</span> · Progress:{' '}
        <span className="font-medium text-gray-200">{Math.round(goal.progress * 100)}%</span>
      </div>

      {goal.epics.length === 0 ? (
        <p className="text-gray-500">No epics decomposed yet.</p>
      ) : (
        <div className="space-y-6">
          {goal.epics.map((epic) => (
            <div key={epic.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <h3 className="mb-1 text-lg font-semibold">{epic.title}</h3>
              {epic.description && (
                <p className="mb-3 text-sm text-gray-400">{epic.description}</p>
              )}
              {epic.tickets.length === 0 ? (
                <p className="text-sm text-gray-500">No tickets</p>
              ) : (
                <div className="space-y-2">
                  {epic.tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between rounded-md border border-gray-700 bg-gray-800 px-3 py-2"
                    >
                      <div>
                        <span className="text-sm font-medium">{ticket.title}</span>
                        <span className={`ml-2 text-xs ${PRIORITY_COLORS[ticket.priority] ?? ''}`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                        {ticket.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
