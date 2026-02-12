import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  saveCredential,
  loadCredential,
  removeCredential,
  getCredentialSummary,
  _setCredentialPaths,
  _resetCredentialPaths,
} from '../../src/utils/credential-store.js';

describe('credential-store', () => {
  let tempDir: string;
  let credFile: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'phalanx-cred-test-'));
    credFile = join(tempDir, 'credentials.json');
    _setCredentialPaths(tempDir, credFile);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    _resetCredentialPaths();
  });

  describe('saveCredential + loadCredential', () => {
    it('saves and loads a credential', () => {
      saveCredential('anthropic', { secret: 'sk-test-key', authMode: 'api-key' });
      const loaded = loadCredential('anthropic');
      expect(loaded).toEqual({ secret: 'sk-test-key', authMode: 'api-key' });
    });

    it('returns null for unknown provider', () => {
      expect(loadCredential('nonexistent')).toBeNull();
    });

    it('stores multiple providers independently', () => {
      saveCredential('anthropic', { secret: 'sk-ant', authMode: 'token' });
      saveCredential('openai', { secret: 'sk-openai', authMode: 'oauth' });

      expect(loadCredential('anthropic')!.secret).toBe('sk-ant');
      expect(loadCredential('openai')!.secret).toBe('sk-openai');
    });

    it('overwrites existing credential for same provider', () => {
      saveCredential('anthropic', { secret: 'old-key', authMode: 'api-key' });
      saveCredential('anthropic', { secret: 'new-key', authMode: 'token' });

      const loaded = loadCredential('anthropic');
      expect(loaded!.secret).toBe('new-key');
      expect(loaded!.authMode).toBe('token');
    });

    it('preserves expiresAt field', () => {
      const expiresAt = '2026-12-31T23:59:59Z';
      saveCredential('openai', { secret: 'token', authMode: 'oauth', expiresAt });
      const loaded = loadCredential('openai');
      expect(loaded!.expiresAt).toBe(expiresAt);
    });

    it('sets file permissions to 0600', () => {
      saveCredential('anthropic', { secret: 'key', authMode: 'api-key' });
      const stats = statSync(credFile);
      // Check user-only read/write (0600 = 33216 in decimal on most systems)
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });
  });

  describe('removeCredential', () => {
    it('removes an existing credential', () => {
      saveCredential('anthropic', { secret: 'key', authMode: 'api-key' });
      removeCredential('anthropic');
      expect(loadCredential('anthropic')).toBeNull();
    });

    it('does nothing for nonexistent provider', () => {
      saveCredential('anthropic', { secret: 'key', authMode: 'api-key' });
      removeCredential('nonexistent');
      expect(loadCredential('anthropic')).not.toBeNull();
    });
  });

  describe('getCredentialSummary', () => {
    it('returns null when no credential exists', () => {
      expect(getCredentialSummary('anthropic')).toBeNull();
    });

    it('masks long secrets', () => {
      saveCredential('anthropic', {
        secret: 'sk-ant-oat01-abcdefghijklmnopqrstuvwxyz123456',
        authMode: 'token',
      });
      const summary = getCredentialSummary('anthropic');
      expect(summary).not.toBeNull();
      expect(summary!.authMode).toBe('token');
      expect(summary!.masked).toBe('sk-ant...3456');
    });

    it('masks short secrets with ****', () => {
      saveCredential('test', { secret: 'short', authMode: 'api-key' });
      const summary = getCredentialSummary('test');
      expect(summary!.masked).toBe('****');
    });
  });

  describe('graceful handling', () => {
    it('returns null from loadCredential when file does not exist', () => {
      expect(loadCredential('anything')).toBeNull();
    });

    it('returns empty when credentials file is corrupt', () => {
      const { writeFileSync, mkdirSync } = require('node:fs');
      mkdirSync(tempDir, { recursive: true });
      writeFileSync(credFile, 'not-json');
      expect(loadCredential('anthropic')).toBeNull();
    });
  });
});
