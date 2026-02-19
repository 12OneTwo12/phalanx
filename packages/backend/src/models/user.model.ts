import mongoose, { Schema } from 'mongoose';
import { IUser } from '../types/user.js';

/**
 * User schema definition
 */
const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (value: string) => {
          // Basic email validation regex
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: 'Please provide a valid email address',
      },
    },
    password_hash: {
      type: String,
      required: function(this: IUser) {
        // Password is required only if OAuth is not used
        return !this.oauth_provider;
      },
      select: false, // Don't include password_hash in queries by default
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [30, 'Username must not exceed 30 characters'],
      index: true,
      validate: {
        validator: (value: string) => {
          // Username can contain letters, numbers, underscores, and hyphens
          return /^[a-zA-Z0-9_-]+$/.test(value);
        },
        message: 'Username can only contain letters, numbers, underscores, and hyphens',
      },
    },
    oauth_provider: {
      type: String,
      enum: ['google', 'github', 'gitlab', null],
      default: null,
    },
    oauth_id: {
      type: String,
      default: null,
    },
    email_verified: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    collection: 'users',
  }
);

// Compound index for OAuth provider lookups
userSchema.index({ oauth_provider: 1, oauth_id: 1 }, { 
  unique: true,
  partialFilterExpression: { 
    oauth_provider: { $ne: null }, 
    oauth_id: { $ne: null } 
  }
});

// Ensure email uniqueness case-insensitively
userSchema.index({ email: 1 }, { 
  unique: true, 
  collation: { locale: 'en', strength: 2 } 
});

// Add a virtual 'id' field that mirrors '_id'
userSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Ensure virtual fields are included in JSON
userSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret.password_hash; // Never expose password hash
    return ret;
  }
});

// Pre-save middleware to validate OAuth fields
userSchema.pre('save', function(next) {
  // If OAuth provider is set, OAuth ID must also be set
  if (this.oauth_provider && !this.oauth_id) {
    next(new Error('OAuth ID is required when OAuth provider is specified'));
  } else if (!this.oauth_provider && this.oauth_id) {
    next(new Error('OAuth provider is required when OAuth ID is specified'));
  } else {
    next();
  }
});

// Create and export the User model
export const User = mongoose.model<IUser>('User', userSchema);