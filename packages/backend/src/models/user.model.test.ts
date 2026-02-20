import { describe, it, expect, beforeAll } from 'vitest';
import { User } from './user.model.js';

describe('User Model', () => {
  beforeAll(async () => {
    // Ensure indexes are built before testing unique constraints
    await User.syncIndexes();
  });

  describe('Validation', () => {
    it('should create a valid user with password', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashedpassword123',
        email_verified: false,
      };

      const user = await User.create(userData);
      expect(user.email).toBe('test@example.com');
      expect(user.username).toBe('testuser');
      expect(user.email_verified).toBe(false);
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });

    it('should create a valid OAuth user', async () => {
      const userData = {
        email: 'oauth@example.com',
        username: 'oauthuser',
        oauth_provider: 'google',
        oauth_id: 'google123',
        email_verified: true,
      };

      const user = await User.create(userData);
      expect(user.oauth_provider).toBe('google');
      expect(user.oauth_id).toBe('google123');
      expect(user.email_verified).toBe(true);
    });

    it('should fail without email', async () => {
      const userData = {
        username: 'testuser',
        password_hash: 'hashedpassword123',
      };

      await expect(User.create(userData)).rejects.toThrow(/email/i);
    });

    it('should fail with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        username: 'testuser',
        password_hash: 'hashedpassword123',
      };

      await expect(User.create(userData)).rejects.toThrow(/valid email/i);
    });

    it('should fail without username', async () => {
      const userData = {
        email: 'test@example.com',
        password_hash: 'hashedpassword123',
      };

      await expect(User.create(userData)).rejects.toThrow(/username/i);
    });

    it('should fail with short username', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'ab',
        password_hash: 'hashedpassword123',
      };

      await expect(User.create(userData)).rejects.toThrow(/at least 3 characters/i);
    });

    it('should fail with invalid username characters', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'test user!',
        password_hash: 'hashedpassword123',
      };

      await expect(User.create(userData)).rejects.toThrow(/letters, numbers, underscores, and hyphens/i);
    });

    it('should fail without password when not using OAuth', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
      };

      await expect(User.create(userData)).rejects.toThrow(/password_hash/i);
    });

    it('should fail with OAuth provider but no OAuth ID', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        oauth_provider: 'google',
      };

      await expect(User.create(userData)).rejects.toThrow(/OAuth ID is required/i);
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique email', async () => {
      await User.create({
        email: 'test@example.com',
        username: 'user1',
        password_hash: 'hash1',
      });

      await expect(User.create({
        email: 'test@example.com',
        username: 'user2',
        password_hash: 'hash2',
      })).rejects.toThrow(/duplicate key/i);
    });

    it('should enforce unique username', async () => {
      await User.create({
        email: 'test1@example.com',
        username: 'testuser',
        password_hash: 'hash1',
      });

      await expect(User.create({
        email: 'test2@example.com',
        username: 'testuser',
        password_hash: 'hash2',
      })).rejects.toThrow(/duplicate key/i);
    });

    it('should enforce unique OAuth provider + ID combination', async () => {
      await User.create({
        email: 'test1@example.com',
        username: 'user1',
        oauth_provider: 'google',
        oauth_id: 'google123',
      });

      await expect(User.create({
        email: 'test2@example.com',
        username: 'user2',
        oauth_provider: 'google',
        oauth_id: 'google123',
      })).rejects.toThrow(/duplicate key/i);
    });
  });

  describe('JSON Serialization', () => {
    it('should not expose password_hash in JSON', async () => {
      const user = await User.create({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'secrethash',
      });

      const json = user.toJSON();
      expect(json).not.toHaveProperty('password_hash');
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('_id');
    });
  });
});