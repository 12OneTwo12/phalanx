'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Ticket } from '@phalanx/core';
import { apiPatch } from '@/lib/api-client';
import { mutate } from 'swr';

const PRIORITY_DOTS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-500',
};

interface KanbanCardProps {
  ticket: Ticket;
  agentNames?: Map<string, string>;
}

/** Kanban card component with approve/reject actions for pending tickets */
export function KanbanCard({ ticket, agentNames }: KanbanCardProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setActionError(null);
    setLoading(true);
    try {
      await apiPatch(`/tickets/${ticket.id}`, { status: 'backlog', approvedAt: new Date().toISOString() });
      await mutate('/api/tickets');
    } catch {
      setActionError('Failed to approve ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setActionError(null);
    setLoading(true);
    try {
      await apiPatch(`/tickets/${ticket.id}`, { status: 'failed' });
      await mutate('/api/tickets');
    } catch {
      setActionError('Failed to reject ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-md border border-gray-700 bg-gray-800 p-3">
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOTS[ticket.priority] ?? 'bg-gray-500'}`} />
        <div className="min-w-0 flex-1">
          <Link href={`/tickets/${ticket.id}`} className="text-sm font-medium leading-tight hover:text-blue-400">
            {ticket.title}
          </Link>
          {ticket.assignedAgentId && (
            <p className="mt-1 text-xs text-gray-500">
              Agent: {agentNames?.get(ticket.assignedAgentId) ?? ticket.assignedAgentId}
            </p>
          )}
        </div>
      </div>

      {/* Approval actions for pending tickets */}
      {ticket.status === 'pending_approval' && (
        <div className="mt-2 flex flex-col gap-1">
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={loading}
              aria-label={`Approve ticket: ${ticket.title}`}
              className="rounded bg-green-600/20 px-2 py-1 text-xs text-green-400 hover:bg-green-600/30 disabled:opacity-50"
            >
              ✓ Approve
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              aria-label={`Reject ticket: ${ticket.title}`}
              className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-400 hover:bg-red-600/30 disabled:opacity-50"
            >
              ✗ Reject
            </button>
          </div>
          {actionError && (
            <p className="text-xs text-red-400">{actionError}</p>
          )}
        </div>
      )}
    </div>
  );
}
