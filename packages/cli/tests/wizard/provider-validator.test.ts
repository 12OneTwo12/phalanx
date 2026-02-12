import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateAnthropicKey,
  validateAnthropicToken,
  validateOpenAIKey,
  validateGeminiKey,
  validateOllamaConnection,
  validateSetupTokenFormat,
  PROVIDER_ENV_VARS,
  PROVIDER_VALIDATORS,
} from '../../src/wizard/provider-validator.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('provider-validator', () => {
  describe('validateAnthropicKey', () => {
    it('returns valid on 200', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      const result = await validateAnthropicKey('sk-ant-test');
      expect(result).toEqual({ valid: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-api-key': 'sk-ant-test' }),
        }),
      );
    });

    it('returns invalid on 401', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });
      const result = await validateAnthropicKey('bad-key');
      expect(result).toEqual({ valid: false, error: 'Invalid API key' });
    });

    it('returns error on other status codes', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      const result = await validateAnthropicKey('key');
      expect(result).toEqual({ valid: false, error: 'HTTP 500' });
    });

    it('returns error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await validateAnthropicKey('key');
      expect(result).toEqual({ valid: false, error: 'ECONNREFUSED' });
    });
  });

  describe('validateAnthropicToken', () => {
    it('returns valid on 200 with Bearer auth', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      const result = await validateAnthropicToken('sk-ant-oat01-test');
      expect(result).toEqual({ valid: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer sk-ant-oat01-test' }),
        }),
      );
    });

    it('returns invalid on 401', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });
      const result = await validateAnthropicToken('bad-token');
      expect(result).toEqual({ valid: false, error: 'Invalid or expired token' });
    });

    it('returns error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await validateAnthropicToken('token');
      expect(result).toEqual({ valid: false, error: 'ECONNREFUSED' });
    });
  });

  describe('validateOpenAIKey', () => {
    it('returns valid on 200', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      const result = await validateOpenAIKey('sk-test');
      expect(result).toEqual({ valid: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          headers: { Authorization: 'Bearer sk-test' },
        }),
      );
    });

    it('returns invalid on 401', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });
      const result = await validateOpenAIKey('bad');
      expect(result).toEqual({ valid: false, error: 'Invalid API key' });
    });
  });

  describe('validateGeminiKey', () => {
    it('returns valid on 200', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      const result = await validateGeminiKey('AIza-test');
      expect(result).toEqual({ valid: true });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com/v1/models?key=AIza-test'),
        expect.anything(),
      );
    });

    it('returns invalid on 400', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 400 });
      const result = await validateGeminiKey('bad');
      expect(result).toEqual({ valid: false, error: 'Invalid API key' });
    });

    it('returns invalid on 403', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 403 });
      const result = await validateGeminiKey('bad');
      expect(result).toEqual({ valid: false, error: 'Invalid API key' });
    });
  });

  describe('validateOllamaConnection', () => {
    it('returns valid when reachable', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      const result = await validateOllamaConnection('http://localhost:11434');
      expect(result).toEqual({ valid: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.anything(),
      );
    });

    it('strips trailing slash from base URL', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      await validateOllamaConnection('http://localhost:11434/');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.anything(),
      );
    });

    it('returns error on connection failure', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await validateOllamaConnection('http://localhost:11434');
      expect(result).toEqual({ valid: false, error: 'ECONNREFUSED' });
    });
  });

  describe('PROVIDER_ENV_VARS', () => {
    it('maps all 4 providers', () => {
      expect(PROVIDER_ENV_VARS).toEqual({
        anthropic: 'ANTHROPIC_API_KEY',
        openai: 'OPENAI_API_KEY',
        gemini: 'GOOGLE_API_KEY',
        ollama: 'OLLAMA_BASE_URL',
      });
    });
  });

  describe('PROVIDER_VALIDATORS', () => {
    it('maps all 4 providers to functions', () => {
      expect(typeof PROVIDER_VALIDATORS.anthropic).toBe('function');
      expect(typeof PROVIDER_VALIDATORS.openai).toBe('function');
      expect(typeof PROVIDER_VALIDATORS.gemini).toBe('function');
      expect(typeof PROVIDER_VALIDATORS.ollama).toBe('function');
    });
  });

  describe('validateSetupTokenFormat', () => {
    it('returns valid for correct format', () => {
      const token = 'sk-ant-oat01-' + 'a'.repeat(80);
      expect(validateSetupTokenFormat(token)).toEqual({ valid: true });
    });

    it('rejects bad prefix', () => {
      const result = validateSetupTokenFormat('sk-ant-bad-' + 'a'.repeat(80));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sk-ant-oat01-');
    });

    it('rejects short token', () => {
      const result = validateSetupTokenFormat('sk-ant-oat01-short');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('80');
    });

    it('accepts exactly 80 chars', () => {
      const token = 'sk-ant-oat01-' + 'x'.repeat(67); // 13 + 67 = 80
      expect(validateSetupTokenFormat(token)).toEqual({ valid: true });
    });
  });
});
