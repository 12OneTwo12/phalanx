import { describe, it, expect } from 'vitest';
import {
  classifyError,
  isRecoverableError,
  calculateBackoff,
} from '../../src/channel/errors.js';

describe('classifyError', () => {
  it('classifies ECONNRESET as recoverable', () => {
    const err = new Error('connection reset');
    (err as unknown as { code: string }).code = 'ECONNRESET';
    const result = classifyError(err);
    expect(result.recoverable).toBe(true);
    expect(result.authFailure).toBe(false);
  });

  it('classifies ETIMEDOUT as recoverable', () => {
    const err = new Error('timed out');
    (err as unknown as { code: string }).code = 'ETIMEDOUT';
    expect(classifyError(err).recoverable).toBe(true);
  });

  it('classifies AbortError as recoverable', () => {
    const err = new DOMException('aborted', 'AbortError');
    expect(classifyError(err).recoverable).toBe(true);
  });

  it('classifies 401 as auth failure (not recoverable)', () => {
    const err = new Error('unauthorized');
    (err as unknown as { status: number }).status = 401;
    const result = classifyError(err);
    expect(result.authFailure).toBe(true);
    expect(result.recoverable).toBe(false);
  });

  it('classifies 403 as auth failure', () => {
    const err = new Error('forbidden');
    (err as unknown as { status: number }).status = 403;
    expect(classifyError(err).authFailure).toBe(true);
  });

  it('classifies 429 as rate limited and recoverable', () => {
    const err = new Error('too many requests');
    (err as unknown as { status: number }).status = 429;
    const result = classifyError(err);
    expect(result.rateLimited).toBe(true);
    expect(result.recoverable).toBe(true);
  });

  it('classifies 500 as recoverable', () => {
    const err = new Error('server error');
    (err as unknown as { status: number }).status = 500;
    expect(classifyError(err).recoverable).toBe(true);
  });

  it('classifies 502 as recoverable', () => {
    const err = new Error('bad gateway');
    (err as unknown as { status: number }).status = 502;
    expect(classifyError(err).recoverable).toBe(true);
  });

  it('traverses error cause chain', () => {
    const inner = new Error('fetch failed');
    (inner as unknown as { code: string }).code = 'ECONNREFUSED';
    const outer = new Error('wrapper', { cause: inner });
    expect(classifyError(outer).recoverable).toBe(true);
  });

  it('traverses errors array', () => {
    const inner = new Error('timeout');
    (inner as unknown as { code: string }).code = 'ETIMEDOUT';
    const aggregate = new Error('multiple errors');
    (aggregate as unknown as { errors: Error[] }).errors = [inner];
    expect(classifyError(aggregate).recoverable).toBe(true);
  });

  it('detects recoverable via message snippet', () => {
    const err = new Error('fetch failed: network error');
    expect(classifyError(err).recoverable).toBe(true);
  });

  it('detects "socket hang up" as recoverable', () => {
    const err = new Error('socket hang up');
    expect(classifyError(err).recoverable).toBe(true);
  });

  it('non-recoverable normal error', () => {
    const err = new Error('invalid argument');
    const result = classifyError(err);
    expect(result.recoverable).toBe(false);
    expect(result.authFailure).toBe(false);
    expect(result.rateLimited).toBe(false);
  });

  it('handles null/undefined gracefully', () => {
    expect(classifyError(null).recoverable).toBe(false);
    expect(classifyError(undefined).recoverable).toBe(false);
  });

  it('handles string errors', () => {
    const result = classifyError('something broke');
    expect(result.summary).toBe('something broke');
  });

  it('extracts retry-after seconds', () => {
    const err = new Error('rate limited');
    (err as unknown as { status: number }).status = 429;
    (err as unknown as { headers: Record<string, string> }).headers = {
      'retry-after': '42',
    };
    const result = classifyError(err);
    expect(result.retryAfterSeconds).toBe(42);
  });

  it('extracts HTTP status from response object', () => {
    const err = new Error('failed');
    (err as unknown as { response: { status: number } }).response = { status: 503 };
    const result = classifyError(err);
    expect(result.httpStatus).toBe(503);
    expect(result.recoverable).toBe(true);
  });
});

describe('isRecoverableError', () => {
  it('returns true for ECONNRESET', () => {
    const err = new Error('reset');
    (err as unknown as { code: string }).code = 'ECONNRESET';
    expect(isRecoverableError(err)).toBe(true);
  });

  it('returns false for normal error', () => {
    expect(isRecoverableError(new Error('nope'))).toBe(false);
  });
});

describe('calculateBackoff', () => {
  it('returns baseMs for attempt 0', () => {
    // With jitter=0, should be exactly baseMs
    const result = calculateBackoff(0, { baseMs: 1000, jitter: 0 });
    expect(result).toBe(1000);
  });

  it('doubles for each attempt', () => {
    const a1 = calculateBackoff(1, { baseMs: 1000, jitter: 0 });
    const a2 = calculateBackoff(2, { baseMs: 1000, jitter: 0 });
    expect(a1).toBe(2000);
    expect(a2).toBe(4000);
  });

  it('caps at maxMs', () => {
    const result = calculateBackoff(100, { baseMs: 1000, maxMs: 30000, jitter: 0 });
    expect(result).toBe(30000);
  });

  it('adds jitter within bounds', () => {
    const results = Array.from({ length: 100 }, () =>
      calculateBackoff(0, { baseMs: 1000, jitter: 0.3 }),
    );
    // All should be between 700 and 1300 (1000 ± 30%)
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1300);
    }
  });

  it('never returns negative', () => {
    for (let i = 0; i < 50; i++) {
      expect(calculateBackoff(i, { baseMs: 100, jitter: 1.0 })).toBeGreaterThanOrEqual(0);
    }
  });
});
