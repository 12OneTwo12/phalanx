import { eq, desc } from 'drizzle-orm';
import { channelMessages, type ChannelMessage, type NewChannelMessage } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class ChannelMessageRepository extends BaseRepository<typeof channelMessages, ChannelMessage, NewChannelMessage> {
  constructor(db: DrizzleDB) {
    super(db, channelMessages);
  }

  findByRole(role: ChannelMessage['role']): ChannelMessage[] {
    return this.db.select().from(channelMessages).where(eq(channelMessages.role, role)).all();
  }

  findRecent(limit: number = 50): ChannelMessage[] {
    return this.db.select().from(channelMessages)
      .orderBy(desc(channelMessages.createdAt))
      .limit(limit)
      .all();
  }
}
