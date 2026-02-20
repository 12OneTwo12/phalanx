import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { jwtKeys } from '../config/jwt-keys.js';
import { RefreshToken } from '../models/refresh-token.model.js';
import { BlacklistedToken } from '../models/blacklisted-token.model.js';
// @ts-expect-error ms package lacks type declarations
import ms from 'ms';

export interface TokenPayload {
  userId: string;
  email?: string;
}

export interface RefreshTokenPayload extends TokenPayload {
  tokenId: string;
}

export class AuthService {
  /**
   * Generate a new access token using RS256 algorithm
   */
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, jwtKeys.privateKey, {
      algorithm: 'RS256',
      expiresIn: env.JWT_ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      issuer: env.JWT_ISSUER,
    });
  }

  /**
   * Validate an access token and check if it's blacklisted
   */
  async validateAccessToken(token: string): Promise<TokenPayload | null> {
    try {
      // Verify JWT signature and expiration using public key
      const decoded = jwt.verify(token, jwtKeys.publicKey, {
        algorithms: ['RS256'],
        issuer: env.JWT_ISSUER,
      }) as TokenPayload;

      // Check if token is blacklisted
      const blacklisted = await BlacklistedToken.findOne({ token });
      if (blacklisted) {
        return null;
      }

      return decoded;
    } catch (error) {
      // Token is invalid, expired, or verification failed
      return null;
    }
  }

  /**
   * Blacklist an access token (for logout)
   */
  async blacklistAccessToken(token: string, userId: string, reason: string = 'logout'): Promise<boolean> {
    try {
      // Decode token to get expiration time (without verification since user might be logging out with expired token)
      const decoded = jwt.decode(token) as JwtPayload;
      if (!decoded || !decoded.exp) {
        return false;
      }

      const expiresAt = new Date(decoded.exp * 1000);

      // Don't blacklist already expired tokens
      if (expiresAt < new Date()) {
        return true; // Consider it successful since token is already invalid
      }

      // Create blacklist entry
      await BlacklistedToken.create({
        token,
        userId,
        expiresAt,
        reason,
      });

      return true;
    } catch (error) {
      // If token already exists in blacklist, consider it successful
      if ((error as Record<string, unknown>).code === 11000) { // MongoDB duplicate key error
        return true;
      }
      throw error;
    }
  }

  /**
   * Generate a new refresh token and store it in the database
   */
  async generateRefreshToken(payload: TokenPayload): Promise<{ token: string; expiresAt: Date }> {
    // Generate a unique token ID
    const tokenId = crypto.randomUUID();
    
    // Calculate expiration time
    const expiresInMs = ms(env.JWT_REFRESH_TOKEN_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + expiresInMs);

    // Create the refresh token with tokenId
    const refreshTokenPayload: RefreshTokenPayload = {
      ...payload,
      tokenId,
    };

    const token = jwt.sign(refreshTokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    // Store the refresh token in the database
    await RefreshToken.create({
      token,
      userId: payload.userId,
      expiresAt,
      isRevoked: false,
    });

    return { token, expiresAt };
  }

  /**
   * Validate and decode a refresh token
   */
  async validateRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
    try {
      // Verify JWT signature and expiration
      const decoded = jwt.verify(token, env.JWT_SECRET) as RefreshTokenPayload;
      
      // Check if token exists in database and is not revoked
      const storedToken = await RefreshToken.findOne({
        token,
        isRevoked: false,
      });

      if (!storedToken) {
        return null;
      }

      // Check if token is expired in database
      if (new Date() > storedToken.expiresAt) {
        return null;
      }

      return decoded;
    } catch (error) {
      // Token is invalid or expired
      return null;
    }
  }

  /**
   * Rotate refresh token - revoke old token and issue new one
   */
  async rotateRefreshToken(oldToken: string, payload: TokenPayload): Promise<{ 
    accessToken: string; 
    refreshToken: string; 
    expiresAt: Date;
  } | null> {
    // Validate the old token
    const validatedPayload = await this.validateRefreshToken(oldToken);
    if (!validatedPayload) {
      return null;
    }

    // Start a transaction for atomic operations
    const session = await RefreshToken.startSession();
    session.startTransaction();

    try {
      // Generate new tokens
      const accessToken = this.generateAccessToken(payload);
      const { token: refreshToken, expiresAt } = await this.generateRefreshToken(payload);

      // Mark old token as revoked and link to new token
      await RefreshToken.findOneAndUpdate(
        { token: oldToken },
        { 
          isRevoked: true,
          replacedByToken: refreshToken,
        },
        { session }
      );

      await session.commitTransaction();

      return {
        accessToken,
        refreshToken,
        expiresAt,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(token: string): Promise<boolean> {
    const result = await RefreshToken.findOneAndUpdate(
      { token, isRevoked: false },
      { isRevoked: true }
    );

    return !!result;
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    const result = await RefreshToken.updateMany(
      { userId, isRevoked: false },
      { isRevoked: true }
    );

    return result.modifiedCount;
  }

  /**
   * Clean up expired refresh tokens (can be run as a scheduled job)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await RefreshToken.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    return result.deletedCount;
  }

  /**
   * Clean up expired blacklisted tokens (handled by TTL index, but can be called manually)
   */
  async cleanupExpiredBlacklistedTokens(): Promise<number> {
    const result = await BlacklistedToken.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    return result.deletedCount;
  }
}

export const authService = new AuthService();