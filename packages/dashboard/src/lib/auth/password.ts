import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hashes a password using bcrypt with a minimum of 10 rounds
 * @param password - The plain text password to hash
 * @returns Promise<string> - The hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }
  
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a password against a hash
 * @param password - The plain text password to verify
 * @param hash - The hash to verify against
 * @returns Promise<boolean> - True if the password matches the hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  
  return bcrypt.compare(password, hash);
}