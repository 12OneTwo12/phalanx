import { getProviderConfigRepository } from '@/lib/db';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/providers/:id — get a single provider config */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const provider = getProviderConfigRepository().findById(id);
  if (!provider) return errorResponse('Provider not found', 404);
  return jsonResponse(provider);
}

/** PATCH /api/providers/:id — update a provider config */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await parseBody<{
    name?: string;
    enabled?: boolean;
    defaultModel?: string;
    baseUrl?: string;
    metadata?: string;
  }>(request);
  if (!body) return errorResponse('Request body is required');

  const repo = getProviderConfigRepository();
  const updated = repo.update(id, body);
  if (!updated) return errorResponse('Provider not found', 404);

  return jsonResponse(updated);
}

/** DELETE /api/providers/:id — delete a provider config */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const deleted = getProviderConfigRepository().delete(id);
  if (!deleted) return errorResponse('Provider not found', 404);
  return jsonResponse({ deleted: true });
}
