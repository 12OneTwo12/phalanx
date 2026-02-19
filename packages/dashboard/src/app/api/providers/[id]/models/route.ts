import { getProviderConfigRepository } from '@/lib/db';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Known models per provider type (static fallback) */
const KNOWN_MODELS: Record<string, string[]> = {
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'claude-opus-4-6'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro'],
};

/** GET /api/providers/:id/models — discover available models */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const provider = getProviderConfigRepository().findById(id);
  if (!provider) return errorResponse('Provider not found', 404);

  // Ollama: live discovery via /api/tags
  if (provider.type === 'ollama') {
    const baseUrl = provider.baseUrl || 'http://localhost:11434';
    try {
      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return jsonResponse({ models: [], error: `Ollama returned HTTP ${res.status}` });
      }
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const models = (data.models ?? []).map((m) => m.name);
      return jsonResponse({ models });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      return jsonResponse({ models: [], error: msg.includes('abort') ? 'Connection timed out' : msg });
    }
  }

  // Other providers: return known models
  return jsonResponse({ models: KNOWN_MODELS[provider.type] ?? [] });
}
