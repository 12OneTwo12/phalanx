/**
 * Message deduplication cache.
 *
 * Prevents processing the same inbound message twice, which can happen
 * during reconnections, polling overlaps, or webhook retries.
 * Uses a bounded LRU-like approach with TTL expiration.
 */

export interface DedupCacheOptions {
  /** Time-to-live for entries in milliseconds (default: 5 minutes) */
  ttlMs?: number;
  /** Maximum number of entries (default: 2000) */
  maxSize?: number;
}

interface DedupEntry {
  insertedAt: number;
}

export class DedupCache {
  private readonly entries = new Map<string, DedupEntry>();
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private gcTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: DedupCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60_000;
    this.maxSize = options.maxSize ?? 2000;

    // Periodic garbage collection every 60s
    this.gcTimer = setInterval(() => this.gc(), 60_000);
    // Don't keep the process alive for GC
    if (this.gcTimer && typeof this.gcTimer === 'object' && 'unref' in this.gcTimer) {
      this.gcTimer.unref();
    }
  }

  /**
   * Check if a key was already seen. If not, records it.
   * Returns true if this is a DUPLICATE (should skip processing).
   */
  check(key: string | undefined): boolean {
    if (!key) return false;

    const now = Date.now();
    const existing = this.entries.get(key);

    if (existing) {
      // Still within TTL → duplicate
      if (now - existing.insertedAt < this.ttlMs) {
        return true;
      }
      // Expired → allow reprocessing
      this.entries.delete(key);
    }

    // Evict oldest if at capacity
    if (this.entries.size >= this.maxSize) {
      const firstKey = this.entries.keys().next().value;
      if (firstKey !== undefined) {
        this.entries.delete(firstKey);
      }
    }

    this.entries.set(key, { insertedAt: now });
    return false;
  }

  /** Number of entries currently in the cache. */
  get size(): number {
    return this.entries.size;
  }

  /** Remove expired entries. */
  gc(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.insertedAt >= this.ttlMs) {
        this.entries.delete(key);
      }
    }
  }

  /** Clear all entries and stop GC timer. */
  dispose(): void {
    this.entries.clear();
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }
}
