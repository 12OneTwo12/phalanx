import { eq } from 'drizzle-orm';
import { users, type User, type NewUser } from '../schema/users';
import { getDb } from '../../db';
import { hashPassword, verifyPassword } from '../../auth/password';

export class UserRepository {
  private get db() {
    return getDb().orm;
  }

  async create(data: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt' | 'passwordHash'> & { password: string }): Promise<User> {
    const { password, ...userData } = data;
    const passwordHash = await hashPassword(password);
    
    const [user] = await this.db
      .insert(users)
      .values({
        ...userData,
        passwordHash,
      })
      .returning();
    
    return user;
  }

  async findById(id: number): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    return user || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return user || null;
  }

  async verifyCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    // Update last login
    await this.updateLastLogin(user.id);
    
    return user;
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id));
  }

  async updatePassword(id: number, newPassword: string): Promise<void> {
    const passwordHash = await hashPassword(newPassword);
    
    await this.db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, id));
  }
}

export function getUserRepository() {
  return new UserRepository();
}