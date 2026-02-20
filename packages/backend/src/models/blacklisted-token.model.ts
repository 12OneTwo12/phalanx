import mongoose, { Schema, Document } from 'mongoose';

export interface IBlacklistedToken extends Document {
  token: string;
  userId: string;
  expiresAt: Date;
  blacklistedAt: Date;
  reason?: string;
}

const blacklistedTokenSchema = new Schema<IBlacklistedToken>({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  blacklistedAt: {
    type: Date,
    default: Date.now,
  },
  reason: {
    type: String,
    enum: ['logout', 'security', 'admin_action', 'other'],
    default: 'logout',
  },
});

// TTL index to automatically delete after token expiration
blacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const BlacklistedToken = mongoose.model<IBlacklistedToken>('BlacklistedToken', blacklistedTokenSchema);