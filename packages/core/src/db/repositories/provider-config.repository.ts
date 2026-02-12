import { eq } from 'drizzle-orm';
import { providerConfigs, type ProviderConfigRow, type NewProviderConfigRow } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class ProviderConfigRepository extends BaseRepository<typeof providerConfigs, ProviderConfigRow, NewProviderConfigRow> {
  constructor(db: DrizzleDB) {
    super(db, providerConfigs);
  }

  findByType(type: ProviderConfigRow['type']): ProviderConfigRow[] {
    return this.db.select().from(providerConfigs).where(eq(providerConfigs.type, type)).all();
  }

  findEnabled(): ProviderConfigRow[] {
    return this.db.select().from(providerConfigs).where(eq(providerConfigs.enabled, true)).all();
  }
}
