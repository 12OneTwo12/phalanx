import { describe, it, expect } from 'vitest';
import { subtract } from './subtract';

describe('subtract', () => {
  it('should subtract two positive numbers', () => {
    expect(subtract(5, 3)).toBe(2);
    expect(subtract(10, 5)).toBe(5);
    expect(subtract(100, 10)).toBe(90);
  });

  it('should handle subtracting a larger number from a smaller number', () => {
    expect(subtract(3, 5)).toBe(-2);
    expect(subtract(5, 10)).toBe(-5);
  });

  it('should subtract with zero', () => {
    expect(subtract(5, 0)).toBe(5);
    expect(subtract(0, 5)).toBe(-5);
    expect(subtract(0, 0)).toBe(0);
  });

  it('should subtract negative numbers', () => {
    expect(subtract(-5, 3)).toBe(-8);
    expect(subtract(5, -3)).toBe(8);
    expect(subtract(-5, -3)).toBe(-2);
  });

  it('should subtract decimal numbers', () => {
    expect(subtract(2.5, 0.5)).toBe(2);
    expect(subtract(10.5, 5.2)).toBe(5.3);
    expect(subtract(0.3, 0.1)).toBeCloseTo(0.2);
  });

  it('should handle very large numbers', () => {
    expect(subtract(1000000000000, 1000000)).toBe(999999000000);
  });

  it('should handle Infinity', () => {
    expect(subtract(Infinity, 2)).toBe(Infinity);
    expect(subtract(2, Infinity)).toBe(-Infinity);
    expect(subtract(Infinity, Infinity)).toBe(NaN);
    expect(subtract(-Infinity, Infinity)).toBe(-Infinity);
  });

  it('should handle NaN', () => {
    expect(subtract(NaN, 2)).toBe(NaN);
    expect(subtract(2, NaN)).toBe(NaN);
    expect(subtract(NaN, NaN)).toBe(NaN);
  });
});