'use client';

import type { Ticket } from '@phalanx/core';
import { KANBAN_COLUMNS, groupTicketsByStatus } from '@/lib/ticket-columns';
import { KanbanCard } from './kanban-card';

interface KanbanBoardProps {
  tickets: Ticket[];
}

export function KanbanBoard({ tickets }: KanbanBoardProps) {
  const grouped = groupTicketsByStatus(tickets);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((col) => {
        const items = grouped[col.id] ?? [];
        return (
          <div
            key={col.id}
            role="region"
            aria-label={`${col.label} column, ${items.length} tickets`}
            className={`w-64 shrink-0 rounded-lg border-t-2 ${col.color} bg-gray-900 p-3`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">{col.label}</h3>
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((ticket) => (
                <KanbanCard key={ticket.id} ticket={ticket} />
              ))}
              {items.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-600">No tickets</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
