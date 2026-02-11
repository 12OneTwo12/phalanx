import type { FailoverReason, FallbackAttempt } from './types.js';

// ---------------------------------------------------------------------------
// FailoverError
//
// Thrown when an LLM call fails in a way that should trigger fallback
// to the next model in the chain. Non-failover errors (e.g., invalid
// tool schema) are re-thrown as-is and do NOT trigger fallback.
// ---------------------------------------------------------------------------

export class FailoverError extends Error {
  readonly reason: FailoverReason;
  readonly provider?: string;
  readonly model?: string;
  readonly status?: number;

  constructor(
    message: string,
    opts: {
      reason: FailoverReason;
      provider?: string;
      model?: string;
      status?: number;
    },
  ) {
    super(message);
    this.name = 'FailoverError';
    this.reason = opts.reason;
    this.provider = opts.provider;
    this.model = opts.model;
    this.status = opts.status;
  }
}

// ---------------------------------------------------------------------------
// Error classification
//
// Pattern-match error messages to determine the failover reason.
// Only errors that return a non-null reason should trigger fallback.
// ---------------------------------------------------------------------------

type ErrorPattern = string | RegExp;

const ERROR_PATTERNS: Record<string, readonly ErrorPattern[]> = {
  rateLimit: [
    'rate limit',
    'rate_limit',
    'too many requests',
    'overloaded',
    'capacity',
    /\b429\b/,
    /\b529\b/,
  ],
  billing: [
    'billing',
    'payment',
    'credits',
    'balance',
    'quota exceeded',
    'insufficient',
    /\b402\b/,
  ],
  auth: [
    'authentication',
    'unauthorized',
    'forbidden',
    'access denied',
    'invalid api key',
    'expired',
    /\b401\b/,
    /\b403\b/,
  ],
  timeout: [
    'timeout',
    'timed out',
    'deadline exceeded',
    'etimedout',
    'econnaborted',
  ],
  contextOverflow: [
    'context length exceeded',
    'maximum context length',
    'request_too_large',
    'prompt is too long',
    'request size exceeds',
    'context window',
  ],
} as const;

function matchesPatterns(raw: string, patterns: readonly ErrorPattern[]): boolean {
  const lower = raw.toLowerCase();
  return patterns.some((p) =>
    p instanceof RegExp ? p.test(lower) : lower.includes(p),
  );
}

export function classifyFailoverReason(errorMessage: string): FailoverReason | null {
  if (!errorMessage) return null;
  if (matchesPatterns(errorMessage, ERROR_PATTERNS.rateLimit)) return 'rate_limit';
  if (matchesPatterns(errorMessage, ERROR_PATTERNS.billing)) return 'billing';
  if (matchesPatterns(errorMessage, ERROR_PATTERNS.auth)) return 'auth';
  if (matchesPatterns(errorMessage, ERROR_PATTERNS.timeout)) return 'timeout';
  if (matchesPatterns(errorMessage, ERROR_PATTERNS.contextOverflow)) return 'context_overflow';
  return null;
}

export function isFailoverEligible(error: unknown): boolean {
  if (error instanceof FailoverError) return true;
  if (error instanceof Error) {
    return classifyFailoverReason(error.message) !== null;
  }
  return false;
}

export function toFailoverError(error: unknown, provider: string, model: string): FailoverError {
  if (error instanceof FailoverError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const reason = classifyFailoverReason(message) ?? 'unknown';

  return new FailoverError(message, { reason, provider, model });
}

// ---------------------------------------------------------------------------
// runWithModelFallback<T>
//
// Generic wrapper that tries the primary model, then falls through the
// fallback chain on FailoverError. Non-failover errors are re-thrown.
// ---------------------------------------------------------------------------

export interface ModelFallbackParams<T> {
  /** Primary provider/model pair */
  primary: { provider: string; model: string };
  /** Ordered fallback candidates (provider/model format strings) */
  fallbacks: Array<{ provider: string; model: string }>;
  /** The actual LLM call to attempt */
  run: (provider: string, model: string) => Promise<T>;
  /** Called when an attempt fails (for logging/metrics) */
  onError?: (attempt: FallbackAttempt) => void;
  /** Check if a provider is available before attempting (optional) */
  isAvailable?: (provider: string) => boolean;
}

export interface ModelFallbackResult<T> {
  result: T;
  provider: string;
  model: string;
  attempts: FallbackAttempt[];
}

export async function runWithModelFallback<T>(
  params: ModelFallbackParams<T>,
): Promise<ModelFallbackResult<T>> {
  const candidates = [params.primary, ...params.fallbacks];
  const attempts: FallbackAttempt[] = [];

  for (const candidate of candidates) {
    // Skip unavailable providers
    if (params.isAvailable && !params.isAvailable(candidate.provider)) {
      const attempt: FallbackAttempt = {
        provider: candidate.provider,
        model: candidate.model,
        error: `Provider "${candidate.provider}" is unavailable (cooldown or not registered)`,
        reason: 'unknown',
        durationMs: 0,
      };
      attempts.push(attempt);
      params.onError?.(attempt);
      continue;
    }

    const startTime = Date.now();
    try {
      const result = await params.run(candidate.provider, candidate.model);
      return { result, provider: candidate.provider, model: candidate.model, attempts };
    } catch (err) {
      const durationMs = Date.now() - startTime;

      // Only failover-eligible errors trigger the next candidate
      if (!isFailoverEligible(err)) {
        throw err;
      }

      const failoverErr = toFailoverError(err, candidate.provider, candidate.model);
      const attempt: FallbackAttempt = {
        provider: candidate.provider,
        model: candidate.model,
        error: failoverErr.message,
        reason: failoverErr.reason,
        durationMs,
      };
      attempts.push(attempt);
      params.onError?.(attempt);
    }
  }

  throw new FailoverError(
    `All model candidates exhausted after ${attempts.length} attempts. ` +
      `Last error: ${attempts.at(-1)?.error ?? 'unknown'}`,
    {
      reason: attempts.at(-1)?.reason ?? 'unknown',
      provider: params.primary.provider,
      model: params.primary.model,
    },
  );
}
