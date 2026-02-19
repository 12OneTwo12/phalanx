'use client';

import { use, useState, useCallback } from 'react';
import useSWR from 'swr';
import { fetcher, apiPatch, apiPost } from '@/lib/api-client';
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
  const { data: goal, isLoading, mutate } = useSWR<GoalDetail>(`/api/goals/${id}`, fetcher);
  const [decomposing, setDecomposing] = useState(false);
  const [decomposeError, setDecomposeError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleTicketAction = useCallback(async (ticketId: string, status: 'backlog' | 'failed') => {
    setActionLoading(ticketId);
    try {
      const body = status === 'backlog'
        ? { status, approvedAt: new Date().toISOString() }
        : { status };
      await apiPatch(`/tickets/${ticketId}`, body);
      await mutate();
    } finally {
      setActionLoading(null);
    }
  }, [mutate]);

  const handleRetry = useCallback(async (ticketId: string) => {
    setActionLoading(ticketId);
    try {
      await apiPost(`/tickets/${ticketId}/retry`, {});
      await mutate();
    } finally {
      setActionLoading(null);
    }
  }, [mutate]);

  const handleApproveAll = useCallback(async () => {
    if (!goal) return;
    const pending = goal.epics.flatMap((e) => e.tickets).filter((t) => t.status === 'pending_approval');
    if (pending.length === 0) return;
    setActionLoading('approve-all');
    try {
      await Promise.all(
        pending.map((t) =>
          apiPatch(`/tickets/${t.id}`, { status: 'backlog', approvedAt: new Date().toISOString() }),
        ),
      );
      await mutate();
    } finally {
      setActionLoading(null);
    }
  }, [goal, mutate]);

  const handleDecompose = useCallback(async () => {
    setDecomposing(true);
    setDecomposeError(null);
    try {
      await apiPost(`/goals/${id}/decompose`, { mode: 'llm' });
      await mutate();
    } catch (err) {
      setDecomposeError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDecomposing(false);
    }
  }, [id, mutate]);

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!goal) return <p className="text-gray-500">Goal not found</p>;

  return (
    <div>
      <Link href="/goals" className="mb-4 inline-block text-sm text-gray-400 hover:text-gray-200">
        ← Back to Goals
      </Link>
      <h2 className="mb-2 text-2xl font-bold">{goal.description}</h2>
      <div className="mb-6 flex items-center gap-4 text-sm text-gray-400">
        <span>
          Status: <span className="font-medium text-gray-200">{goal.status}</span> · Progress:{' '}
          <span className="font-medium text-gray-200">{Math.round(goal.progress)}%</span>
        </span>
        {goal.epics.length === 0 && (
          <button
            onClick={handleDecompose}
            disabled={decomposing}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {decomposing ? '🔄 Decomposing...' : '🧩 Decompose Goal'}
          </button>
        )}
      </div>

      {decomposeError && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {decomposeError}
        </div>
      )}

      {goal.epics.length === 0 ? (
        <p className="text-gray-500">No epics decomposed yet. Click &quot;Decompose Goal&quot; to auto-generate epics and tickets using AI.</p>
      ) : (
        <>
          {/* Batch approve button when there are pending tickets */}
          {goal.epics.some((e) => e.tickets.some((t) => t.status === 'pending_approval')) && (
            <div className="mb-4 flex gap-2">
              <button
                onClick={handleApproveAll}
                disabled={actionLoading === 'approve-all'}
                className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
              >
                {actionLoading === 'approve-all' ? 'Approving...' : 'Approve All Pending Tickets'}
              </button>
            </div>
          )}
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
                        <div className="min-w-0 flex-1">
                          <Link href={`/tickets/${ticket.id}`} className="text-sm font-medium hover:text-blue-400">
                            {ticket.title}
                          </Link>
                          <span className={`ml-2 text-xs ${PRIORITY_COLORS[ticket.priority] ?? ''}`}>
                            {ticket.priority}
                          </span>
                        </div>
                        <div className="ml-3 flex items-center gap-2">
                          <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                            {ticket.status}
                          </span>
                          {ticket.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => handleTicketAction(ticket.id, 'backlog')}
                                disabled={actionLoading === ticket.id}
                                className="rounded bg-green-600/20 px-2 py-1 text-xs text-green-400 hover:bg-green-600/30 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleTicketAction(ticket.id, 'failed')}
                                disabled={actionLoading === ticket.id}
                                className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-400 hover:bg-red-600/30 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {ticket.status === 'failed' && (
                            <button
                              onClick={() => handleRetry(ticket.id)}
                              disabled={actionLoading === ticket.id}
                              className="rounded bg-blue-600/20 px-2 py-1 text-xs text-blue-400 hover:bg-blue-600/30 disabled:opacity-50"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
