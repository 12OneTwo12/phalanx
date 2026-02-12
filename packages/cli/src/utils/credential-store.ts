/**
 * Global credential store — persists auth secrets to ~/.phalanx/credentials.json
 * Separate from per-project .phalanx/config.json to avoid committing secrets.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

/** @internal Test only — override credential paths for isolated testing. */
export function _setCredentialPaths(dir: string, file: string): void {
  credentialsDir = dir;
  credentialsFile = file;
}

/** @internal Test only — reset to default credential paths. */
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
    const raw = JSON.parse(readFileSync(credentialsFile, 'utf-8'));
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    return raw as CredentialStore;
  } catch {
    return {};
  }
}

function writeAll(store: CredentialStore): void {
  mkdirSync(credentialsDir, { recursive: true, mode: 0o700 });
  writeFileSync(credentialsFile, JSON.stringify(store, null, 2) + '\n', {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

export function saveCredential(provider: string, credential: AuthCredential): void {
  const store = loadAll();
  store[provider] = credential;
  writeAll(store);
}

export function loadCredential(provider: string): AuthCredential | null {
  const store = loadAll();
  const entry = store[provider];
  if (!entry || typeof entry.secret !== 'string' || typeof entry.authMode !== 'string') {
    return null;
  }
  return entry;
}

export function removeCredential(provider: string): void {
  const store = loadAll();
  if (!(provider in store)) return;
  delete store[provider];
  writeAll(store);
}

/** Mask a secret for display: first 6 chars + "..." + last 4 chars. */
export function maskSecret(s: string): string {
  return s.length > 12 ? s.slice(0, 6) + '...' + s.slice(-4) : '****';
}

/**
 * Return a display-safe summary for `config show`.
 */
export function getCredentialSummary(
  provider: string,
): { authMode: ProviderAuthMode; masked: string } | null {
  const cred = loadCredential(provider);
  if (!cred) return null;
  return { authMode: cred.authMode, masked: maskSecret(cred.secret) };
}
