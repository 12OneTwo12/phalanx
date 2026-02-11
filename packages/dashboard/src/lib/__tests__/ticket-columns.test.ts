import { describe, it, expect } from 'vitest';
import { KANBAN_COLUMNS, groupTicketsByStatus } from '../ticket-columns';

describe('ticket-columns', () => {
  describe('KANBAN_COLUMNS', () => {
    it('should have 8 columns matching all ticket statuses', () => {
      expect(KANBAN_COLUMNS).toHaveLength(8);
      const ids = KANBAN_COLUMNS.map((c) => c.id);
      expect(ids).toContain('pending_approval');
      expect(ids).toContain('backlog');
      expect(ids).toContain('in_progress');
      expect(ids).toContain('done');
    });
  });

  describe('groupTicketsByStatus', () => {
    it('should group tickets by their status', () => {
      const tickets = [
        { id: '1', status: 'backlog' },
        { id: '2', status: 'backlog' },
        { id: '3', status: 'done' },
        { id: '4', status: 'in_progress' },
      ];

      const groups = groupTicketsByStatus(tickets);
      expect(groups['backlog']).toHaveLength(2);
      expect(groups['done']).toHaveLength(1);
      expect(groups['in_progress']).toHaveLength(1);
      expect(groups['pending_approval']).toHaveLength(0);
    });

    it('should return empty arrays for all columns when no tickets', () => {
      const groups = groupTicketsByStatus([]);
      for (const col of KANBAN_COLUMNS) {
        expect(groups[col.id]).toEqual([]);
      }
    });
  });
});
