import { describe, it, expect } from 'vitest';
import { multiply } from './multiply';

describe('multiply', () => {
  it('should multiply two positive numbers', () => {
    expect(multiply(2, 3)).toBe(6);
    expect(multiply(5, 4)).toBe(20);
    expect(multiply(10, 10)).toBe(100);
  });

  it('should multiply with zero', () => {
    expect(multiply(0, 5)).toBe(0);
    expect(multiply(7, 0)).toBe(0);
    expect(multiply(0, 0)).toBe(0);
  });

  it('should multiply negative numbers', () => {
    expect(multiply(-2, 3)).toBe(-6);
    expect(multiply(2, -3)).toBe(-6);
    expect(multiply(-2, -3)).toBe(6);
  });

  it('should multiply decimal numbers', () => {
    expect(multiply(0.5, 2)).toBe(1);
    expect(multiply(2.5, 4)).toBe(10);
    expect(multiply(0.1, 0.2)).toBeCloseTo(0.02);
  });

  it('should handle very large numbers', () => {
    expect(multiply(1000000, 1000000)).toBe(1000000000000);
  });

  it('should handle Infinity', () => {
    expect(multiply(Infinity, 2)).toBe(Infinity);
    expect(multiply(2, Infinity)).toBe(Infinity);
    expect(multiply(Infinity, Infinity)).toBe(Infinity);
    expect(multiply(Infinity, 0)).toBe(NaN);
  });

  it('should handle NaN', () => {
    expect(multiply(NaN, 2)).toBe(NaN);
    expect(multiply(2, NaN)).toBe(NaN);
    expect(multiply(NaN, NaN)).toBe(NaN);
  });

  it('should handle one as identity', () => {
    expect(multiply(1, 5)).toBe(5);
    expect(multiply(7, 1)).toBe(7);
    expect(multiply(1, 1)).toBe(1);
  });
});
