// ---------------------------------------------------------------------------
// Error Recovery Utilities
// ---------------------------------------------------------------------------

/** Maximum consecutive tool errors before escalation */
export const MAX_CONSECUTIVE_TOOL_ERRORS = 5;

/** Patterns indicating a transient (retryable) error */
const RETRYABLE_PATTERNS = [
  'timeout',
  'etimedout',
  'rate limit',
  'econnreset',
  'enotfound',
] as const;

/**
 * Format a tool error into an LLM-friendly feedback message.
 */
export function formatToolError(error: unknown, toolName: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return (
    `Tool '${toolName}' failed:\n` +
    `Error: ${message}\n` +
    `Please try a different approach or fix the parameters.`
  );
}

/**
 * Check if an error is transient and worth retrying.
 * Looks for common timeout, rate-limit, and network error patterns.
 */
export function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return RETRYABLE_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Determine if the agent should escalate based on consecutive tool errors.
 * Returns true when consecutiveErrors reaches MAX_CONSECUTIVE_TOOL_ERRORS.
 */
export function shouldEscalate(consecutiveErrors: number): boolean {
  return consecutiveErrors >= MAX_CONSECUTIVE_TOOL_ERRORS;
}
