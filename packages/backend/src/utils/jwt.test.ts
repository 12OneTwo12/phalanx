import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractTokenPayload,
  signToken,
  decodeToken,
  TokenExpiredError,
  InvalidTokenError,
  InvalidTokenTypeError,
} from './jwt.js';

describe('JWT Utils', () => {
  const testPayload = {
    userId: '123',
    email: 'test@example.com'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Access Token', () => {
    it('should generate and verify access token', () => {
      const token = generateAccessToken(testPayload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.type).toBe('access');
    });

    it('should throw error when verifying non-access token as access token', () => {
      const refreshToken = generateRefreshToken(testPayload);
      expect(() => verifyAccessToken(refreshToken)).toThrow('Invalid token type: expected access token');
    });

    it('should have 15 minute expiry', () => {
      const token = generateAccessToken(testPayload);
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      
      expect(decoded.exp).toBeTruthy();
      expect(decoded.iat).toBeTruthy();
      
      // Check expiry is approximately 15 minutes (900 seconds)
      const expiryDuration = (decoded.exp! - decoded.iat!) ;
      expect(expiryDuration).toBe(900); // 15 minutes in seconds
    });
  });

  describe('Refresh Token', () => {
    it('should generate and verify refresh token', () => {
      const token = generateRefreshToken(testPayload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.type).toBe('refresh');
    });

    it('should throw error when verifying non-refresh token as refresh token', () => {
      const accessToken = generateAccessToken(testPayload);
      expect(() => verifyRefreshToken(accessToken)).toThrow('Invalid token type: expected refresh token');
    });

    it('should have 7 day expiry', () => {
      const token = generateRefreshToken(testPayload);
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      
      expect(decoded.exp).toBeTruthy();
      expect(decoded.iat).toBeTruthy();
      
      // Check expiry is approximately 7 days (604800 seconds)
      const expiryDuration = (decoded.exp! - decoded.iat!);
      expect(expiryDuration).toBe(604800); // 7 days in seconds
    });
  });

  describe('Generic Token Verification', () => {
    it('should verify any valid token', () => {
      const accessToken = generateAccessToken(testPayload);
      const refreshToken = generateRefreshToken(testPayload);
      
      const accessDecoded = verifyToken(accessToken);
      expect(accessDecoded.type).toBe('access');
      
      const refreshDecoded = verifyToken(refreshToken);
      expect(refreshDecoded.type).toBe('refresh');
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow('Invalid token');
    });

    it('should throw error for expired token', () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { ...testPayload, type: 'access' },
        process.env.JWT_SECRET || 'test-secret-key-for-testing-purposes-only',
        { expiresIn: '-1s', issuer: 'phalanx-backend' }
      );
      
      expect(() => verifyToken(expiredToken)).toThrow('Token has expired');
    });
  });

  describe('Token Payload Extraction', () => {
    it('should extract payload without verification', () => {
      const accessToken = generateAccessToken(testPayload);
      const payload = extractTokenPayload(accessToken);
      
      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(testPayload.userId);
      expect(payload?.type).toBe('access');
    });

    it('should return null for invalid token', () => {
      const payload = extractTokenPayload('invalid-token');
      expect(payload).toBeNull();
    });
  });

  describe('Legacy Functions', () => {
    it('should sign and verify token using legacy functions', () => {
      const token = signToken(testPayload);
      expect(token).toBeTruthy();
      
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('should decode token using legacy function', () => {
      const token = signToken(testPayload);
      const decoded = decodeToken(token);
      
      expect(decoded?.userId).toBe(testPayload.userId);
      expect(decoded?.email).toBe(testPayload.email);
    });
  });

  describe('Error Classes', () => {
    it('should create TokenExpiredError', () => {
      const error = new TokenExpiredError();
      expect(error.name).toBe('TokenExpiredError');
      expect(error.message).toBe('Token has expired');
    });

    it('should create InvalidTokenError', () => {
      const error = new InvalidTokenError();
      expect(error.name).toBe('InvalidTokenError');
      expect(error.message).toBe('Invalid token');
    });

    it('should create InvalidTokenTypeError', () => {
      const error = new InvalidTokenTypeError('access', 'refresh');
      expect(error.name).toBe('InvalidTokenTypeError');
      expect(error.message).toBe('Invalid token type: expected access token, got refresh');
    });
  });
});