import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { authService, TokenPayload } from './auth.service.js';
import { RefreshToken } from '../models/refresh-token.model.js';
import { BlacklistedToken } from '../models/blacklisted-token.model.js';
import { jwtKeys } from '../config/jwt-keys.js';
import { env } from '../config/env.js';
import mongoose from 'mongoose';

// Mock the models
vi.mock('../models/refresh-token.model.js');
vi.mock('../models/blacklisted-token.model.js');

describe('AuthService', () => {
  const mockUserId = 'user123';
  const mockPayload: TokenPayload = {
    userId: mockUserId,
    email: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token with RS256 algorithm', () => {
      const token = authService.generateAccessToken(mockPayload);
      
      // Verify the token structure
      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3);
      
      // Decode and verify the token
      const decoded = jwt.verify(token, jwtKeys.publicKey, {
        algorithms: ['RS256'],
        issuer: env.JWT_ISSUER,
      }) as TokenPayload & { exp: number; iat: number; iss: string };
      
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.iss).toBe(env.JWT_ISSUER);
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should respect the configured expiration time', () => {
      const token = authService.generateAccessToken(mockPayload);
      const decoded = jwt.decode(token) as any;
      
      // Check that expiration is approximately 15 minutes from now
      const expectedExpiration = Math.floor(Date.now() / 1000) + (15 * 60);
      expect(decoded.exp).toBeCloseTo(expectedExpiration, -1); // Within 10 seconds
    });
  });

  describe('validateAccessToken', () => {
    it('should validate a valid access token', async () => {
      const token = authService.generateAccessToken(mockPayload);
      
      vi.mocked(BlacklistedToken.findOne).mockResolvedValue(null);
      
      const result = await authService.validateAccessToken(token);
      
      expect(result).toBeTruthy();
      expect(result?.userId).toBe(mockPayload.userId);
      expect(result?.email).toBe(mockPayload.email);
      expect(BlacklistedToken.findOne).toHaveBeenCalledWith({ token });
    });

    it('should reject a blacklisted token', async () => {
      const token = authService.generateAccessToken(mockPayload);
      
      vi.mocked(BlacklistedToken.findOne).mockResolvedValue({
        token,
        userId: mockUserId,
        expiresAt: new Date(Date.now() + 1000000),
        blacklistedAt: new Date(),
      } as any);
      
      const result = await authService.validateAccessToken(token);
      
      expect(result).toBeNull();
    });

    it('should reject an expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(mockPayload, jwtKeys.privateKey, {
        algorithm: 'RS256',
        expiresIn: '-1h',
        issuer: env.JWT_ISSUER,
      });
      
      const result = await authService.validateAccessToken(expiredToken);
      
      expect(result).toBeNull();
    });

    it('should reject a token with invalid signature', async () => {
      // Create a token with a different private key
      const { privateKey } = await import('crypto').then(crypto => 
        crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        })
      );
      
      const invalidToken = jwt.sign(mockPayload, privateKey, {
        algorithm: 'RS256',
        expiresIn: env.JWT_ACCESS_TOKEN_EXPIRES_IN,
        issuer: env.JWT_ISSUER,
      });
      
      const result = await authService.validateAccessToken(invalidToken);
      
      expect(result).toBeNull();
    });

    it('should reject a token with wrong issuer', async () => {
      const wrongIssuerToken = jwt.sign(mockPayload, jwtKeys.privateKey, {
        algorithm: 'RS256',
        expiresIn: env.JWT_ACCESS_TOKEN_EXPIRES_IN,
        issuer: 'wrong-issuer',
      });
      
      const result = await authService.validateAccessToken(wrongIssuerToken);
      
      expect(result).toBeNull();
    });
  });

  describe('blacklistAccessToken', () => {
    it('should blacklist a valid access token', async () => {
      const token = authService.generateAccessToken(mockPayload);
      
      vi.mocked(BlacklistedToken.create).mockResolvedValue({} as any);
      
      const result = await authService.blacklistAccessToken(token, mockUserId, 'logout');
      
      expect(result).toBe(true);
      expect(BlacklistedToken.create).toHaveBeenCalledWith({
        token,
        userId: mockUserId,
        expiresAt: expect.any(Date),
        reason: 'logout',
      });
    });

    it('should handle duplicate blacklist attempts gracefully', async () => {
      const token = authService.generateAccessToken(mockPayload);
      
      const duplicateError = new Error('Duplicate key error');
      (duplicateError as any).code = 11000;
      vi.mocked(BlacklistedToken.create).mockRejectedValue(duplicateError);
      
      const result = await authService.blacklistAccessToken(token, mockUserId);
      
      expect(result).toBe(true);
    });

    it('should not blacklist an already expired token', async () => {
      const expiredToken = jwt.sign(mockPayload, jwtKeys.privateKey, {
        algorithm: 'RS256',
        expiresIn: '-1h',
      });
      
      const result = await authService.blacklistAccessToken(expiredToken, mockUserId);
      
      expect(result).toBe(true);
      expect(BlacklistedToken.create).not.toHaveBeenCalled();
    });

    it('should handle invalid token format', async () => {
      const result = await authService.blacklistAccessToken('invalid-token', mockUserId);
      
      expect(result).toBe(false);
      expect(BlacklistedToken.create).not.toHaveBeenCalled();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a refresh token and store it in database', async () => {
      const mockToken = 'refresh-token';
      const mockExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      vi.spyOn(jwt, 'sign').mockReturnValue(mockToken);
      vi.mocked(RefreshToken.create).mockResolvedValue({
        token: mockToken,
        userId: mockUserId,
        expiresAt: mockExpiresAt,
        isRevoked: false,
      } as any);
      
      const result = await authService.generateRefreshToken(mockPayload);
      
      expect(result.token).toBe(mockToken);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(RefreshToken.create).toHaveBeenCalledWith({
        token: mockToken,
        userId: mockUserId,
        expiresAt: expect.any(Date),
        isRevoked: false,
      });
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate a valid refresh token', async () => {
      const mockTokenId = 'token-id';
      const refreshPayload = { ...mockPayload, tokenId: mockTokenId };
      const token = jwt.sign(refreshPayload, env.JWT_SECRET);
      
      vi.mocked(RefreshToken.findOne).mockResolvedValue({
        token,
        userId: mockUserId,
        expiresAt: new Date(Date.now() + 1000000),
        isRevoked: false,
      } as any);
      
      const result = await authService.validateRefreshToken(token);
      
      expect(result).toBeTruthy();
      expect(result?.userId).toBe(mockUserId);
      expect(result?.tokenId).toBe(mockTokenId);
    });

    it('should reject a revoked refresh token', async () => {
      const token = jwt.sign(mockPayload, env.JWT_SECRET);
      
      vi.mocked(RefreshToken.findOne).mockResolvedValue(null);
      
      const result = await authService.validateRefreshToken(token);
      
      expect(result).toBeNull();
    });

    it('should reject an expired refresh token from database', async () => {
      const token = jwt.sign(mockPayload, env.JWT_SECRET);
      
      vi.mocked(RefreshToken.findOne).mockResolvedValue({
        token,
        userId: mockUserId,
        expiresAt: new Date(Date.now() - 1000),
        isRevoked: false,
      } as any);
      
      const result = await authService.validateRefreshToken(token);
      
      expect(result).toBeNull();
    });
  });

  describe('rotateRefreshToken', () => {
    it('should rotate refresh token successfully', async () => {
      const oldToken = 'old-token';
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';
      const mockTokenId = 'token-id';
      
      // Mock validateRefreshToken
      vi.spyOn(authService, 'validateRefreshToken').mockResolvedValue({
        ...mockPayload,
        tokenId: mockTokenId,
      });
      
      // Mock token generation
      vi.spyOn(authService, 'generateAccessToken').mockReturnValue(newAccessToken);
      vi.spyOn(authService, 'generateRefreshToken').mockResolvedValue({
        token: newRefreshToken,
        expiresAt: new Date(),
      });
      
      // Mock database session
      const mockSession = {
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        abortTransaction: vi.fn(),
        endSession: vi.fn(),
      };
      vi.mocked(RefreshToken.startSession).mockResolvedValue(mockSession as any);
      vi.mocked(RefreshToken.findOneAndUpdate).mockResolvedValue({} as any);
      
      const result = await authService.rotateRefreshToken(oldToken, mockPayload);
      
      expect(result).toBeTruthy();
      expect(result?.accessToken).toBe(newAccessToken);
      expect(result?.refreshToken).toBe(newRefreshToken);
      expect(RefreshToken.findOneAndUpdate).toHaveBeenCalledWith(
        { token: oldToken },
        { isRevoked: true, replacedByToken: newRefreshToken },
        { session: mockSession }
      );
    });

    it('should return null for invalid old token', async () => {
      vi.spyOn(authService, 'validateRefreshToken').mockResolvedValue(null);
      
      const result = await authService.rotateRefreshToken('invalid-token', mockPayload);
      
      expect(result).toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke a refresh token', async () => {
      const token = 'refresh-token';
      
      vi.mocked(RefreshToken.findOneAndUpdate).mockResolvedValue({} as any);
      
      const result = await authService.revokeRefreshToken(token);
      
      expect(result).toBe(true);
      expect(RefreshToken.findOneAndUpdate).toHaveBeenCalledWith(
        { token, isRevoked: false },
        { isRevoked: true }
      );
    });

    it('should return false if token not found', async () => {
      vi.mocked(RefreshToken.findOneAndUpdate).mockResolvedValue(null);
      
      const result = await authService.revokeRefreshToken('non-existent-token');
      
      expect(result).toBe(false);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens', async () => {
      vi.mocked(RefreshToken.updateMany).mockResolvedValue({
        modifiedCount: 5,
      } as any);
      
      const result = await authService.revokeAllUserTokens(mockUserId);
      
      expect(result).toBe(5);
      expect(RefreshToken.updateMany).toHaveBeenCalledWith(
        { userId: mockUserId, isRevoked: false },
        { isRevoked: true }
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired refresh tokens', async () => {
      vi.mocked(RefreshToken.deleteMany).mockResolvedValue({
        deletedCount: 10,
      } as any);
      
      const result = await authService.cleanupExpiredTokens();
      
      expect(result).toBe(10);
      expect(RefreshToken.deleteMany).toHaveBeenCalledWith({
        expiresAt: { $lt: expect.any(Date) },
      });
    });
  });

  describe('cleanupExpiredBlacklistedTokens', () => {
    it('should clean up expired blacklisted tokens', async () => {
      vi.mocked(BlacklistedToken.deleteMany).mockResolvedValue({
        deletedCount: 7,
      } as any);
      
      const result = await authService.cleanupExpiredBlacklistedTokens();
      
      expect(result).toBe(7);
      expect(BlacklistedToken.deleteMany).toHaveBeenCalledWith({
        expiresAt: { $lt: expect.any(Date) },
      });
    });
  });
});