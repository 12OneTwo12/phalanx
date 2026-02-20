import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JWTPayload {
  userId: string;
  email: string;
}

export interface AccessTokenPayload extends JWTPayload {
  type: 'access';
}

export interface RefreshTokenPayload extends JWTPayload {
  type: 'refresh';
}

export type TokenPayload = AccessTokenPayload | RefreshTokenPayload;

// Access token generation (15 minutes)
export function generateAccessToken(payload: JWTPayload): string {
  const tokenPayload: AccessTokenPayload = {
    ...payload,
    type: 'access',
  };

  return jwt.sign(tokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'phalanx-backend',
  });
}

// Refresh token generation (7 days)
export function generateRefreshToken(payload: JWTPayload): string {
  const tokenPayload: RefreshTokenPayload = {
    ...payload,
    type: 'refresh',
  };

  return jwt.sign(tokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'phalanx-backend',
  });
}

// Verify any token and return typed payload
export function verifyToken<T extends TokenPayload = TokenPayload>(token: string): T {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'phalanx-backend',
    }) as T;
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

// Verify access token specifically
export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = verifyToken<AccessTokenPayload>(token);
  
  if (payload.type !== 'access') {
    throw new Error('Invalid token type: expected access token');
  }
  
  return payload;
}

// Verify refresh token specifically
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = verifyToken<RefreshTokenPayload>(token);
  
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type: expected refresh token');
  }
  
  return payload;
}

// Extract payload from token without verification
export function extractTokenPayload(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

// Legacy functions for backward compatibility
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'phalanx-backend',
  });
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

// Token validation errors
export class TokenExpiredError extends Error {
  constructor(message = 'Token has expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends Error {
  constructor(message = 'Invalid token') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

export class InvalidTokenTypeError extends Error {
  constructor(expected: 'access' | 'refresh', received?: string) {
    super(`Invalid token type: expected ${expected} token${received ? `, got ${received}` : ''}`);
    this.name = 'InvalidTokenTypeError';
  }
}