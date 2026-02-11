import type { ProviderHealth, ProviderStatus } from './types.js';

// ---------------------------------------------------------------------------
// Health tracker (for fallback chain)
// ---------------------------------------------------------------------------

const DEFAULT_COOLDOWN_MS = 60_000; // 1 minute cooldown on failure
const MAX_CONSECUTIVE_FAILURES = 3;

export class ProviderHealthTracker {
  private health = new Map<string, ProviderHealth>();
  private cooldownMs: number;

  constructor(cooldownMs = DEFAULT_COOLDOWN_MS) {
    this.cooldownMs = cooldownMs;
  }

  recordSuccess(providerName: string): void {
    const h = this.getOrCreate(providerName);
    h.status = 'healthy';
    h.lastSuccess = new Date();
    h.consecutiveFailures = 0;
    h.cooldownUntil = undefined;
  }

  recordFailure(providerName: string): void {
    const h = this.getOrCreate(providerName);
    h.lastFailure = new Date();
    h.consecutiveFailures += 1;

    if (h.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      h.status = 'cooldown';
      h.cooldownUntil = new Date(Date.now() + this.cooldownMs);
    } else {
      h.status = 'degraded';
    }
  }

  getStatus(providerName: string): ProviderStatus {
    const h = this.health.get(providerName);
    if (!h) return 'healthy'; // Unknown providers assumed healthy

    // Check if cooldown expired
    if (h.status === 'cooldown' && h.cooldownUntil && h.cooldownUntil <= new Date()) {
      h.status = 'degraded'; // Allow retry after cooldown
      h.cooldownUntil = undefined;
    }

    return h.status;
  }

  isAvailable(providerName: string): boolean {
    const status = this.getStatus(providerName);
    return status !== 'cooldown' && status !== 'unavailable';
  }

  getHealth(providerName: string): ProviderHealth {
    return this.getOrCreate(providerName);
  }

  getAllHealth(): ProviderHealth[] {
    return [...this.health.values()];
  }

  private getOrCreate(providerName: string): ProviderHealth {
    let h = this.health.get(providerName);
    if (!h) {
      h = {
        provider: providerName,
        status: 'healthy',
        consecutiveFailures: 0,
      };
      this.health.set(providerName, h);
    }
    return h;
  }
}
