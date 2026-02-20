import { User } from '../models/user.model.js';

/**
 * Migration to add last_login field to existing users
 * Note: This is a no-op if the field already exists (Mongoose handles schema updates)
 */
export async function up(): Promise<void> {
  try {
    // Update all documents that don't have a last_login field
    const result = await User.updateMany(
      { last_login: { $exists: false } },
      { $set: { last_login: null } }
    );
    
    console.log(`Updated ${result.modifiedCount} users with last_login field`);
  } catch (error) {
    console.error('Migration up failed:', error);
    throw error;
  }
}

/**
 * Rollback migration - removes last_login field
 */
export async function down(): Promise<void> {
  try {
    // Remove last_login field from all documents
    const result = await User.updateMany(
      {},
      { $unset: { last_login: "" } }
    );
    
    console.log(`Removed last_login field from ${result.modifiedCount} users`);
  } catch (error) {
    console.error('Migration down failed:', error);
    throw error;
  }
}