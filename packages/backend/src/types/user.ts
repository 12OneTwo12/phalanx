import { Document, Types } from 'mongoose';

/**
 * User interface representing the user document structure
 */
export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password_hash: string;
  username: string;
  oauth_provider?: string;
  oauth_id?: string;
  email_verified: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
  
  // Instance methods
  setPassword(password: string): Promise<void>;
  verifyPassword(password: string): Promise<boolean>;
}

/**
 * User creation input (without generated fields)
 */
export interface IUserCreate {
  email: string;
  password_hash: string;
  username: string;
  oauth_provider?: string;
  oauth_id?: string;
  email_verified?: boolean;
}

/**
 * OAuth user creation input
 */
export interface IOAuthUserCreate {
  email: string;
  username: string;
  oauth_provider: string;
  oauth_id: string;
  email_verified?: boolean;
}