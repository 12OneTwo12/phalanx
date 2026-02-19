import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { jsonResponse } from '@/lib/api-utils';

interface AuthCredential {
  secret: string;
  authMode: string;
  expiresAt?: string;
}

function maskSecret(secret: string): string {
  if (secret.length <= 10) return '***';
  return secret.slice(0, 6) + '...' + secret.slice(-4);
}

/** GET /api/credentials — return masked credential status per provider */
export async function GET() {
  const credFile = join(homedir(), '.phalanx', 'credentials.json');

  if (!existsSync(credFile)) {
    return jsonResponse({});
  }

  let raw: Record<string, AuthCredential>;
  try {
    const content = JSON.parse(readFileSync(credFile, 'utf-8'));
    if (typeof content !== 'object' || content === null || Array.isArray(content)) {
      return jsonResponse({});
    }
    raw = content as Record<string, AuthCredential>;
  } catch {
    return jsonResponse({});
  }

  const result: Record<string, { exists: boolean; masked: string; authMode: string }> = {};
  for (const [provider, cred] of Object.entries(raw)) {
    result[provider] = {
      exists: true,
      masked: maskSecret(cred.secret),
      authMode: cred.authMode,
    };
  }

  return jsonResponse(result);
}
