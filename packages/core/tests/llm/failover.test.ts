import { describe, it, expect, vi } from 'vitest';
import {
  FailoverError,
  classifyFailoverReason,
  isFailoverEligible,
  toFailoverError,
  runWithModelFallback,
} from '../../src/llm/failover.js';

// ---------------------------------------------------------------------------
// classifyFailoverReason
// ---------------------------------------------------------------------------

describe('classifyFailoverReason', () => {
  it('detects rate limit errors', () => {
    expect(classifyFailoverReason('rate limit exceeded')).toBe('rate_limit');
    expect(classifyFailoverReason('too many requests')).toBe('rate_limit');
    expect(classifyFailoverReason('Error 429: overloaded')).toBe('rate_limit');
    expect(classifyFailoverReason('status 529')).toBe('rate_limit');
  });

  it('detects billing errors', () => {
    expect(classifyFailoverReason('billing issue')).toBe('billing');
    expect(classifyFailoverReason('quota exceeded')).toBe('billing');
    expect(classifyFailoverReason('insufficient credits')).toBe('billing');
    expect(classifyFailoverReason('Error 402')).toBe('billing');
  });

  it('detects auth errors', () => {
    expect(classifyFailoverReason('unauthorized')).toBe('auth');
    expect(classifyFailoverReason('invalid api key')).toBe('auth');
    expect(classifyFailoverReason('Error 401')).toBe('auth');
    expect(classifyFailoverReason('Error 403: forbidden')).toBe('auth');
  });

  it('detects timeout errors', () => {
    expect(classifyFailoverReason('request timed out')).toBe('timeout');
    expect(classifyFailoverReason('ETIMEDOUT')).toBe('timeout');
    expect(classifyFailoverReason('deadline exceeded')).toBe('timeout');
  });

  it('detects context overflow errors', () => {
    expect(classifyFailoverReason('context length exceeded')).toBe('context_overflow');
    expect(classifyFailoverReason('request_too_large')).toBe('context_overflow');
    expect(classifyFailoverReason('prompt is too long')).toBe('context_overflow');
  });

  it('returns null for unrecognized errors', () => {
    expect(classifyFailoverReason('something weird happened')).toBeNull();
    expect(classifyFailoverReason('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isFailoverEligible
// ---------------------------------------------------------------------------

describe('isFailoverEligible', () => {
  it('returns true for FailoverError', () => {
    const err = new FailoverError('rate limited', { reason: 'rate_limit' });
    expect(isFailoverEligible(err)).toBe(true);
  });

  it('returns true for errors with classifiable message', () => {
    expect(isFailoverEligible(new Error('rate limit exceeded'))).toBe(true);
    expect(isFailoverEligible(new Error('Error 429'))).toBe(true);
  });

  it('returns false for non-failover errors', () => {
    expect(isFailoverEligible(new Error('invalid tool schema'))).toBe(false);
    expect(isFailoverEligible('string error')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toFailoverError
// ---------------------------------------------------------------------------

describe('toFailoverError', () => {
  it('returns existing FailoverError as-is', () => {
    const err = new FailoverError('test', { reason: 'rate_limit', provider: 'a', model: 'b' });
    expect(toFailoverError(err, 'x', 'y')).toBe(err);
  });

  it('wraps regular error', () => {
    const err = new Error('rate limit');
    const result = toFailoverError(err, 'openai', 'gpt-4o');
    expect(result).toBeInstanceOf(FailoverError);
    expect(result.reason).toBe('rate_limit');
    expect(result.provider).toBe('openai');
  });

  it('defaults to unknown for unclassifiable errors', () => {
    const result = toFailoverError(new Error('random'), 'openai', 'gpt-4o');
    expect(result.reason).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// runWithModelFallback
// ---------------------------------------------------------------------------

describe('runWithModelFallback', () => {
  it('returns primary result on success', async () => {
    const result = await runWithModelFallback({
      primary: { provider: 'anthropic', model: 'sonnet' },
      fallbacks: [],
      run: async () => 'ok',
    });
    expect(result.result).toBe('ok');
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('sonnet');
    expect(result.attempts).toEqual([]);
  });

  it('falls back on failover-eligible error', async () => {
    let callCount = 0;
    const result = await runWithModelFallback({
      primary: { provider: 'anthropic', model: 'sonnet' },
      fallbacks: [{ provider: 'openai', model: 'gpt-4o' }],
      run: async (provider) => {
        callCount++;
        if (provider === 'anthropic') {
          throw new FailoverError('rate limited', { reason: 'rate_limit' });
        }
        return 'fallback-ok';
      },
    });

    expect(callCount).toBe(2);
    expect(result.result).toBe('fallback-ok');
    expect(result.provider).toBe('openai');
    expect(result.attempts.length).toBe(1);
    expect(result.attempts[0].reason).toBe('rate_limit');
  });

  it('re-throws non-failover errors', async () => {
    await expect(
      runWithModelFallback({
        primary: { provider: 'anthropic', model: 'sonnet' },
        fallbacks: [{ provider: 'openai', model: 'gpt-4o' }],
        run: async () => {
          throw new Error('invalid tool schema');
        },
      }),
    ).rejects.toThrow('invalid tool schema');
  });

  it('throws FailoverError when all candidates exhausted', async () => {
    await expect(
      runWithModelFallback({
        primary: { provider: 'anthropic', model: 'sonnet' },
        fallbacks: [{ provider: 'openai', model: 'gpt-4o' }],
        run: async () => {
          throw new FailoverError('rate limited', { reason: 'rate_limit' });
        },
      }),
    ).rejects.toThrow('All model candidates exhausted');
  });

  it('skips unavailable providers', async () => {
    const result = await runWithModelFallback({
      primary: { provider: 'anthropic', model: 'sonnet' },
      fallbacks: [{ provider: 'openai', model: 'gpt-4o' }],
      run: async (_p, _m) => 'ok',
      isAvailable: (p) => p !== 'anthropic',
    });

    expect(result.provider).toBe('openai');
    expect(result.attempts.length).toBe(1);
    expect(result.attempts[0].provider).toBe('anthropic');
  });

  it('calls onError for each failed attempt', async () => {
    const onError = vi.fn();

    await expect(
      runWithModelFallback({
        primary: { provider: 'a', model: 'x' },
        fallbacks: [{ provider: 'b', model: 'y' }],
        run: async () => {
          throw new FailoverError('fail', { reason: 'timeout' });
        },
        onError,
      }),
    ).rejects.toThrow();

    expect(onError).toHaveBeenCalledTimes(2);
  });
});
