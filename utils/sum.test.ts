import { describe, it, expect } from 'vitest';
import { sum } from './sum';

describe('sum', () => {
  it('should add two positive numbers', () => {
    expect(sum(1, 2)).toBe(3);
    expect(sum(10, 20)).toBe(30);
  });

  it('should add negative numbers', () => {
    expect(sum(-1, -2)).toBe(-3);
    expect(sum(-5, 3)).toBe(-2);
    expect(sum(5, -3)).toBe(2);
  });

  it('should handle zero', () => {
    expect(sum(0, 0)).toBe(0);
    expect(sum(0, 5)).toBe(5);
    expect(sum(5, 0)).toBe(5);
  });

  it('should add decimal numbers', () => {
    expect(sum(0.1, 0.2)).toBeCloseTo(0.3);
    expect(sum(1.5, 2.5)).toBe(4);
    expect(sum(-1.5, 1.5)).toBe(0);
  });
});