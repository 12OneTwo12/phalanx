import { getGoalRepository, getEpicRepository, getTicketRepository } from '@/lib/db';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/goals/:id — get goal with epics and tickets */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const goalRepo = getGoalRepository();
  const goal = goalRepo.findById(id);
  if (!goal) return errorResponse('Goal not found', 404);

  const epicRepo = getEpicRepository();
  const ticketRepo = getTicketRepository();
  const epics = epicRepo.findByGoalId(id).map((epic) => ({
    ...epic,
    tickets: ticketRepo.findByEpicId(epic.id),
  }));

  return jsonResponse({ ...goal, epics });
}

/** PATCH /api/goals/:id — update a goal */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await parseBody<{ description?: string; status?: string; progress?: number }>(request);
  if (!body) return errorResponse('Invalid JSON body');

  const repo = getGoalRepository();
  const updated = repo.update(id, body);
  if (!updated) return errorResponse('Goal not found', 404);

  return jsonResponse(updated);
}

/** DELETE /api/goals/:id */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const repo = getGoalRepository();
  const deleted = repo.delete(id);
  if (!deleted) return errorResponse('Goal not found', 404);

  return jsonResponse({ success: true });
}
