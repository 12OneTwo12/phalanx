import {
  getGoalRepository,
  getEpicRepository,
  getTicketRepository,
} from '@/lib/db';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';
import { getLLMProvider } from '@/lib/llm-provider';
import {
  DecompositionService,
  ManualDecompositionStrategy,
  LLMDecompositionStrategy,
} from '@phalanx/core';
import type { DecomposedEpic } from '@phalanx/core';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/goals/:id/decompose — decompose a goal into epics and tickets.
 *
 * Body options:
 *  - `{ epics: DecomposedEpic[] }` — manual decomposition with explicit structure
 *  - `{}` or `{ mode: "llm" }` — LLM-powered decomposition (requires configured provider)
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const goal = getGoalRepository().findById(id);
  if (!goal) return errorResponse('Goal not found', 404);

  const body = await parseBody<{ epics?: DecomposedEpic[]; mode?: 'llm' | 'manual' }>(request);

  let strategy;

  if (body?.epics && body.epics.length > 0) {
    // Manual strategy: explicit epics provided
    strategy = new ManualDecompositionStrategy(body.epics);
  } else {
    // LLM strategy: auto-decompose using configured provider
    const llm = getLLMProvider();
    if (!llm) {
      return errorResponse(
        'No LLM provider configured. Either provide explicit epics or configure a provider via phalanx init.',
      );
    }
    strategy = new LLMDecompositionStrategy(llm.provider, {
      config: { model: llm.model, maxTokens: 8192, temperature: 0.3 },
    });
  }

  const service = new DecompositionService(
    getGoalRepository(),
    getEpicRepository(),
    getTicketRepository(),
    strategy,
  );

  try {
    const result = await service.decompose(id);
    return jsonResponse(result, 201);
  } catch (err) {
    return errorResponse(
      `Decomposition failed: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }
}
