import { MODEL_CATALOG } from '@phalanx/core';
import { jsonResponse } from '@/lib/api-utils';

export async function GET() {
  const providerSet = new Set<string>();
  const models: Record<string, { id: string; name: string }[]> = {};

  for (const entry of MODEL_CATALOG) {
    providerSet.add(entry.provider);
    if (!models[entry.provider]) models[entry.provider] = [];
    models[entry.provider].push({ id: entry.id, name: entry.name });
  }

  return jsonResponse({ providers: [...providerSet], models });
}
