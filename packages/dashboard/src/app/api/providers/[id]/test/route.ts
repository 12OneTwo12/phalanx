import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getProviderConfigRepository } from '@/lib/db';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function loadCredentialSecret(providerType: string): string | null {
  try {
    const credFile = join(homedir(), '.phalanx', 'credentials.json');
    if (!existsSync(credFile)) return null;
    const raw = JSON.parse(readFileSync(credFile, 'utf-8')) as Record<string, { secret: string }>;
    return raw[providerType]?.secret ?? null;
  } catch {
    return null;
  }
}

/** POST /api/providers/:id/test — test provider connectivity */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const provider = getProviderConfigRepository().findById(id);
  if (!provider) return errorResponse('Provider not found', 404);

  const timeout = 5000;

  try {
    if (provider.type === 'ollama') {
      const baseUrl = provider.baseUrl || 'http://localhost:11434';
      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(timeout),
      });
      const data = (await res.json()) as { models?: unknown[] };
      const modelCount = Array.isArray(data.models) ? data.models.length : 0;
      return jsonResponse({
        success: res.ok,
        provider: provider.name,
        message: res.ok ? `Connected. ${modelCount} model(s) available.` : `HTTP ${res.status}`,
      });
    }

    if (provider.type === 'anthropic') {
      const secret = loadCredentialSecret('anthropic');
      if (!secret) return jsonResponse({ success: false, provider: provider.name, message: 'No API key configured' });
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': secret, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(timeout),
      });
      return jsonResponse({
        success: res.ok,
        provider: provider.name,
        message: res.ok ? 'API key valid' : `HTTP ${res.status}: ${res.statusText}`,
      });
    }

    if (provider.type === 'openai') {
      const secret = loadCredentialSecret('openai');
      if (!secret) return jsonResponse({ success: false, provider: provider.name, message: 'No API key configured' });
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(timeout),
      });
      return jsonResponse({
        success: res.ok,
        provider: provider.name,
        message: res.ok ? 'API key valid' : `HTTP ${res.status}: ${res.statusText}`,
      });
    }

    if (provider.type === 'gemini') {
      const secret = loadCredentialSecret('gemini');
      if (!secret) return jsonResponse({ success: false, provider: provider.name, message: 'No API key configured' });
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(secret)}`, {
        signal: AbortSignal.timeout(timeout),
      });
      return jsonResponse({
        success: res.ok,
        provider: provider.name,
        message: res.ok ? 'API key valid' : `HTTP ${res.status}: ${res.statusText}`,
      });
    }

    // Custom / fallback: try HEAD on baseUrl
    if (provider.baseUrl) {
      const res = await fetch(provider.baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(timeout),
      });
      return jsonResponse({
        success: res.ok,
        provider: provider.name,
        message: res.ok ? 'Connected' : `HTTP ${res.status}`,
      });
    }

    return jsonResponse({ success: false, provider: provider.name, message: 'No base URL or credentials to test' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({
      success: false,
      provider: provider.name,
      message: msg.includes('abort') ? 'Connection timed out (5s)' : msg,
    });
  }
}
