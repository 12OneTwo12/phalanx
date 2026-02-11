/**
 * Kanban column definitions derived from TicketStatus.
 */

export interface KanbanColumn {
  id: string;
  label: string;
  color: string;
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'pending_approval', label: 'Pending Approval', color: 'border-yellow-500' },
  { id: 'backlog', label: 'Backlog', color: 'border-gray-500' },
  { id: 'assigned', label: 'Assigned', color: 'border-purple-500' },
  { id: 'in_progress', label: 'In Progress', color: 'border-blue-500' },
  { id: 'verification', label: 'Verification', color: 'border-orange-500' },
  { id: 'done', label: 'Done', color: 'border-green-500' },
  { id: 'failed', label: 'Failed', color: 'border-red-500' },
  { id: 'escalated', label: 'Escalated', color: 'border-red-400' },
];

/** Group tickets by status into column buckets */
export function groupTicketsByStatus<T extends { status: string }>(
  tickets: T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const col of KANBAN_COLUMNS) {
    groups[col.id] = [];
  }
  for (const ticket of tickets) {
    if (groups[ticket.status]) {
      groups[ticket.status].push(ticket);
    }
  }
  return groups;
}
