import { eq, desc } from 'drizzle-orm';
import { ticketComments, type TicketComment, type NewTicketComment } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class TicketCommentRepository extends BaseRepository<typeof ticketComments, TicketComment, NewTicketComment> {
  constructor(db: DrizzleDB) {
    super(db, ticketComments);
  }

  findByTicketId(ticketId: string): TicketComment[] {
    return this.db
      .select()
      .from(ticketComments)
      .where(eq(ticketComments.ticketId, ticketId))
      .orderBy(desc(ticketComments.createdAt))
      .all();
  }

  findByAuthor(author: string): TicketComment[] {
    return this.db
      .select()
      .from(ticketComments)
      .where(eq(ticketComments.author, author))
      .all();
  }
}
