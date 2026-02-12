/**
 * User service for authentication operations
 */
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { DatabaseManager } from '../db/database.js';
import { users, type User, type NewUser } from '../db/schema.js';
import { hashPassword, verifyPassword } from './password.js';

export class UserService {
  constructor(private db: DatabaseManager) {}

  /**
   * Create a new user with hashed password
   */
  async createUser(email: string, password: string): Promise<User> {
    // Validate email
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }

    // Check if user already exists
    const existing = await this.db.orm
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (existing) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const newUser: NewUser = {
      id: uuidv4(),
      email,
      passwordHash,
    };

    const [user] = await this.db.orm.insert(users).values(newUser).returning();
    return user;
  }

  /**
   * Authenticate user and update last login
   */
  async authenticate(email: string, password: string): Promise<User | null> {
    const user = await this.db.orm
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (!user) {
      return null;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    // Update last login
    await this.db.orm
      .update(users)
      .set({ lastLogin: new Date().toISOString() })
      .where(eq(users.id, user.id));

    return { ...user, lastLogin: new Date().toISOString() };
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | undefined> {
    return this.db.orm
      .select()
      .from(users)
      .where(eq(users.id, id))
      .get();
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.db.orm
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();
  }
}