import { eq } from 'drizzle-orm';
import { credentials, type Credential, type NewCredential } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class CredentialRepository extends BaseRepository<typeof credentials, Credential, NewCredential> {
  constructor(db: DrizzleDB) {
    super(db, credentials);
  }

  findByProviderId(providerConfigId: string): Credential[] {
    return this.db.select().from(credentials).where(eq(credentials.providerConfigId, providerConfigId)).all();
  }

  findByService(service: string): Credential[] {
    return this.db.select().from(credentials).where(eq(credentials.service, service)).all();
  }
}
