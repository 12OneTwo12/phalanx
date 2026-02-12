import { getProviderConfigRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';

/** GET /api/providers — list all provider configurations */
export async function GET() {
  const providers = getProviderConfigRepository().findAll();
  return jsonResponse(providers);
}

/** POST /api/providers — create a new provider configuration */
export async function POST(request: Request) {
  const body = await parseBody<{
    type: string;
    name: string;
    defaultModel?: string;
    baseUrl?: string;
    metadata?: string;
  }>(request);

  if (!body?.type || !body?.name) {
    return errorResponse('type and name are required');
  }

  const validTypes = ['anthropic', 'openai', 'ollama', 'gemini', 'custom'];
  if (!validTypes.includes(body.type)) {
    return errorResponse(`type must be one of: ${validTypes.join(', ')}`);
  }

  const repo = getProviderConfigRepository();
  const provider = repo.create({
    id: newId(),
    type: body.type as 'anthropic' | 'openai' | 'ollama' | 'gemini' | 'custom',
    name: body.name,
    defaultModel: body.defaultModel ?? null,
    baseUrl: body.baseUrl ?? null,
    metadata: body.metadata ?? null,
  });

  return jsonResponse(provider, 201);
}
