import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from './password.js';

describe('password utilities', () => {
  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'testPassword123!';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password cannot be empty');
    });

    it('should throw error for null/undefined password', async () => {
      await expect(hashPassword(null as any)).rejects.toThrow('Password cannot be empty');
      await expect(hashPassword(undefined as any)).rejects.toThrow('Password cannot be empty');
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'testPassword123!';
      const hash = await hashPassword(password);
      
      const matches = await comparePassword(password, hash);
      expect(matches).toBe(true);
    });

    it('should return false for non-matching password and hash', async () => {
      const password = 'testPassword123!';
      const wrongPassword = 'wrongPassword456!';
      const hash = await hashPassword(password);
      
      const matches = await comparePassword(wrongPassword, hash);
      expect(matches).toBe(false);
    });

    it('should return false for empty password', async () => {
      const hash = await hashPassword('realPassword');
      
      const matches = await comparePassword('', hash);
      expect(matches).toBe(false);
    });

    it('should return false for empty hash', async () => {
      const matches = await comparePassword('password', '');
      expect(matches).toBe(false);
    });

    it('should return false for null/undefined inputs', async () => {
      const hash = await hashPassword('realPassword');
      
      expect(await comparePassword(null as any, hash)).toBe(false);
      expect(await comparePassword('password', null as any)).toBe(false);
    });

    it('should handle invalid hash format gracefully', async () => {
      await expect(comparePassword('password', 'not-a-bcrypt-hash')).rejects.toThrow('Failed to compare passwords');
    });
  });

  describe('bcrypt salt rounds', () => {
    it('should use at least 10 rounds as per requirements', async () => {
      const password = 'testPassword';
      const hash = await hashPassword(password);
      
      // bcrypt hashes have format: $2b$<rounds>$<salt><hash>
      const rounds = parseInt(hash.split('$')[2]);
      expect(rounds).toBeGreaterThanOrEqual(10);
    });
  });
});