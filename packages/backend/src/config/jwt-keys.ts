import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { env } from './env.js';

export interface JWTKeys {
  privateKey: string;
  publicKey: string;
}

/**
 * Generate RSA key pair for JWT signing
 */
export function generateKeyPair(): JWTKeys {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { privateKey, publicKey };
}

/**
 * Load JWT keys from environment or files
 */
export function loadJWTKeys(): JWTKeys {
  // First, check if keys are provided via environment variables
  if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
    return {
      privateKey: process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      publicKey: process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'),
    };
  }

  // In production, keys should be provided via env vars
  if (env.NODE_ENV === 'production') {
    throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set in production');
  }

  // For development/test, check for key files
  const keysDir = path.join(process.cwd(), 'keys');
  const privateKeyPath = path.join(keysDir, 'jwt-private.pem');
  const publicKeyPath = path.join(keysDir, 'jwt-public.pem');

  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    return {
      privateKey: fs.readFileSync(privateKeyPath, 'utf-8'),
      publicKey: fs.readFileSync(publicKeyPath, 'utf-8'),
    };
  }

  // Generate keys for development/test
  console.warn('⚠️  Generating new RSA key pair for JWT signing (development only)');
  const keys = generateKeyPair();

  // Create keys directory if it doesn't exist
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  // Save keys to files
  fs.writeFileSync(privateKeyPath, keys.privateKey);
  fs.writeFileSync(publicKeyPath, keys.publicKey);

  // Add to .gitignore
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  if (!gitignoreContent.includes('/keys/')) {
    fs.appendFileSync(gitignorePath, '\n# JWT Keys\n/keys/\n');
  }

  return keys;
}

// Load keys on module initialization
export const jwtKeys = loadJWTKeys();