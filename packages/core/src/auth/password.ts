/**
 * Password hashing and validation using bcrypt
 */
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10; // Minimum 10 rounds as per requirement

/**
 * Hash a plain text password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

/**
 * Check if a password hash needs to be upgraded (e.g., if salt rounds changed)
 */
export function needsRehash(hash: string, currentRounds: number = SALT_ROUNDS): boolean {
  try {
    const rounds = bcrypt.getRounds(hash);
    return rounds < currentRounds;
  } catch {
    return true; // If we can't determine rounds, assume it needs rehashing
  }
}