import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';
import { clearLLMProviderCache } from '@/lib/llm-provider';

interface RouteParams {
  params: Promise<{ provider: string }>;
}

interface AuthCredential {
  secret: string;
  authMode: string;
  expiresAt?: string;
}

function getCredFilePath(): string {
  return join(homedir(), '.phalanx', 'credentials.json');
}

function loadCredentials(): Record<string, AuthCredential> {
  const credFile = getCredFilePath();
  if (!existsSync(credFile)) return {};
  try {
    const raw = JSON.parse(readFileSync(credFile, 'utf-8'));
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    return raw as Record<string, AuthCredential>;
  } catch {
    return {};
  }
}

function saveCredentials(creds: Record<string, AuthCredential>): void {
  const credFile = getCredFilePath();
  const dir = join(homedir(), '.phalanx');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(credFile, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

/** PUT /api/credentials/:provider — save credential */
export async function PUT(request: Request, { params }: RouteParams) {
  const { provider } = await params;
  const body = await parseBody<{ secret: string; authMode: string }>(request);
  if (!body?.secret) {
    return errorResponse('secret is required');
  }

  const creds = loadCredentials();
  creds[provider] = {
    secret: body.secret,
    authMode: body.authMode ?? 'api_key',
  };
  saveCredentials(creds);
  clearLLMProviderCache();

  return jsonResponse({ saved: true });
}

/** DELETE /api/credentials/:provider — remove credential */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { provider } = await params;
  const creds = loadCredentials();

  if (!creds[provider]) {
    return errorResponse('Credential not found', 404);
  }

  delete creds[provider];
  saveCredentials(creds);
  clearLLMProviderCache();

  return jsonResponse({ deleted: true });
}
