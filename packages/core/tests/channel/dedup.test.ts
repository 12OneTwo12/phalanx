import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DedupCache } from '../../src/channel/dedup.js';

describe('DedupCache', () => {
  let cache: DedupCache;

  beforeEach(() => {
    cache = new DedupCache({ ttlMs: 1000, maxSize: 5 });
  });

  afterEach(() => {
    cache.dispose();
  });

  it('returns false for first occurrence of a key', () => {
    expect(cache.check('msg-1')).toBe(false);
  });

  it('returns true for duplicate key within TTL', () => {
    cache.check('msg-1');
    expect(cache.check('msg-1')).toBe(true);
  });

  it('allows reprocessing after TTL expires', async () => {
    vi.useFakeTimers();
    const shortCache = new DedupCache({ ttlMs: 100, maxSize: 10 });

    shortCache.check('msg-1');
    expect(shortCache.check('msg-1')).toBe(true); // duplicate

    vi.advanceTimersByTime(150);
    expect(shortCache.check('msg-1')).toBe(false); // expired, fresh

    shortCache.dispose();
    vi.useRealTimers();
  });

  it('evicts oldest when maxSize reached', () => {
    // Fill cache to max (5)
    cache.check('a');
    cache.check('b');
    cache.check('c');
    cache.check('d');
    cache.check('e');
    expect(cache.size).toBe(5);

    // Adding 6th should evict 'a'
    cache.check('f');
    expect(cache.size).toBe(5);
    // 'a' should now be fresh (was evicted)
    expect(cache.check('a')).toBe(false);
  });

  it('ignores undefined/empty keys', () => {
    expect(cache.check(undefined as unknown as string)).toBe(false);
    expect(cache.check('')).toBe(false);
    expect(cache.size).toBe(0);
  });

  it('gc removes expired entries', () => {
    vi.useFakeTimers();
    const gcCache = new DedupCache({ ttlMs: 100, maxSize: 100 });

    gcCache.check('a');
    gcCache.check('b');
    expect(gcCache.size).toBe(2);

    vi.advanceTimersByTime(150);
    gcCache.gc();
    expect(gcCache.size).toBe(0);

    gcCache.dispose();
    vi.useRealTimers();
  });

  it('dispose clears everything', () => {
    cache.check('a');
    cache.check('b');
    cache.dispose();
    expect(cache.size).toBe(0);
  });

  it('handles high volume without errors', () => {
    const bigCache = new DedupCache({ ttlMs: 60_000, maxSize: 1000 });
    for (let i = 0; i < 2000; i++) {
      bigCache.check(`msg-${i}`);
    }
    // Should be capped at maxSize
    expect(bigCache.size).toBeLessThanOrEqual(1000);
    bigCache.dispose();
  });
});
