/**
 * Tests for password hashing functionality
 */
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, needsRehash } from '../../src/auth/password.js';

describe('password hashing', () => {
  it('should hash a password', async () => {
    const password = 'Test123!@#';
    const hash = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
  });

  it('should generate different hashes for the same password', async () => {
    const password = 'Test123!@#';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    
    expect(hash1).not.toBe(hash2);
  });

  it('should verify correct password', async () => {
    const password = 'Test123!@#';
    const hash = await hashPassword(password);
    
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'Test123!@#';
    const wrongPassword = 'Wrong123!@#';
    const hash = await hashPassword(password);
    
    const isValid = await verifyPassword(wrongPassword, hash);
    expect(isValid).toBe(false);
  });

  it('should reject empty password for hashing', async () => {
    await expect(hashPassword('')).rejects.toThrow('Password cannot be empty');
  });

  it('should return false for empty password verification', async () => {
    const hash = await hashPassword('Test123!@#');
    
    const isValid = await verifyPassword('', hash);
    expect(isValid).toBe(false);
  });

  it('should detect if hash needs rehashing', () => {
    // Mock hash with 8 rounds (less than our minimum of 10)
    const oldHash = '$2b$08$RZRgL1oe8fRqKz2s.mock.hash';
    
    expect(needsRehash(oldHash)).toBe(true);
  });
});