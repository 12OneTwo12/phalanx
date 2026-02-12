/**
 * Global credential store — persists auth secrets to ~/.phalanx/credentials.json
 * Separate from per-project .phalanx/config.json to avoid committing secrets.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ProviderAuthMode } from '@phalanx/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthCredential {
  /** The secret value (API key, setup-token, or OAuth access token) */
  secret: string;
  /** Auth mode that produced this credential */
  authMode: ProviderAuthMode;
  /** Optional expiry (ISO 8601). Used for OAuth tokens. */
  expiresAt?: string;
}

type CredentialStore = Record<string, AuthCredential>;

// ---------------------------------------------------------------------------
// Paths (injectable for testing)
// ---------------------------------------------------------------------------

let credentialsDir = join(homedir(), '.phalanx');
let credentialsFile = join(credentialsDir, 'credentials.json');

/** Override paths for testing. */
export function _setCredentialPaths(dir: string, file: string): void {
  credentialsDir = dir;
  credentialsFile = file;
}

/** Reset to default paths. */
export function _resetCredentialPaths(): void {
  credentialsDir = join(homedir(), '.phalanx');
  credentialsFile = join(credentialsDir, 'credentials.json');
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

function loadAll(): CredentialStore {
  if (!existsSync(credentialsFile)) return {};
  try {
    return JSON.parse(readFileSync(credentialsFile, 'utf-8'));
  } catch {
    return {};
  }
}

function writeAll(store: CredentialStore): void {
  if (!existsSync(credentialsDir)) {
    mkdirSync(credentialsDir, { recursive: true });
  }
  writeFileSync(credentialsFile, JSON.stringify(store, null, 2) + '\n', 'utf-8');
  chmodSync(credentialsFile, 0o600);
}

export function saveCredential(provider: string, credential: AuthCredential): void {
  const store = loadAll();
  store[provider] = credential;
  writeAll(store);
}

export function loadCredential(provider: string): AuthCredential | null {
  const store = loadAll();
  return store[provider] ?? null;
}

export function removeCredential(provider: string): void {
  const store = loadAll();
  if (!(provider in store)) return;
  delete store[provider];
  writeAll(store);
}

/**
 * Return a display-safe summary for `config show`.
 * Masks the secret: first 12 chars + "..." + last 4 chars.
 */
export function getCredentialSummary(
  provider: string,
): { authMode: ProviderAuthMode; masked: string } | null {
  const cred = loadCredential(provider);
  if (!cred) return null;

  const s = cred.secret;
  const masked = s.length > 20 ? s.slice(0, 12) + '...' + s.slice(-4) : '****';
  return { authMode: cred.authMode, masked };
}
