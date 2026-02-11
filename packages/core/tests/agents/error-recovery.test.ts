import { describe, it, expect } from 'vitest';
import {
  formatToolError,
  isRetryableError,
  shouldEscalate,
  MAX_CONSECUTIVE_TOOL_ERRORS,
} from '../../src/agents/error-recovery.js';

describe('MAX_CONSECUTIVE_TOOL_ERRORS', () => {
  it('is 3', () => {
    expect(MAX_CONSECUTIVE_TOOL_ERRORS).toBe(3);
  });
});

describe('formatToolError', () => {
  it('formats Error objects with tool name', () => {
    const error = new Error('file not found');
    const result = formatToolError(error, 'file_read');

    expect(result).toContain("Tool 'file_read' failed:");
    expect(result).toContain('file not found');
  });

  it('formats string errors', () => {
    const result = formatToolError('something went wrong', 'git_commit');

    expect(result).toContain("Tool 'git_commit' failed:");
    expect(result).toContain('something went wrong');
  });

  it('includes guidance message for LLM', () => {
    const result = formatToolError(new Error('oops'), 'shell_exec');

    expect(result).toContain('Please try a different approach or fix the parameters.');
  });
});

describe('isRetryableError', () => {
  it('returns true for timeout errors', () => {
    expect(isRetryableError(new Error('Request timeout'))).toBe(true);
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
  });

  it('returns true for rate limit errors', () => {
    expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
    expect(isRetryableError(new Error('rate limit reached for model'))).toBe(true);
  });

  it('returns true for connection reset errors', () => {
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableError(new Error('ENOTFOUND'))).toBe(true);
  });

  it('returns false for generic errors', () => {
    expect(isRetryableError(new Error('file not found'))).toBe(false);
    expect(isRetryableError(new Error('Invalid JSON'))).toBe(false);
    expect(isRetryableError(new Error('Permission denied'))).toBe(false);
  });

  it('handles non-Error values (strings)', () => {
    expect(isRetryableError('timeout occurred')).toBe(true);
    expect(isRetryableError('some random error')).toBe(false);
  });
});

describe('shouldEscalate', () => {
  it('returns false for 0, 1, 2 consecutive errors', () => {
    expect(shouldEscalate(0)).toBe(false);
    expect(shouldEscalate(1)).toBe(false);
    expect(shouldEscalate(2)).toBe(false);
  });

  it('returns true at MAX_CONSECUTIVE_TOOL_ERRORS (3)', () => {
    expect(shouldEscalate(3)).toBe(true);
  });

  it('returns true above MAX_CONSECUTIVE_TOOL_ERRORS', () => {
    expect(shouldEscalate(4)).toBe(true);
    expect(shouldEscalate(10)).toBe(true);
    expect(shouldEscalate(100)).toBe(true);
  });
});
