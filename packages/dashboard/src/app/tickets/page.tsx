'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import type { Ticket } from '@phalanx/core';
import { KanbanBoard } from '@/components/kanban-board';
import { useEventStream } from '@/hooks/use-event-stream';
import { useAgentNames } from '@/hooks/use-agent-names';

export default function TicketsPage() {
  const { data: tickets, isLoading, mutate: refreshTickets } = useSWR<Ticket[]>('/api/tickets', fetcher);
  const agentNames = useAgentNames();

  // Auto-refresh when ticket events arrive
  useEventStream({
    filterPrefix: 'ticket:',
    onEvent: () => {
      void refreshTickets();
    },
  });

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Ticket Board</h2>
      {isLoading ? (
        <p className="text-gray-500">Loading tickets...</p>
      ) : !tickets?.length ? (
        <p className="text-gray-500">No tickets yet. Tickets are created when goals are decomposed.</p>
      ) : (
        <KanbanBoard tickets={tickets} agentNames={agentNames} />
      )}
    </div>
  );
}
