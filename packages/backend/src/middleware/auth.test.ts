import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuth } from './auth.js';
import * as jwtUtils from '../utils/jwt.js';

// Mock the JWT utils
vi.mock('../utils/jwt.js');

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Setup mock request
    mockRequest = {
      headers: {},
    };

    // Setup mock response with chainable methods
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    // Setup mock next function
    mockNext = vi.fn();
  });

  describe('authenticate', () => {
    it('should call next() with valid token', () => {
      // Arrange
      const mockPayload = { userId: '123', email: 'test@example.com' };
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwtUtils.verifyToken).mockReturnValue(mockPayload);

      // Act
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(jwtUtils.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is missing', () => {
      // Act
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'No authorization header provided',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization format is invalid', () => {
      // Arrange
      mockRequest.headers = { authorization: 'InvalidFormat token' };

      // Act
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid authorization format',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is missing after Bearer', () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer ' };

      // Act
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid authorization format',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with error message when token is expired', () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer expired-token' };
      vi.mocked(jwtUtils.verifyToken).mockImplementation(() => {
        throw new Error('Token has expired');
      });

      // Act
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Token has expired',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with error message when token is invalid', () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      vi.mocked(jwtUtils.verifyToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Invalid token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should call next() without setting user when no auth header', () => {
      // Act
      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should set user with valid token', () => {
      // Arrange
      const mockPayload = { userId: '123', email: 'test@example.com' };
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwtUtils.verifyToken).mockReturnValue(mockPayload);

      // Act
      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(jwtUtils.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should call next() without error when token is invalid', () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      vi.mocked(jwtUtils.verifyToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should ignore malformed authorization header', () => {
      // Arrange
      mockRequest.headers = { authorization: 'InvalidFormat' };

      // Act
      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });
});