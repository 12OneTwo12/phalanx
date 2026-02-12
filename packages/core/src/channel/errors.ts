/**
 * Channel error classification and recovery utilities.
 *
 * Inspects error chains (cause, errors) to determine if an error
 * is recoverable (network glitch) or permanent (auth failure).
 * This drives reconnection vs. giving-up decisions.
 */

// ---------------------------------------------------------------------------
// Recoverable error classification
// ---------------------------------------------------------------------------

/** Error codes that indicate a transient network issue. */
const RECOVERABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_ABORTED',
  'ECONNABORTED',
  'ERR_NETWORK',
]);

/** Error names that indicate a transient issue. */
const RECOVERABLE_ERROR_NAMES = new Set([
  'AbortError',
  'TimeoutError',
  'ConnectTimeoutError',
  'HeadersTimeoutError',
  'BodyTimeoutError',
]);

/** Substrings in error messages that indicate transient issues. */
const RECOVERABLE_MESSAGE_SNIPPETS = [
  'fetch failed',
  'network error',
  'socket hang up',
  'getaddrinfo',
  'timeout',
  'timed out',
  'client network socket disconnected',
];

/** HTTP status codes that are retryable (server-side). */
const RETRYABLE_HTTP_STATUS_CODES = new Set([
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/** HTTP status codes that indicate permanent auth failure. */
const AUTH_FAILURE_STATUS_CODES = new Set([
  401, // Unauthorized
  403, // Forbidden
]);

// ---------------------------------------------------------------------------
// Error inspection
// ---------------------------------------------------------------------------

function getErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string') return code.toUpperCase();
  const errno = (err as { errno?: unknown }).errno;
  if (typeof errno === 'string') return errno.toUpperCase();
  return undefined;
}

function getErrorName(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  return (err as { name?: string }).name ?? '';
}

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

function getHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const status = (err as { status?: unknown }).status;
  if (typeof status === 'number') return status;
  const response = (err as { response?: { status?: unknown } }).response;
  if (response && typeof response.status === 'number') return response.status;
  return undefined;
}

/**
 * Collect all error candidates by traversing cause/errors chains.
 * Prevents infinite loops via a WeakSet.
 */
function collectErrorCandidates(err: unknown): unknown[] {
  const queue = [err];
  const seen = new WeakSet<object>();
  const candidates: unknown[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null) continue;
    if (typeof current === 'object' && seen.has(current)) continue;
    if (typeof current === 'object') seen.add(current);

    candidates.push(current);

    if (typeof current === 'object') {
      const cause = (current as { cause?: unknown }).cause;
      if (cause) queue.push(cause);

      const errors = (current as { errors?: unknown[] }).errors;
      if (Array.isArray(errors)) {
        for (const nested of errors) queue.push(nested);
      }
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ErrorClassification = {
  /** Whether the error is recoverable (transient network issue) */
  recoverable: boolean;
  /** Whether this is an authentication/authorization failure */
  authFailure: boolean;
  /** Whether rate-limited (should back off) */
  rateLimited: boolean;
  /** Human-readable summary */
  summary: string;
  /** HTTP status if available */
  httpStatus?: number;
  /** Retry-After header value in seconds, if available */
  retryAfterSeconds?: number;
};

/**
 * Classify an error to determine recovery strategy.
 * Traverses the full error chain.
 */
export function classifyError(err: unknown): ErrorClassification {
  const candidates = collectErrorCandidates(err);
  const summary = getErrorMessage(err);

  let recoverable = false;
  let authFailure = false;
  let rateLimited = false;
  let httpStatus: number | undefined;
  let retryAfterSeconds: number | undefined;

  for (const candidate of candidates) {
    // Check error codes
    const code = getErrorCode(candidate);
    if (code && RECOVERABLE_ERROR_CODES.has(code)) {
      recoverable = true;
    }

    // Check error names
    const name = getErrorName(candidate);
    if (name && RECOVERABLE_ERROR_NAMES.has(name)) {
      recoverable = true;
    }

    // Check error message snippets
    const msg = getErrorMessage(candidate).toLowerCase();
    if (RECOVERABLE_MESSAGE_SNIPPETS.some((s) => msg.includes(s))) {
      recoverable = true;
    }

    // Check HTTP status
    const status = getHttpStatus(candidate);
    if (status !== undefined) {
      httpStatus = status;
      if (RETRYABLE_HTTP_STATUS_CODES.has(status)) {
        recoverable = true;
      }
      if (AUTH_FAILURE_STATUS_CODES.has(status)) {
        authFailure = true;
        recoverable = false; // Auth failures are never recoverable by retry
      }
      if (status === 429) {
        rateLimited = true;
        // Try to extract Retry-After
        const retryAfter = (candidate as { headers?: { 'retry-after'?: string } })
          .headers?.['retry-after'];
        if (retryAfter) {
          const parsed = Number(retryAfter);
          if (!Number.isNaN(parsed)) retryAfterSeconds = parsed;
        }
      }
    }
  }

  return { recoverable, authFailure, rateLimited, summary, httpStatus, retryAfterSeconds };
}

/**
 * Shorthand: is this error worth retrying?
 */
export function isRecoverableError(err: unknown): boolean {
  return classifyError(err).recoverable;
}

// ---------------------------------------------------------------------------
// Backoff calculation
// ---------------------------------------------------------------------------

export interface BackoffOptions {
  /** Base delay in milliseconds (default: 1000) */
  baseMs?: number;
  /** Maximum delay in milliseconds (default: 60000) */
  maxMs?: number;
  /** Jitter factor 0-1 (default: 0.3) */
  jitter?: number;
}

/**
 * Calculate exponential backoff delay with jitter.
 * attempt=0 → baseMs, attempt=1 → 2*baseMs, etc.
 */
export function calculateBackoff(attempt: number, options: BackoffOptions = {}): number {
  const { baseMs = 1000, maxMs = 60_000, jitter = 0.3 } = options;
  const exponential = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const jitterAmount = exponential * jitter * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(exponential + jitterAmount));
}
