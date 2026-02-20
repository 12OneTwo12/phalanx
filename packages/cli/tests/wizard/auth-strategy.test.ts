import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiKeyAuthStrategy,
  CodexOAuthStrategy,
  getProviderAuthStrategies,
} from '../../src/wizard/auth-strategy.js';
import {
  _setCredentialPaths,
  _resetCredentialPaths,
  saveCredential,
} from '../../src/utils/credential-store.js';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock fetch for validation tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('auth-strategy', () => {
  let tempDir: string;

  beforeEach(() => {
    mockFetch.mockReset();
    tempDir = mkdtempSync(join(tmpdir(), 'phalanx-auth-test-'));
    _setCredentialPaths(tempDir, join(tempDir, 'credentials.json'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    _resetCredentialPaths();
    vi.restoreAllMocks();
  });

  describe('ApiKeyAuthStrategy', () => {
    it('detects env var when set', () => {
      const original = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'sk-test-key';
      try {
        const strategy = new ApiKeyAuthStrategy('Anthropic', 'ANTHROPIC_API_KEY', vi.fn());
        const result = strategy.detect();
        expect(result.found).toBe(true);
        expect(result.source).toBe('env:ANTHROPIC_API_KEY');
        expect(result.credential!.secret).toBe('sk-test-key');
        expect(result.credential!.authMode).toBe('api-key');
      } finally {
        if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
        else process.env.ANTHROPIC_API_KEY = original;
      }
    });

    it('returns not found when env var is unset', () => {
      const original = process.env.TEST_NO_KEY;
      delete process.env.TEST_NO_KEY;
      try {
        const strategy = new ApiKeyAuthStrategy('Test', 'TEST_NO_KEY', vi.fn());
        const result = strategy.detect();
        expect(result.found).toBe(false);
      } finally {
        if (original !== undefined) process.env.TEST_NO_KEY = original;
      }
    });

    it('validates using the provided validator', async () => {
      const validator = vi.fn().mockResolvedValue({ valid: true });
      const strategy = new ApiKeyAuthStrategy('Test', 'TEST_KEY', validator);
      const result = await strategy.validate({ secret: 'my-key', authMode: 'api-key' });
      expect(result.valid).toBe(true);
      expect(validator).toHaveBeenCalledWith('my-key');
    });

    it('has correct metadata', () => {
      const strategy = new ApiKeyAuthStrategy('Anthropic', 'ANTHROPIC_API_KEY', vi.fn());
      expect(strategy.id).toBe('api-key');
      expect(strategy.authMode).toBe('api-key');
      expect(strategy.label).toContain('ANTHROPIC_API_KEY');
    });
  });

  describe('CodexOAuthStrategy', () => {
    it('returns not found when ~/.codex/auth.json does not exist', () => {
      const strategy = new CodexOAuthStrategy(join(tempDir, 'nonexistent', 'auth.json'));
      const result = strategy.detect();
      expect(result.found).toBe(false);
    });

    it('detects valid credentials from auth.json', () => {
      const authDir = join(tempDir, '.codex');
      mkdirSync(authDir, { recursive: true });
      writeFileSync(
        join(authDir, 'auth.json'),
        JSON.stringify({ access_token: 'test-access-token' }),
      );

      const strategy = new CodexOAuthStrategy(join(authDir, 'auth.json'));
      const result = strategy.detect();
      expect(result.found).toBe(true);
      expect(result.credential!.secret).toBe('test-access-token');
      expect(result.credential!.authMode).toBe('oauth');
    });

    it('returns not found for expired token', () => {
      const authDir = join(tempDir, '.codex');
      mkdirSync(authDir, { recursive: true });
      writeFileSync(
        join(authDir, 'auth.json'),
        JSON.stringify({
          access_token: 'expired-token',
          expires_at: '2020-01-01T00:00:00Z',
        }),
      );

      const strategy = new CodexOAuthStrategy(join(authDir, 'auth.json'));
      const result = strategy.detect();
      expect(result.found).toBe(false);
    });

    it('validates using OpenAI endpoint', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      const strategy = new CodexOAuthStrategy();
      const result = await strategy.validate({ secret: 'access-token', authMode: 'oauth' });
      expect(result.valid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.anything(),
      );
    });

    it('has correct metadata', () => {
      const strategy = new CodexOAuthStrategy();
      expect(strategy.id).toBe('codex-oauth');
      expect(strategy.authMode).toBe('oauth');
      expect(strategy.label).toContain('Codex');
    });
  });

  describe('getProviderAuthStrategies', () => {
    it('returns 1 strategy for anthropic (api-key only)', () => {
      const strategies = getProviderAuthStrategies('anthropic');
      expect(strategies).toHaveLength(1);
      expect(strategies[0].id).toBe('api-key');
    });

    it('returns 2 strategies for openai', () => {
      const strategies = getProviderAuthStrategies('openai');
      expect(strategies).toHaveLength(2);
      expect(strategies[0].id).toBe('api-key');
      expect(strategies[1].id).toBe('codex-oauth');
    });

    it('returns 1 strategy for gemini', () => {
      const strategies = getProviderAuthStrategies('gemini');
      expect(strategies).toHaveLength(1);
      expect(strategies[0].id).toBe('api-key');
    });

    it('returns empty for ollama', () => {
      expect(getProviderAuthStrategies('ollama')).toHaveLength(0);
    });

    it('returns empty for unknown provider', () => {
      expect(getProviderAuthStrategies('unknown')).toHaveLength(0);
    });
  });
});
