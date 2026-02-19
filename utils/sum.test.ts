import { describe, it, expect } from 'vitest';
import { sum } from './sum';

describe('sum', () => {
  it('should add two positive numbers', () => {
    expect(sum(2, 3)).toBe(5);
    expect(sum(10, 20)).toBe(30);
  });

  it('should add positive and negative numbers', () => {
    expect(sum(5, -3)).toBe(2);
    expect(sum(-5, 3)).toBe(-2);
  });

  it('should add two negative numbers', () => {
    expect(sum(-5, -3)).toBe(-8);
    expect(sum(-10, -20)).toBe(-30);
  });

  it('should handle zero correctly', () => {
    expect(sum(0, 5)).toBe(5);
    expect(sum(5, 0)).toBe(5);
    expect(sum(0, 0)).toBe(0);
  });

  it('should handle decimal numbers', () => {
    expect(sum(0.1, 0.2)).toBeCloseTo(0.3);
    expect(sum(1.5, 2.5)).toBe(4);
    expect(sum(-1.5, 2.5)).toBe(1);
  });
});