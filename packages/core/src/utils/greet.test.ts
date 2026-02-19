import { describe, it, expect } from 'vitest';
import { greet } from './greet';

describe('greet', () => {
  it('should greet a person by name', () => {
    expect(greet('Alice')).toBe('Hello, Alice!');
    expect(greet('Bob')).toBe('Hello, Bob!');
  });

  it('should trim whitespace from names', () => {
    expect(greet('  Alice  ')).toBe('Hello, Alice!');
    expect(greet('\tBob\n')).toBe('Hello, Bob!');
  });

  it('should handle empty names', () => {
    expect(greet('')).toBe('Hello, stranger!');
    expect(greet('   ')).toBe('Hello, stranger!');
  });

  it('should handle names with only whitespace', () => {
    expect(greet('\t\n')).toBe('Hello, stranger!');
  });

  it('should handle names with special characters', () => {
    expect(greet('José')).toBe('Hello, José!');
    expect(greet('Mary-Jane')).toBe('Hello, Mary-Jane!');
    expect(greet('O\'Connor')).toBe('Hello, O\'Connor!');
  });

  it('should handle names with numbers', () => {
    expect(greet('Agent007')).toBe('Hello, Agent007!');
  });
});