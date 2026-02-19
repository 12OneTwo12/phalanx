import { describe, it, expect } from 'vitest';
import { greet } from './greet';

describe('greet', () => {
  it('should return a greeting message with the provided name', () => {
    expect(greet('World')).toBe('Hello, World!');
    expect(greet('Alice')).toBe('Hello, Alice!');
    expect(greet('Bob')).toBe('Hello, Bob!');
  });

  it('should handle empty string', () => {
    expect(greet('')).toBe('Hello, !');
  });

  it('should handle names with spaces', () => {
    expect(greet('John Doe')).toBe('Hello, John Doe!');
  });

  it('should handle names with special characters', () => {
    expect(greet('José')).toBe('Hello, José!');
    expect(greet('O\'Brien')).toBe('Hello, O\'Brien!');
  });

  it('should handle names with numbers', () => {
    expect(greet('User123')).toBe('Hello, User123!');
  });
});