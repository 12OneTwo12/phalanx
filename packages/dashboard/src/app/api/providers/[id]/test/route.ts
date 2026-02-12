import { getProviderConfigRepository } from '@/lib/db';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/providers/:id/test — test provider connectivity */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const provider = getProviderConfigRepository().findById(id);
  if (!provider) return errorResponse('Provider not found', 404);

  // Parse base URL from config
  const baseUrl = provider.baseUrl;
  if (!baseUrl) {
    return jsonResponse({ success: false, error: 'No base URL configured for this provider' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // Attempt a simple connectivity check (HEAD or GET on base URL)
    const response = await fetch(baseUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return jsonResponse({
      success: response.ok,
      statusCode: response.status,
      provider: provider.name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({
      success: false,
      error: msg.includes('abort') ? 'Connection timed out (5s)' : msg,
      provider: provider.name,
    });
  }
}
