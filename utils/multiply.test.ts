import { describe, it, expect } from 'vitest';
import { multiply } from './multiply';

describe('multiply', () => {
  it('should multiply two positive numbers', () => {
    expect(multiply(2, 3)).toBe(6);
    expect(multiply(5, 4)).toBe(20);
    expect(multiply(10, 10)).toBe(100);
  });

  it('should multiply negative numbers', () => {
    expect(multiply(-2, -3)).toBe(6);
    expect(multiply(-5, 4)).toBe(-20);
    expect(multiply(5, -4)).toBe(-20);
  });

  it('should handle zero', () => {
    expect(multiply(0, 0)).toBe(0);
    expect(multiply(0, 5)).toBe(0);
    expect(multiply(5, 0)).toBe(0);
    expect(multiply(-5, 0)).toBe(0);
    expect(multiply(0, -5)).toBe(0);
  });

  it('should multiply decimal numbers', () => {
    expect(multiply(0.5, 2)).toBe(1);
    expect(multiply(0.1, 0.2)).toBeCloseTo(0.02);
    expect(multiply(1.5, 2)).toBe(3);
    expect(multiply(-1.5, 2)).toBe(-3);
    expect(multiply(2.5, 4)).toBe(10);
  });

  it('should handle edge cases', () => {
    expect(multiply(1, 1)).toBe(1);
    expect(multiply(-1, 1)).toBe(-1);
    expect(multiply(1, -1)).toBe(-1);
    expect(multiply(-1, -1)).toBe(1);
  });
});