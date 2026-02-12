import {
  getGoalRepository,
  getEpicRepository,
  getTicketRepository,
} from '@/lib/db';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';
import { DecompositionService, ManualDecompositionStrategy } from '@phalanx/core';
import type { DecomposedEpic } from '@phalanx/core';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/goals/:id/decompose — decompose a goal into epics and tickets.
 *
 * Body options:
 *  - `{ epics: DecomposedEpic[] }` — manual decomposition with explicit structure
 *  - `{}` — placeholder for future LLM-powered decomposition
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const goal = getGoalRepository().findById(id);
  if (!goal) return errorResponse('Goal not found', 404);

  const body = await parseBody<{ epics?: DecomposedEpic[] }>(request);

  // Use manual strategy if epics are provided, otherwise return error
  // (LLM strategy requires provider configuration via service layer)
  if (!body?.epics || body.epics.length === 0) {
    return errorResponse(
      'epics array is required. Provide an array of { title, description, tickets: [...] }',
    );
  }

  const strategy = new ManualDecompositionStrategy(body.epics);
  const service = new DecompositionService(
    getGoalRepository(),
    getEpicRepository(),
    getTicketRepository(),
    strategy,
  );

  const result = await service.decompose(id);
  return jsonResponse(result, 201);
}
