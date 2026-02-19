import { describe, it, expect } from 'vitest';
import { sum } from './sum.js';

describe('sum', () => {
  it('should add two positive numbers correctly', () => {
    expect(sum(2, 3)).toBe(5);
    expect(sum(10, 20)).toBe(30);
    expect(sum(100, 200)).toBe(300);
  });

  it('should add negative numbers correctly', () => {
    expect(sum(-5, -3)).toBe(-8);
    expect(sum(-10, 5)).toBe(-5);
    expect(sum(10, -5)).toBe(5);
  });

  it('should handle zero correctly', () => {
    expect(sum(0, 0)).toBe(0);
    expect(sum(5, 0)).toBe(5);
    expect(sum(0, 5)).toBe(5);
    expect(sum(-5, 0)).toBe(-5);
  });

  it('should add decimal numbers correctly', () => {
    expect(sum(0.1, 0.2)).toBeCloseTo(0.3);
    expect(sum(1.5, 2.5)).toBe(4);
    expect(sum(-1.5, 2.5)).toBe(1);
  });

  it('should handle large numbers', () => {
    expect(sum(1000000, 2000000)).toBe(3000000);
    expect(sum(Number.MAX_SAFE_INTEGER - 1, 1)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('should handle edge cases with infinity', () => {
    expect(sum(Infinity, 1)).toBe(Infinity);
    expect(sum(-Infinity, 1)).toBe(-Infinity);
    expect(sum(Infinity, -Infinity)).toBeNaN();
  });

  it('should handle NaN inputs', () => {
    expect(sum(NaN, 1)).toBeNaN();
    expect(sum(1, NaN)).toBeNaN();
    expect(sum(NaN, NaN)).toBeNaN();
  });
});